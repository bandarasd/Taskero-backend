const pool = require("../db");

// create a review
exports.createReview = async (req, res) => {
  const { task_id, rating, review, body } = req.body;
  try {
    // Check if the task exists
    const task = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [
      task_id,
    ]);
    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Insert the review into the reviews table (populate reviewer/tasker from the task)
    const result = await pool.query(
      `INSERT INTO reviews(task_id, gig_id, reviewer_id, tasker_id, rating, review)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [task_id, task.rows[0].gig_id, task.rows[0].customer_id, task.rows[0].tasker_id, rating, review ?? body ?? null]
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
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;
  try {
    const [countResult, reviews] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM reviews WHERE tasker_id = $1`, [tasker_id]),
      pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.avatar_url
         FROM reviews r
         LEFT JOIN users u ON u.id = r.reviewer_id
         WHERE r.tasker_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tasker_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    const data = reviews.rows.map(({ first_name, last_name, avatar_url, ...r }) => ({
      ...r,
      reviewer: first_name ? { first_name, last_name, avatar_url } : null,
    }));
    return res.status(200).json({ data, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("Error fetching reviews of tasker:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get reviews of a task
exports.getReviewsOfTask = async (req, res) => {
  const { task_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;
  try {
    const [countResult, reviews] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM reviews WHERE task_id = $1`, [task_id]),
      pool.query(
        `SELECT * FROM reviews WHERE task_id = $1 LIMIT $2 OFFSET $3`,
        [task_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return res.status(200).json({ data: reviews.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("Error fetching reviews of task:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// get reviews by a gig
exports.getReviewsOfGig = async (req, res) => {
  const { gig_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;
  try {
    const [countResult, reviews] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM reviews WHERE gig_id = $1`, [gig_id]),
      pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.avatar_url
         FROM reviews r
         LEFT JOIN users u ON u.id = r.reviewer_id
         WHERE r.gig_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [gig_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    const data = reviews.rows.map(({ first_name, last_name, avatar_url, ...r }) => ({
      ...r,
      reviewer: first_name ? { first_name, last_name, avatar_url } : null,
    }));
    return res.status(200).json({ data, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("Error fetching reviews of gig:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
