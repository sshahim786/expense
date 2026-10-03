const UsersService = require('./users.service');
const ApiResponse = require('../../utils/apiResponse');

class UsersController {
  static async getProfile(req, res, next) {
    try {
      const result = await UsersService.getProfile(req.user.id);
      return ApiResponse.success(res, 'User profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const result = await UsersService.updateProfile(req.user.id, req.body);
      return ApiResponse.success(res, 'Profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req, res, next) {
    try {
      const result = await UsersService.getProfile(req.user.id);
      return ApiResponse.success(res, 'Settings retrieved successfully', result.settings);
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const result = await UsersService.updateSettings(req.user.id, req.body);
      return ApiResponse.success(res, 'Settings updated successfully', result.settings);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UsersController;
