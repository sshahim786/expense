const IncomeService = require('./income.service');
const ApiResponse = require('../../utils/apiResponse');

class IncomeController {
  static async list(req, res, next) {
    try {
      const result = await IncomeService.listIncome(req.user.id, req.query);
      return ApiResponse.success(res, 'Income records retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const record = await IncomeService.getIncomeById(req.user.id, req.params.id);
      return ApiResponse.success(res, 'Income record retrieved', record);
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const record = await IncomeService.createIncome(req.user.id, req.body);
      return ApiResponse.success(res, 'Income recorded successfully', record, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const record = await IncomeService.updateIncome(req.user.id, req.params.id, req.body);
      return ApiResponse.success(res, 'Income record updated successfully', record);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const result = await IncomeService.deleteIncome(req.user.id, req.params.id);
      return ApiResponse.success(res, result.message, {});
    } catch (error) {
      next(error);
    }
  }
}

module.exports = IncomeController;
