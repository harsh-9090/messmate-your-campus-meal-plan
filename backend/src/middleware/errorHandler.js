export function errorHandler(err, _req, res, _next) {
  console.error("[ERROR]", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Server error" });
}
