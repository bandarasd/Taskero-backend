const pool = require("../db");
const { notifyUser } = require("../utils/notify");
const axios = require("axios");

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

// Create a new task
exports.createTask = async (req, res) => {
  const {
    gig_id,
    customer_id,
    tasker_id: provided_tasker_id,
    title,
    category,
    notes,
    details,
    location_address,
    location_latitude,
    location_longitude,
    scheduled_at,
    base_price,
    payment_method,
  } = req.body;
  try {
    const gig = await pool.query(`SELECT tasker_id FROM gigs WHERE id = $1`, [
      gig_id,
    ]);
    if (gig.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }

    const tasker_id = provided_tasker_id || gig.rows[0].tasker_id;

    const uploadedPhotos = req.files ? req.files.map((f) => f.path) : [];
    let existingAttachments = [];
    if (req.body.attachments) {
      try {
        existingAttachments = JSON.parse(req.body.attachments);
      } catch {
        existingAttachments = [];
      }
    }
    const attachments = JSON.stringify([...existingAttachments, ...uploadedPhotos]);

    const detailsJson = details
      ? typeof details === "string" ? details : JSON.stringify(details)
      : null;

    const result = await pool.query(
      `INSERT INTO tasks(
        gig_id, customer_id, tasker_id, title, category, notes, details,
        location_address, location_lat, location_lng, scheduled_at,
        base_price, attachments, status, payment_method
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14) RETURNING *`,
      [
        gig_id,
        customer_id,
        tasker_id,
        title || category,
        category || null,
        notes || null,
        detailsJson,
        location_address || null,
        location_latitude ?? null,
        location_longitude ?? null,
        scheduled_at || null,
        base_price ?? null,
        attachments,
        payment_method || 'cash',
      ]
    );

    const task = result.rows[0];

    notifyUser({
      user_id: tasker_id,
      title: "New Task Request",
      body: "A customer has requested your service. Review and send a quote.",
      type: "booking",
      data: { task_id: task.id },
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get a single task by ID
exports.getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.*, g.title AS gig_title, g.attachments AS gig_attachments
       FROM tasks t
       LEFT JOIN gigs g ON g.id = t.gig_id
       WHERE t.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get tasks for a tasker
exports.getTasksByTasker = async (req, res) => {
  const { tasker_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tasks WHERE tasker_id = $1`, [tasker_id]),
      pool.query(
        `SELECT t.*, g.title AS gig_title, g.attachments AS gig_attachments
         FROM tasks t
         LEFT JOIN gigs g ON g.id = t.gig_id
         WHERE t.tasker_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tasker_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return res.status(200).json({
      data: result.rows,
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get tasks for a customer
exports.getTasksForCustomer = async (req, res) => {
  const { customer_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tasks WHERE customer_id = $1`, [customer_id]),
      pool.query(
        `SELECT t.*, g.title AS gig_title
         FROM tasks t
         LEFT JOIN gigs g ON g.id = t.gig_id
         WHERE t.customer_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [customer_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return res.status(200).json({
      data: result.rows,
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Tasker submits a price quote for a pending task
exports.submitQuote = async (req, res) => {
  const { id } = req.params;
  const { price, estimated_duration_minutes, due_date } = req.body;
  if (!price || isNaN(price) || Number(price) <= 0) {
    return res.status(400).json({ error: "A valid price is required" });
  }
  if (!estimated_duration_minutes || isNaN(estimated_duration_minutes) || Number(estimated_duration_minutes) <= 0) {
    return res.status(400).json({ error: "estimated_duration_minutes is required" });
  }
  const durationMin = Number(estimated_duration_minutes);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskResult = await client.query(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    if (taskResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }
    const task = taskResult.rows[0];
    if (task.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Task is not in pending status" });
    }

    // Block the slot: check for overlapping quoted/accepted/in_progress tasks
    if (task.scheduled_at) {
      const conflict = await client.query(
        `SELECT id FROM tasks
         WHERE tasker_id = $1
           AND id != $2
           AND status IN ('quoted', 'accepted', 'in_progress')
           AND scheduled_at IS NOT NULL
           AND scheduled_at < ($3::timestamptz + ($4 || ' minutes')::interval)
           AND (scheduled_at + (COALESCE(estimated_duration_minutes, 60) || ' minutes')::interval) > $3::timestamptz
         FOR UPDATE`,
        [task.tasker_id, id, task.scheduled_at, durationMin]
      );
      if (conflict.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "You already have a booking that overlaps this time slot." });
      }
    }

    const newDueDate = due_date || null;

    const result = await client.query(
      `UPDATE tasks
       SET status = 'quoted',
           quoted_price = $1,
           estimated_duration_minutes = $2,
           due_date = COALESCE($3::timestamptz, due_date),
           quoted_at = NOW(),
           quote_expires_at = CASE
             WHEN scheduled_at IS NOT NULL
               THEN LEAST(NOW() + INTERVAL '24 hours', scheduled_at - INTERVAL '2 hours')
             ELSE NOW() + INTERVAL '24 hours'
           END
       WHERE id = $4 RETURNING *`,
      [Number(price), durationMin, newDueDate, id]
    );

    await client.query("COMMIT");

    const updated = result.rows[0];
    notifyUser({
      user_id: updated.customer_id,
      title: "You Got a Quote!",
      body: `Your tasker sent a quote of $${Number(price).toFixed(2)}. Tap to review and respond.`,
      type: "quote",
      data: { task_id: updated.id },
    });

    return res.status(200).json(updated);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error submitting quote:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// Customer accepts or rejects a tasker's quote
exports.respondToQuote = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // "accept" or "reject"
  if (!["accept", "reject"].includes(action)) {
    return res.status(400).json({ error: "Action must be 'accept' or 'reject'" });
  }
  try {
    const task = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task.rows[0].status !== "quoted") {
      return res.status(400).json({ error: "Task is not in quoted status" });
    }
    let result;
    if (action === "accept") {
      result = await pool.query(
        `UPDATE tasks SET status = 'accepted', final_price = quoted_price, accepted_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      const updated = result.rows[0];
      notifyUser({
        user_id: updated.tasker_id,
        title: "Quote Accepted!",
        body: updated.scheduled_at
          ? `Your quote was accepted. Task scheduled for ${new Date(updated.scheduled_at).toLocaleDateString()}.`
          : "Your quote was accepted. Get ready for the task!",
        type: "quote",
        data: { task_id: updated.id },
      });
    } else {
      result = await pool.query(
        `UPDATE tasks SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [id]
      );
      const updated = result.rows[0];
      notifyUser({
        user_id: updated.tasker_id,
        title: "Quote Declined",
        body: "The customer declined your quote for this task.",
        type: "quote",
        data: { task_id: updated.id },
      });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error responding to quote:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Update task status
exports.addTaskAttachments = async (req, res) => {
  const { id } = req.params;
  try {
    const uploadedPhotos = req.files ? req.files.map((f) => f.path) : [];
    if (uploadedPhotos.length === 0) {
      return res.status(400).json({ error: "No photos provided" });
    }
    const existing = await pool.query(`SELECT attachments FROM tasks WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const prev = existing.rows[0].attachments || [];
    const merged = JSON.stringify([...prev, ...uploadedPhotos]);
    const result = await pool.query(
      `UPDATE tasks SET attachments = $1 WHERE id = $2 RETURNING *`,
      [merged, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error adding task attachments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Returns the next upcoming booking for this task's tasker (if any) plus the tasker's buffer_minutes.
// Used by the worker app to decide whether to show the "Running Late" button.
exports.getNextBooking = async (req, res) => {
  const { id } = req.params;
  try {
    const taskResult = await pool.query(`SELECT tasker_id, scheduled_at, estimated_duration_minutes FROM tasks WHERE id = $1`, [id]);
    if (!taskResult.rows.length) return res.status(404).json({ error: "Task not found" });
    const { tasker_id, scheduled_at, estimated_duration_minutes } = taskResult.rows[0];

    // Get the tasker's buffer_minutes for today's day of week
    const dayOfWeek = new Date().getUTCDay();
    const schedRow = await pool.query(
      `SELECT buffer_minutes FROM tasker_schedules WHERE tasker_id = $1 AND day_of_week = $2 AND is_active = true LIMIT 1`,
      [tasker_id, dayOfWeek]
    );
    const buffer_minutes = schedRow.rows[0]?.buffer_minutes ?? 30;

    // The window end is when the current task's grace period expires
    const gracePeriodEnd = scheduled_at
      ? new Date(new Date(scheduled_at).getTime() + ((estimated_duration_minutes ?? 60) + buffer_minutes) * 60 * 1000)
      : null;

    // Find the next booking scheduled at or right after the grace period end
    const next = await pool.query(`
      SELECT t.id, t.scheduled_at, t.title,
             u.first_name, u.last_name, u.avatar_url
      FROM tasks t
      JOIN users u ON u.id = t.customer_id
      WHERE t.tasker_id = $1
        AND t.status IN ('accepted', 'quoted')
        AND t.scheduled_at IS NOT NULL
        AND t.scheduled_at::date = NOW()::date
        AND t.scheduled_at >= $2
      ORDER BY t.scheduled_at ASC
      LIMIT 1
    `, [tasker_id, gracePeriodEnd ?? new Date()]);

    return res.status(200).json({
      buffer_minutes,
      next_booking: next.rows[0] ?? null,
    });
  } catch (err) {
    console.error("Error in getNextBooking:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Tasker manually reports they are running late; notifies the next booked customer
exports.reportRunningLate = async (req, res) => {
  const { id } = req.params;
  const { extra_minutes } = req.body;

  if (!extra_minutes || isNaN(extra_minutes) || Number(extra_minutes) <= 0) {
    return res.status(400).json({ error: "extra_minutes must be a positive number" });
  }

  try {
    const taskResult = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!taskResult.rows.length) return res.status(404).json({ error: "Task not found" });
    const task = taskResult.rows[0];

    const newEta = new Date(Date.now() + Number(extra_minutes) * 60 * 1000);

    // Mark the current task: prevent bg job from double-firing, record tasker response
    await pool.query(
      `UPDATE tasks
       SET overrun_notified_at = COALESCE(overrun_notified_at, NOW()),
           tasker_responded_at = COALESCE(tasker_responded_at, NOW())
       WHERE id = $1`,
      [id]
    );

    const next = await pool.query(`
      SELECT t.id, t.customer_id, t.scheduled_at,
             cu.first_name AS customer_first,
             wu.first_name AS tasker_first
      FROM tasks t
      JOIN users cu ON cu.id = t.customer_id
      JOIN users wu ON wu.id = t.tasker_id
      WHERE t.tasker_id = $1
        AND t.status NOT IN ('cancelled', 'completed', 'payment_pending', 'in_progress')
        AND t.scheduled_at > NOW()
      ORDER BY t.scheduled_at ASC
      LIMIT 1
    `, [task.tasker_id]);

    if (next.rows.length === 0) {
      return res.status(200).json({ ok: true, affected: false, no_next_booking: true, new_eta: newEta });
    }

    const nextTask = next.rows[0];

    // Only notify and flag the next customer if the new ETA actually conflicts with their slot
    if (newEta <= new Date(nextTask.scheduled_at)) {
      return res.status(200).json({ ok: true, affected: false, no_next_booking: false, new_eta: newEta });
    }

    await pool.query(
      `UPDATE tasks SET overrun_notified_at = NOW(), tasker_new_eta = $1 WHERE id = $2`,
      [newEta, nextTask.id]
    );

    const etaStr = newEta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    notifyUser({
      user_id: nextTask.customer_id,
      title: "Your Tasker is Running Late",
      body: `${nextTask.tasker_first} is running behind and expects to reach you around ${etaStr}. Tap to choose what you'd like to do.`,
      type: "delay",
      data: { task_id: nextTask.id, new_eta: newEta.toISOString() },
    });

    return res.status(200).json({ ok: true, affected: true, new_eta: newEta });
  } catch (err) {
    console.error("Error in reportRunningLate:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Customer responds to a delay notification: wait, cancel, or reschedule
exports.respondToDelay = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['wait', 'cancel', 'reschedule'].includes(action)) {
    return res.status(400).json({ error: "action must be 'wait', 'cancel', or 'reschedule'" });
  }

  try {
    const taskResult = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!taskResult.rows.length) return res.status(404).json({ error: "Task not found" });
    const task = taskResult.rows[0];

    if (action === 'cancel') {
      await pool.query(
        `UPDATE tasks SET status = 'cancelled', delay_response = 'cancel', cancellation_reason = 'customer_delay_cancel' WHERE id = $1`,
        [id]
      );
      // Refund card payment if applicable (non-blocking)
      callInternal(`${PAYMENT_SERVICE_URL}/payments/refund/${id}`);
      notifyUser({
        user_id: task.tasker_id,
        title: "Booking Cancelled",
        body: "A customer cancelled their booking due to the delay.",
        type: "status",
        data: { task_id: id },
      });
      return res.status(200).json({ action: 'cancel' });
    }

    await pool.query(`UPDATE tasks SET delay_response = $1 WHERE id = $2`, [action, id]);

    if (action === 'wait') {
      notifyUser({
        user_id: task.tasker_id,
        title: "Customer is Waiting",
        body: "Your next customer has chosen to wait. Please finish up as soon as you can.",
        type: "status",
        data: { task_id: id },
      });
    }

    return res.status(200).json({ action });
  } catch (err) {
    console.error("Error in respondToDelay:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, final_price, progress, accepted_at, completed_at } = req.body;
  try {
    const startedAtExpr = status === 'in_progress' ? 'COALESCE(started_at, NOW())' : 'started_at';
    const completedAtExpr = status === 'completed' ? 'COALESCE(completed_at, NOW())' : 'completed_at';
    const result = await pool.query(
      `UPDATE tasks SET status = $1, final_price = COALESCE($2, final_price), progress = $3, accepted_at = $4, completed_at = ${completedAtExpr}, started_at = ${startedAtExpr} WHERE id = $5 RETURNING *`,
      [status, final_price || null, progress, accepted_at, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updated = result.rows[0];

    if (status === "payment_pending") {
      notifyUser({
        user_id: updated.customer_id,
        title: "Job Done — Payment Required",
        body: `Your tasker has finished the job. Please confirm payment of Rs. ${updated.final_price ?? updated.quoted_price ?? ''}.`,
        type: "status",
        data: { task_id: updated.id },
      });
    } else if (status === "completed") {
      callInternal(`${USER_SERVICE_URL}/users/${updated.tasker_id}/stats/completed`);
      notifyUser({
        user_id: updated.customer_id,
        title: "Task Completed",
        body: "Your task has been completed. Don't forget to leave a review!",
        type: "status",
        data: { task_id: updated.id },
      });
    } else if (status === "cancelled") {
      notifyUser({
        user_id: updated.customer_id,
        title: "Task Cancelled",
        body: "Your task has been cancelled.",
        type: "status",
        data: { task_id: updated.id },
      });
      notifyUser({
        user_id: updated.tasker_id,
        title: "Task Cancelled",
        body: "A task assigned to you has been cancelled.",
        type: "status",
        data: { task_id: updated.id },
      });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating task status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
