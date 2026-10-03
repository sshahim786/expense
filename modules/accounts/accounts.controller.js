const AccountsService = require('./accounts.service');
const ApiResponse = require('../../utils/apiResponse');

class AccountsController {
  static async listAccounts(req, res, next) {
    try {
      const accounts = await AccountsService.listAccounts(req.user.id);
      return ApiResponse.success(res, 'Accounts retrieved successfully', accounts);
    } catch (error) {
      next(error);
    }
  }

  static async createAccount(req, res, next) {
    try {
      const account = await AccountsService.createAccount(req.user.id, req.body);
      return ApiResponse.success(res, 'Account created successfully', account, 201);
    } catch (error) {
      next(error);
    }
  }

  static async listPaymentMethods(req, res, next) {
    try {
      const methods = await AccountsService.listPaymentMethods(req.user.id);
      return ApiResponse.success(res, 'Payment methods retrieved successfully', methods);
    } catch (error) {
      next(error);
    }
  }

  static async createPaymentMethod(req, res, next) {
    try {
      const method = await AccountsService.createPaymentMethod(req.user.id, req.body);
      return ApiResponse.success(res, 'Payment method created successfully', method, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AccountsController;
