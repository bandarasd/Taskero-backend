const pool = require("../db");

// No-op stubs kept for internal route compatibility (POST /gigs, DELETE /gigs/:id)
exports.indexGig = (req, res) => res.status(200).json({ message: "ok" });
exports.deleteGig = (req, res) => res.status(200).json({ message: "ok" });

// Search gigs via Postgres ILIKE across title, description, category, tags
exports.searchGigs = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const offset = (page - 1) * limit;
  const pattern = `%${q}%`;

  try {
    const [countResult, result] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT g.id)
         FROM gigs g
         WHERE g.is_active = true
           AND (g.title ILIKE $1 OR g.description ILIKE $1 OR g.category ILIKE $1)`,
        [pattern]
      ),
      pool.query(
        `SELECT g.*, u.first_name, u.last_name, u.avatar_url,
                COALESCE(AVG(r.rating), 0)::numeric(3,2) AS tasker_rating,
                COUNT(r.id)::int AS tasker_review_count
         FROM gigs g
         JOIN users u ON g.tasker_id = u.id
         LEFT JOIN reviews r ON r.tasker_id = g.tasker_id
         WHERE g.is_active = true
           AND (g.title ILIKE $1 OR g.description ILIKE $1 OR g.category ILIKE $1)
         GROUP BY g.id, u.id
         ORDER BY g.created_at DESC
         LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    const data = result.rows.map(({ first_name, last_name, avatar_url, tasker_rating, tasker_review_count, ...gig }) => ({
      ...gig,
      rating: parseFloat(tasker_rating),
      review_count: tasker_review_count,
      tasker: { id: gig.tasker_id, first_name, last_name, avatar_url },
    }));
    res.status(200).json({ data, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (err) {
    console.error("Error searching gigs:", err);
    res.status(500).json({ error: "Search failed" });
  }
};
