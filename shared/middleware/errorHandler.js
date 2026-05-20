/**
 * Express error-handling middleware. Mount last in every service:
 *   app.use(errorHandler)
 */
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.url}:`, err);
  }
  res.status(status).json({ error: message });
};
