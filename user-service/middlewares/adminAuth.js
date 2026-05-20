const pool = require("../db");

/**
 * Must be used after verifyFirebaseToken.
 * Fetches the DB user by firebase_uid and rejects if role !== 'admin'.
 */
module.exports = async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = $1",
      [req.user.firebaseUid]
    );
    const user = result.rows[0];
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin access required" });
    }
    req.user.id = user.id;
    next();
  } catch (err) {
    console.error("[adminAuth] error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
