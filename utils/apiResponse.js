/**
 * Standardized API Response Utilities.
 * Formats every HTTP response consistently across the platform.
 */

class ApiResponse {
  /**
   * Sends a successful JSON response.
   * @param {import('express').Response} res 
   * @param {string} message 
   * @param {any} data 
   * @param {number} statusCode 
   */
  static success(res, message = 'Success', data = {}, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Sends an error JSON response.
   * @param {import('express').Response} res 
   * @param {string} message 
   * @param {Array<string|object>} errors 
   * @param {number} statusCode 
   */
  static error(res, message = 'An error occurred', errors = [], statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: Array.isArray(errors) ? errors : [errors],
    });
  }

  /**
   * 400 Bad Request
   */
  static badRequest(res, message = 'Invalid request data', errors = []) {
    return this.error(res, message, errors, 400);
  }

  /**
   * 401 Unauthorized
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, [], 401);
  }

  /**
   * 403 Forbidden
   */
  static forbidden(res, message = 'Forbidden resource') {
    return this.error(res, message, [], 403);
  }

  /**
   * 404 Not Found
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, [], 404);
  }

  /**
   * 409 Conflict
   */
  static conflict(res, message = 'Resource conflict or duplicate entry') {
    return this.error(res, message, [], 409);
  }
}

module.exports = ApiResponse;
