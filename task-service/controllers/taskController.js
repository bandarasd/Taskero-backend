const pool = require("../db");
const { notifyUser } = require("../utils/notify");

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
        base_price, attachments, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') RETURNING *`,
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
      `SELECT t.*, g.title AS gig_title
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
  try {
    const result = await pool.query(
      `SELECT t.*, g.title AS gig_title, g.attachments AS gig_attachments
       FROM tasks t
       LEFT JOIN gigs g ON g.id = t.gig_id
       WHERE t.tasker_id = $1
       ORDER BY t.created_at DESC`,
      [tasker_id]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get tasks for a customer
exports.getTasksForCustomer = async (req, res) => {
  const { customer_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.*, g.title AS gig_title
       FROM tasks t
       LEFT JOIN gigs g ON g.id = t.gig_id
       WHERE t.customer_id = $1
       ORDER BY t.created_at DESC`,
      [customer_id]
    );
    return res.status(200).json(result.rows);
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
exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, final_price, progress, accepted_at, completed_at } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tasks SET status = $1, final_price = $2, progress = $3, accepted_at = $4, completed_at = $5 WHERE id = $6 RETURNING *`,
      [status, final_price, progress, accepted_at, completed_at, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updated = result.rows[0];

    if (status === "completed") {
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
