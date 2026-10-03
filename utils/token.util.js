const jwt = require('jsonwebtoken');
const config = require('../config/environment');

/**
 * Generates a signed JWT for an authenticated user.
 * @param {object} payload 
 * @param {string|number} expiresIn 
 * @returns {string}
 */
function generateToken(payload, expiresIn = config.jwt.expiresIn) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

/**
 * Verifies and decodes a JWT token.
 * @param {string} token 
 * @returns {object}
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = {
  generateToken,
  verifyToken,
};
