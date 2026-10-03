const express = require('express');
const AuthController = require('./auth.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authenticateToken, AuthController.getMe);
router.post('/change-password', authenticateToken, AuthController.changePassword);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/logout', authenticateToken, AuthController.logout);

module.exports = router;
