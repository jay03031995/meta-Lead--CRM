function notFound(_req, _res, next) {
  const err = new Error("Route not found");
  err.status = 404;
  next(err);
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || "Server error",
      details: err.details
    }
  });
}

module.exports = { notFound, errorHandler };
