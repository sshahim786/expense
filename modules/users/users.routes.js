const express = require('express');
const UsersController = require('./users.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken); // Protect all routes in this module

router.get('/profile', UsersController.getProfile);
router.put('/profile', UsersController.updateProfile);
router.get('/settings', UsersController.getSettings);
router.put('/settings', UsersController.updateSettings);

module.exports = router;
