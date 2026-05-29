const pool = require("../db");
const cache = require("../../shared/cache");

const CACHE_KEY = "categories:all";
const CACHE_TTL = 21600; // 6 hours

exports.getCategories = async (req, res) => {
  try {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return res.json({ categories: cached });

    const result = await pool.query(
      `SELECT id, name, icon, requires_certification, image_url,
              booking_fields, cert_requirements, cert_description, sort_order
       FROM service_categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`
    );
    await cache.set(CACHE_KEY, result.rows, CACHE_TTL);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error("[ERROR] Get categories:", error);
    res.status(500).json({ error: "Database error" });
  }
};
