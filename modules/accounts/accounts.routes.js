const express = require('express');
const AccountsController = require('./accounts.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', AccountsController.listAccounts);
router.post('/', AccountsController.createAccount);
router.get('/payment-methods', AccountsController.listPaymentMethods);
router.post('/payment-methods', AccountsController.createPaymentMethod);

module.exports = router;
