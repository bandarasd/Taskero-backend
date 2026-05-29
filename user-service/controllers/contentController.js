const pool = require("../db");
const cache = require("../../shared/cache");

const CACHE_TTL = 21600; // 6 hours

async function getByType(type, res) {
  const cacheKey = `content:${type}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ items: cached });

    const result = await pool.query(
      `SELECT id, title, body, sort_order
       FROM app_content
       WHERE content_type = $1 AND is_active = TRUE
       ORDER BY sort_order ASC`,
      [type]
    );
    await cache.set(cacheKey, result.rows, CACHE_TTL);
    res.json({ items: result.rows });
  } catch (error) {
    console.error(`[ERROR] Get content type=${type}:`, error);
    res.status(500).json({ error: "Database error" });
  }
}

exports.getFaqs = (_req, res) => getByType("faq", res);
exports.getPromos = (_req, res) => getByType("promo", res);
exports.getReviewTags = (_req, res) => getByType("review_tag", res);
