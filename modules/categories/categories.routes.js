const express = require('express');
const CategoriesController = require('./categories.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateToken);

router.get('/', CategoriesController.list);
router.post('/', CategoriesController.create);
router.post('/subcategories', CategoriesController.createSubcategory);

module.exports = router;
