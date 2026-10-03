const express = require('express');
const ExpensesController = require('./expenses.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', ExpensesController.list);
router.post('/', ExpensesController.create);
router.get('/:id', ExpensesController.getById);
router.put('/:id', ExpensesController.update);
router.delete('/:id', ExpensesController.delete);

module.exports = router;
