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


// Hourly: apply late visit penalty to tasks that missed their promised_visit_date
setInterval(async () => {
  try {
    const overdue = await pool.query(`
      SELECT id,
             EXTRACT(DAY FROM (CURRENT_DATE - promised_visit_date))::int AS days_late
      FROM tasks
      WHERE promised_visit_date IS NOT NULL
        AND promised_visit_date < CURRENT_DATE
        AND started_at IS NULL
        AND status IN ('quoted', 'accepted')`
    );

    for (const task of overdue.rows) {
      const penaltyPct = Math.min(task.days_late * 5, 25);
      await pool.query(
        `UPDATE tasks SET late_penalty_percent = $1 WHERE id = $2`,
        [penaltyPct, task.id]
      );
    }

    if (overdue.rows.length > 0) {
      console.log(`[late-penalty] Updated penalty for ${overdue.rows.length} overdue task(s)`);
    }
  } catch (err) {
    console.error("[late-penalty] Error:", err.message);
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("task-service listening on port", PORT));
