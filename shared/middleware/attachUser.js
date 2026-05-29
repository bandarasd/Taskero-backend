const cache = require('../cache');

/**
 * Factory middleware — must be used after verifyFirebaseToken.
 * Looks up the DB user by firebase_uid and attaches req.user.id.
 * Usage: router.use(attachUser(pool))
 */
module.exports = function attachUser(pool) {
  return async function (req, res, next) {
    if (!req.user?.firebaseUid) return next();
    const cacheKey = `uid:${req.user.firebaseUid}`;
    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        req.user.id = cached;
        return next();
      }
      const result = await pool.query(
        "SELECT id FROM users WHERE firebase_uid = $1",
        [req.user.firebaseUid]
      );
      if (result.rows[0]) {
        req.user.id = result.rows[0].id;
        await cache.set(cacheKey, result.rows[0].id, 3600);
      }
    } catch (err) {
      console.error("[attachUser] DB lookup failed:", err.message);
    }
    next();
  };
};
