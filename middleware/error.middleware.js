const ApiResponse = require('../utils/apiResponse');
const config = require('../config/environment');

/**
 * 404 Not Found Middleware for undefined routes.
 */
function notFoundHandler(req, res, next) {
  return ApiResponse.notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Global Centralized Error Handler Middleware.
 */
function globalErrorHandler(err, req, res, next) {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || (config.isProduction ? [] : [err.stack || err.toString()]);

  return ApiResponse.error(res, message, errors, statusCode);
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
