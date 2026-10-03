const ExpensesService = require('./expenses.service');
const ApiResponse = require('../../utils/apiResponse');

class ExpensesController {
  static async list(req, res, next) {
    try {
      const result = await ExpensesService.listExpenses(req.user.id, req.query);
      return ApiResponse.success(res, 'Expenses retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const record = await ExpensesService.getExpenseById(req.user.id, req.params.id);
      return ApiResponse.success(res, 'Expense retrieved successfully', record);
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const record = await ExpensesService.createExpense(req.user.id, req.body);
      return ApiResponse.success(res, 'Expense recorded successfully', record, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const record = await ExpensesService.updateExpense(req.user.id, req.params.id, req.body);
      return ApiResponse.success(res, 'Expense updated successfully', record);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const result = await ExpensesService.deleteExpense(req.user.id, req.params.id);
      return ApiResponse.success(res, result.message, {});
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExpensesController;
