const pool = require("../db");

// create a review
exports.createReview = async (req, res) => {
  const { task_id, rating, review } = req.body;
  try {
    // Check if the task exists
    const task = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [
      task_id,
    ]);
    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Insert the review into the reviews table
    const result = await pool.query(
      `INSERT INTO reviews(task_id, rating, review) VALUES ($1, $2, $3) RETURNING *`,
      [task_id, rating, review]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating review:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get reviews of a tasker
exports.getReviewsOfTasker = async (req, res) => {
  const { tasker_id } = req.params;
  try {
    const reviews = await pool.query(
      `SELECT r.* FROM reviews r
       JOIN tasks t ON r.task_id = t.id
       WHERE t.tasker_id = $1`,
      [tasker_id]
    );
    return res.status(200).json(reviews.rows);
  } catch (error) {
    console.error("Error fetching reviews of tasker:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get reviews of a task
exports.getReviewsOfTask = async (req, res) => {
  const { task_id } = req.params;
  try {
    const reviews = await pool.query(
      `SELECT * FROM reviews WHERE task_id = $1`,
      [task_id]
    );
    return res.status(200).json(reviews.rows);
  } catch (error) {
    console.error("Error fetching reviews of task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get reviews by a gig
exports.getReviewsOfGig = async (req, res) => {
  const { gig_id } = req.params;
  try {
    const reviews = await pool.query(
      `SELECT r.* FROM reviews r
       JOIN tasks t ON r.task_id = t.id
       WHERE t.gig_id = $1`,
      [gig_id]
    );
    return res.status(200).json(reviews.rows);
  } catch (error) {
    console.error("Error fetching reviews of gig:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
