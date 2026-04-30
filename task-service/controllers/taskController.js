const pool = require("../db");

// Create a new task
exports.createTask = async (req, res) => {
  const {
    gig_id,
    customer_id,
    title,
    description,
    estimated_price,
    due_date,
    attachments,
    location,
  } = req.body;
  try {
    const gig = await pool.query(`SELECT tasker_id FROM gigs WHERE id = $1`, [
      gig_id,
    ]);
    if (gig.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }

    const tasker_id = gig.rows[0].tasker_id;

    const result = await pool.query(
      `INSERT INTO tasks(gig_id, customer_id, tasker_id, title, description, estimated_price, due_date, attachments, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        gig_id,
        customer_id,
        tasker_id,
        title,
        description,
        estimated_price,
        due_date,
        attachments,
        location || null,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get a single task by ID
exports.getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
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
      `SELECT * FROM tasks WHERE tasker_id = $1`,
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
      `SELECT * FROM tasks WHERE customer_id = $1`,
      [customer_id]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, final_price, progress, accepted_at, completed_at } = req.body;
  try {
    console.log("Updating task ID:", id, "with data:", req.body);
    const result = await pool.query(
      `UPDATE tasks SET status = $1, final_price = $2, progress = $3, accepted_at = $4, completed_at = $5 WHERE id = $6 RETURNING *`,
      [status, final_price, progress, accepted_at, completed_at, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating task status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
