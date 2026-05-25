const pool = require("../db");

exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, icon, requires_certification, image_url,
              booking_fields, cert_requirements, cert_description, sort_order
       FROM service_categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`
    );
    res.json({ categories: result.rows });
  } catch (error) {
    console.error("[ERROR] Get categories:", error);
    res.status(500).json({ error: "Database error" });
  }
};
