// =======================================================
// File: middleware/errorMiddleware.js
// Description: Centralized error handling middleware for Express.
// Catches errors and sends a standardized JSON response.
// =======================================================

const errorHandler = (err, req, res, next) => {
  // Log the error for debugging purposes (in production, use a more robust logger)
  console.error("Caught by error middleware:", err);

  // Determine status code (default to 500 Internal Server Error)
  const statusCode = err.statusCode || 500;

  // Send the error response
  res.status(statusCode).json({
    success: false,
    message: err.message || "An unexpected error occurred.",
    // Optionally, send more error details in development mode
    // stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
