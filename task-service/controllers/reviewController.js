const pool = require("../db");
const cache = require("../../shared/cache");

const REVIEW_TTL = 300; // 5 minutes

// create a review
exports.createReview = async (req, res) => {
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  const { task_id, rating, review, body } = req.body;
  try {
    // Check if the task exists
    const task = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [task_id]);
    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const t = task.rows[0];
    if (callerId !== t.customer_id) {
      return res.status(403).json({ error: "Only the task customer can leave a review" });
    }
    if (t.status !== "completed") {
      return res.status(400).json({ error: "Can only review completed tasks" });
    }
    // Prevent duplicate review
    const existing = await pool.query(
      `SELECT id FROM reviews WHERE task_id = $1 AND reviewer_id = $2`,
      [task_id, callerId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "You have already reviewed this task" });
    }

    // Insert the review into the reviews table (populate reviewer/tasker from the task)
    const result = await pool.query(
      `INSERT INTO reviews(task_id, gig_id, reviewer_id, tasker_id, rating, review)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [task_id, t.gig_id, t.customer_id, t.tasker_id, rating, review ?? body ?? null]
    );
    await cache.delPattern(`reviews:tasker:${t.tasker_id}:*`);
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
  const cacheKey = `reviews:tasker:${tasker_id}:p${page}:l${limit}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

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
    const payload = { data, pagination: { page, limit, total, hasMore: page * limit < total } };
    await cache.set(cacheKey, payload, REVIEW_TTL);
    return res.status(200).json(payload);
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
