const express = require('express');
const router = express.Router();
const DashboardController = require('./dashboard.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

// All dashboard endpoints require authentication
router.use(authenticateToken);

router.get('/summary', DashboardController.getSummary);
router.get('/cash-flow', DashboardController.getCashFlow);
router.get('/category-breakdown', DashboardController.getCategoryBreakdown);
router.get('/recent-transactions', DashboardController.getRecentTransactions);
router.get('/upcoming-dues', DashboardController.getUpcomingDues);
router.get('/budget-status', DashboardController.getBudgetStatus);

module.exports = router;
