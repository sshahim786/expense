const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, transaction } = require('../../config/database');
const { generateToken } = require('../../utils/token.util');
const {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  isValidPassword,
} = require('../../utils/validator');

class AuthService {
  /**
   * Registers a new user with default settings and initial audit record.
   */
  static async register(data, meta = {}) {
    const validation = validateRegistration(data);
    if (!validation.isValid) {
      const error = new Error('Validation failed');
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      password,
      currency = 'INR',
      country = 'India',
      timezone = 'Asia/Kolkata',
    } = data;

    const normalizedEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const existing = await query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    if (existing && existing.length > 0) {
      const error = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Execute insertion in transaction
    const result = await transaction(async (conn) => {
      // 1. Insert user
      const [userResult] = await conn.query(
        `INSERT INTO users (first_name, last_name, email, mobile_number, password_hash, currency, country, timezone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          firstName.trim(),
          lastName.trim(),
          normalizedEmail,
          mobileNumber.trim(),
          passwordHash,
          currency.trim().toUpperCase(),
          country.trim(),
          timezone.trim(),
        ]
      );

      const newUserId = userResult.insertId;

      // 2. Insert user_settings with sensible defaults
      await conn.query(
        `INSERT INTO user_settings (user_id, date_format, theme, default_dashboard_period, notify_bill_reminders, notify_budget_alerts, notify_emi_reminders, budget_alert_threshold)
         VALUES (?, 'DD/MM/YYYY', 'LIGHT', 'THIS_MONTH', 1, 1, 1, 80)`,
        [newUserId]
      );

      // 3. Log audit event
      await conn.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
         VALUES (?, 'USER_REGISTERED', 'USER', ?, ?, ?, ?)`,
        [
          newUserId,
          newUserId,
          meta.ip || null,
          meta.userAgent || null,
          JSON.stringify({ email: normalizedEmail }),
        ]
      );

      // 4. Ensure default starter accounts and payment methods exist
      const AccountsService = require('../accounts/accounts.service');
      await AccountsService.ensureUserDefaults(newUserId);

      return {
        id: newUserId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        mobileNumber: mobileNumber.trim(),
        currency: currency.trim().toUpperCase(),
        country: country.trim(),
        timezone: timezone.trim(),
      };
    });

    // Generate JWT
    const token = generateToken({ id: result.id, email: result.email });

    return {
      token,
      user: result,
    };
  }

  /**
   * Authenticates user via email and password.
   */
  static async login(credentials, meta = {}) {
    const validation = validateLogin(credentials);
    if (!validation.isValid) {
      const error = new Error('Validation failed');
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const { email, password } = credentials;
    const normalizedEmail = email.trim().toLowerCase();

    // Query user
    const users = await query(
      `SELECT id, first_name, last_name, email, mobile_number, password_hash, currency, country, timezone, status
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [normalizedEmail]
    );

    if (!users || users.length === 0) {
      // Record failed login audit
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent, details)
         VALUES (NULL, 'LOGIN_FAILED', 'AUTH', ?, ?, ?)`,
        [meta.ip || null, meta.userAgent || null, JSON.stringify({ email: normalizedEmail, reason: 'USER_NOT_FOUND' })]
      );

      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      const error = new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
      error.statusCode = 403;
      throw error;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent, details)
         VALUES (?, 'LOGIN_FAILED', 'AUTH', ?, ?, ?)`,
        [user.id, meta.ip || null, meta.userAgent || null, JSON.stringify({ email: normalizedEmail, reason: 'INVALID_PASSWORD' })]
      );

      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Successful login audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES (?, 'LOGIN_SUCCESS', 'AUTH', ?, ?, ?)`,
      [user.id, user.id, meta.ip || null, meta.userAgent || null]
    );

    const token = generateToken({ id: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        mobileNumber: user.mobile_number,
        currency: user.currency,
        country: user.country,
        timezone: user.timezone,
      },
    };
  }

  /**
   * Changes authenticated user password with current password verification.
   */
  static async changePassword(userId, payload, meta = {}) {
    const validation = validatePasswordChange(payload);
    if (!validation.isValid) {
      const error = new Error('Validation failed');
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const { currentPassword, newPassword } = payload;

    const users = await query(
      'SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [userId]
    );

    if (!users || users.length === 0) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 400;
      throw error;
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES (?, 'PASSWORD_CHANGED', 'USER', ?, ?, ?)`,
      [userId, userId, meta.ip || null, meta.userAgent || null]
    );

    return { message: 'Password updated successfully' };
  }

  /**
   * Generates a password reset token.
   */
  static async forgotPassword(email, meta = {}) {
    if (!email) {
      const error = new Error('Email is required');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [normalizedEmail]
    );

    // Always respond with success message to prevent user enumeration
    if (!users || users.length === 0) {
      return { message: 'If that email address exists in our database, you will receive password reset instructions.' };
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
      [tokenHash, expires, user.id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
       VALUES (?, 'FORGOT_PASSWORD_REQUEST', 'AUTH', ?, ?)`,
      [user.id, meta.ip || null, meta.userAgent || null]
    );

    return {
      message: 'If that email address exists in our database, you will receive password reset instructions.',
      // For development/testing convenience, include resetToken
      devResetToken: resetToken,
    };
  }

  /**
   * Resets password using token.
   */
  static async resetPassword(token, newPassword, confirmNewPassword, meta = {}) {
    if (!token) {
      const error = new Error('Reset token is required');
      error.statusCode = 400;
      throw error;
    }

    if (!newPassword || !isValidPassword(newPassword)) {
      const error = new Error(
        'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      );
      error.statusCode = 400;
      throw error;
    }

    if (newPassword !== confirmNewPassword) {
      const error = new Error('Password confirmation does not match');
      error.statusCode = 400;
      throw error;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const users = await query(
      `SELECT id FROM users
       WHERE reset_password_token = ? AND reset_password_expires > NOW() AND deleted_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );

    if (!users || users.length === 0) {
      const error = new Error('Password reset token is invalid or has expired');
      error.statusCode = 400;
      throw error;
    }

    const user = users[0];
    const newHash = await bcrypt.hash(newPassword, 10);

    await query(
      `UPDATE users
       SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL
       WHERE id = ?`,
      [newHash, user.id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES (?, 'PASSWORD_RESET', 'AUTH', ?, ?, ?)`,
      [user.id, user.id, meta.ip || null, meta.userAgent || null]
    );

    return { message: 'Password has been successfully reset. You may now log in.' };
  }
}

module.exports = AuthService;
