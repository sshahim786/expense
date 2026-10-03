const TransactionsService = require('./transactions.service');
const ApiResponse = require('../../utils/apiResponse');

class TransactionsController {
  static async list(req, res, next) {
    try {
      const result = await TransactionsService.listTransactions(req.user.id, req.query);
      return ApiResponse.success(res, 'Transactions retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async transfer(req, res, next) {
    try {
      const result = await TransactionsService.createTransfer(req.user.id, req.body);
      return ApiResponse.success(res, 'Funds transferred successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TransactionsController;
