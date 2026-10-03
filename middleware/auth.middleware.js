const { verifyToken } = require('../utils/token.util');
const { query } = require('../config/database');
const ApiResponse = require('../utils/apiResponse');

/**
 * Authentication Middleware:
 * Extracts JWT token, verifies validity, verifies active user status in database,
 * and sets req.user.
 * 
 * Strict Isolation Principle:
 * All downstream controllers must extract the authenticated user identity
 * solely from req.user.id and NEVER from request body/params.
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'Authorization token required in format: Bearer <token>');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return ApiResponse.unauthorized(res, 'Token missing');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return ApiResponse.unauthorized(res, 'Token has expired. Please log in again.');
      }
      return ApiResponse.unauthorized(res, 'Invalid authentication token');
    }

    if (!decoded || !decoded.id) {
      return ApiResponse.unauthorized(res, 'Malformed authentication token');
    }

    // Verify user exists and is active in database
    const users = await query(
      `SELECT id, first_name, last_name, email, mobile_number, currency, country, timezone, status
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [decoded.id]
    );

    if (!users || users.length === 0) {
      return ApiResponse.unauthorized(res, 'User account not found or deactivated');
    }

    const user = users[0];
    if (user.status !== 'ACTIVE') {
      return ApiResponse.forbidden(res, `Account is ${user.status.toLowerCase()}. Contact support.`);
    }

    // Assign sanitized user context to request
    req.user = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      mobileNumber: user.mobile_number,
      currency: user.currency,
      country: user.country,
      timezone: user.timezone,
    };

    return next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return ApiResponse.error(res, 'Authentication verification failed', [error.message], 500);
  }
}

module.exports = {
  authenticateToken,
};
