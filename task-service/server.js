require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const pool = require("./db");
const { notifyUser } = require("./utils/notify");

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || "http://localhost:3004";
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3001";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

async function callInternal(url) {
  try {
    await axios.post(url, {}, { headers: { "x-internal-key": INTERNAL_KEY }, timeout: 5000 });
  } catch (err) {
    console.error(`[internal call failed] ${url}:`, err.message);
  }
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "task-service running" }));

// Category routes (public)
app.use("/categories", require("./routes/categoryRoutes"));

// Gig routes
app.use("/gigs", require("./routes/gigRoutes"));

// Task routes
app.use("/tasks", require("./routes/taskRoutes"));

// Review routes
app.use("/reviews", require("./routes/reviewRoutes"));

// Tasker schedule & availability routes
app.use("/taskers", require("./routes/taskerScheduleRoutes"));

const errorHandler = require('../shared/middleware/errorHandler');
app.use(errorHandler);

// Auto-cancel quotes that have passed their expiry deadline
const EXPIRY_INTERVAL_MS = 60 * 1000; // run every minute
setInterval(async () => {
  try {
    const result = await pool.query(
      `UPDATE tasks SET status = 'cancelled'
       WHERE status = 'quoted'
         AND quote_expires_at IS NOT NULL
         AND quote_expires_at < NOW()`
    );
    if (result.rowCount > 0) {
      console.log(`[quote-expiry] Auto-cancelled ${result.rowCount} expired quote(s)`);
    }
  } catch (err) {
    console.error("[quote-expiry] Error running expiry job:", err.message);
  }
}, EXPIRY_INTERVAL_MS);

// Detect in_progress tasks that have exceeded their estimated duration and notify next customer
setInterval(async () => {
  try {
    // Join tasker_schedules to get buffer_minutes for today; fire only after estimate + buffer has elapsed
    const overrun = await pool.query(`
      SELECT t.id, t.tasker_id, t.customer_id, t.title, t.scheduled_at,
             t.started_at, t.estimated_duration_minutes,
             u.first_name AS tasker_first,
             COALESCE(s.buffer_minutes, 30) AS buffer_minutes
      FROM tasks t
      JOIN users u ON u.id = t.tasker_id
      LEFT JOIN tasker_schedules s
        ON s.tasker_id = t.tasker_id
        AND s.day_of_week = EXTRACT(DOW FROM NOW())::int
        AND s.is_active = true
      WHERE t.status = 'in_progress'
        AND t.started_at IS NOT NULL
        AND t.estimated_duration_minutes IS NOT NULL
        AND NOW() > t.started_at + ((t.estimated_duration_minutes + COALESCE(s.buffer_minutes, 30)) || ' minutes')::interval
        AND t.overrun_notified_at IS NULL
    `);

    for (const task of overrun.rows) {
      // Mark current task to prevent this job from re-running for the same task
      await pool.query(
        `UPDATE tasks SET overrun_notified_at = NOW() WHERE id = $1`,
        [task.id]
      );

      const next = await pool.query(`
        SELECT t.id, t.customer_id, t.scheduled_at,
               u.first_name AS customer_first
        FROM tasks t
        JOIN users u ON u.id = t.customer_id
        WHERE t.tasker_id = $1
          AND t.status NOT IN ('cancelled', 'completed', 'payment_pending', 'in_progress')
          AND t.scheduled_at > $2
          AND t.scheduled_at::date = $2::date
        ORDER BY t.scheduled_at ASC
        LIMIT 1
      `, [task.tasker_id, task.scheduled_at ?? new Date()]);

      // Only notify the next customer if they're actually affected (no pre-declared ETA clears them)
      if (next.rows.length > 0) {
        const nextTask = next.rows[0];

        // Flag the next customer's task so their AppointmentDetailScreen shows the delay banner
        await pool.query(
          `UPDATE tasks SET overrun_notified_at = NOW() WHERE id = $1`,
          [nextTask.id]
        );

        notifyUser({
          user_id: task.tasker_id,
          title: "You're Running Late",
          body: `You've gone over your estimated time. ${nextTask.customer_first} has been notified.`,
          type: "overrun",
          data: { task_id: task.id },
        });
        notifyUser({
          user_id: nextTask.customer_id,
          title: "Your Tasker is Running Late",
          body: `${task.tasker_first} is finishing a previous job and will be delayed. Tap to choose what you'd like to do.`,
          type: "delay",
          data: { task_id: nextTask.id, delayed_by_task_id: task.id },
        });
      }

      if (overrun.rows.length > 0) {
        console.log(`[overrun-check] Notified ${overrun.rows.length} overrun task(s)`);
      }
    }
  } catch (err) {
    console.error("[overrun-check] Error:", err.message);
  }
}, 60 * 1000);

// Auto-cancel tasks where the tasker didn't respond within 15 min of the grace period ending
setInterval(async () => {
  try {
    const abandoned = await pool.query(`
      SELECT t.id, t.tasker_id, t.customer_id, t.payment_method
      FROM tasks t
      WHERE t.status = 'in_progress'
        AND t.overrun_notified_at IS NOT NULL
        AND t.overrun_notified_at < NOW() - interval '15 minutes'
        AND t.tasker_responded_at IS NULL
    `);

    for (const task of abandoned.rows) {
      await pool.query(
        `UPDATE tasks SET status = 'cancelled', cancellation_reason = 'tasker_no_response' WHERE id = $1`,
        [task.id]
      );

      // Refund card payment if applicable
      await callInternal(`${PAYMENT_SERVICE_URL}/payments/refund/${task.id}`);

      // Penalise tasker completion ratio
      await callInternal(`${USER_SERVICE_URL}/users/${task.tasker_id}/stats/no-show`);

      notifyUser({
        user_id: task.customer_id,
        title: "Booking Auto-Cancelled",
        body: "Your tasker did not respond in time. Your booking has been cancelled and a full refund has been initiated.",
        type: "cancellation",
        data: { task_id: task.id },
      });
      notifyUser({
        user_id: task.tasker_id,
        title: "Booking Cancelled — No Response",
        body: "A booking was auto-cancelled because you didn't respond within the grace period. This affects your completion rate.",
        type: "cancellation",
        data: { task_id: task.id },
      });
    }

    if (abandoned.rows.length > 0) {
      console.log(`[auto-cancel] Cancelled ${abandoned.rows.length} abandoned task(s)`);
    }
  } catch (err) {
    console.error("[auto-cancel] Error:", err.message);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("task-service listening on port", PORT));
