/**
 * Middleware for internal service-to-service endpoints.
 * Caller must send: x-internal-key: <INTERNAL_API_KEY>
 */
module.exports = function requireInternalKey(req, res, next) {
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid internal key" });
  }
  next();
};
