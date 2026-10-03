const express = require('express');
const TransactionsController = require('./transactions.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', TransactionsController.list);
router.post('/transfer', TransactionsController.transfer);

module.exports = router;
