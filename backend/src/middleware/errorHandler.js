export function errorHandler(err, _req, res, _next) {
  // Log the complete details internally for diagnostics
  console.error("[SERVER ERROR]", err);

  const isDev = process.env.NODE_ENV === "development";
  const status = err.status || err.statusCode || 500;

  // Identify raw database engine exceptions
  const isPgError = err.code && typeof err.code === "string" && err.code.length === 5;

  let responseMessage = "An unexpected server error occurred. Please try again later.";

  if (isDev) {
    // In development mode, return internal stack details
    responseMessage = err.message || "Server error";
  } else if (status < 500 && !isPgError) {
    // Safe user-facing error exceptions (e.g. 400 Bad Request, validation errors)
    responseMessage = err.message;
  } else if (err.code === "23505") {
    // Standardize unique constraint violations
    responseMessage = "A record with these details already exists.";
  }

  res.status(status).json({
    error: responseMessage,
    ...(err.details ? { details: err.details } : {})
  });
}
