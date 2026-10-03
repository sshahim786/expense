const DashboardService = require('./dashboard.service');
const ApiResponse = require('../../utils/ApiResponse');

class DashboardController {
  static async getSummary(req, res, next) {
    try {
      const summary = await DashboardService.getSummaryMetrics(req.user.id);
      return ApiResponse.success(res, 'Dashboard summary retrieved successfully', summary);
    } catch (err) {
      next(err);
    }
  }

  static async getCashFlow(req, res, next) {
    try {
      const months = req.query.months || 6;
      const data = await DashboardService.getCashFlow(req.user.id, months);
      return ApiResponse.success(res, 'Cash flow trajectory retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getCategoryBreakdown(req, res, next) {
    try {
      const data = await DashboardService.getCategoryBreakdown(req.user.id);
      return ApiResponse.success(res, 'Category breakdown retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getRecentTransactions(req, res, next) {
    try {
      const limit = req.query.limit || 7;
      const data = await DashboardService.getRecentTransactions(req.user.id, limit);
      return ApiResponse.success(res, 'Recent transactions retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getUpcomingDues(req, res, next) {
    try {
      const days = req.query.days || 14;
      const data = await DashboardService.getUpcomingDues(req.user.id, days);
      return ApiResponse.success(res, 'Upcoming dues retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }

  static async getBudgetStatus(req, res, next) {
    try {
      const data = await DashboardService.getBudgetStatus(req.user.id);
      return ApiResponse.success(res, 'Budget status retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DashboardController;
