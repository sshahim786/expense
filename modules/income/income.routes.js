const express = require('express');
const IncomeController = require('./income.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', IncomeController.list);
router.post('/', IncomeController.create);
router.get('/:id', IncomeController.getById);
router.put('/:id', IncomeController.update);
router.delete('/:id', IncomeController.delete);

module.exports = router;
