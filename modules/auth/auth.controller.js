const AuthService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');

class AuthController {
  static async register(req, res, next) {
    try {
      const meta = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const result = await AuthService.register(req.body, meta);
      return ApiResponse.success(res, 'Registration successful', result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const meta = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const result = await AuthService.login(req.body, meta);
      return ApiResponse.success(res, 'Login successful', result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      return ApiResponse.success(res, 'User profile fetched successfully', {
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const meta = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const result = await AuthService.changePassword(req.user.id, req.body, meta);
      return ApiResponse.success(res, result.message, {}, 200);
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const meta = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const result = await AuthService.forgotPassword(req.body.email, meta);
      return ApiResponse.success(res, result.message, result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const meta = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const { token, newPassword, confirmNewPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword, confirmNewPassword, meta);
      return ApiResponse.success(res, result.message, {}, 200);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      // In stateless JWT, client deletes token. We log audit event.
      if (req.user && req.user.id) {
        const { query } = require('../../config/database');
        await query(
          `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
           VALUES (?, 'LOGOUT', 'AUTH', ?, ?)`,
          [req.user.id, req.ip || null, req.headers['user-agent'] || null]
        );
      }
      return ApiResponse.success(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
