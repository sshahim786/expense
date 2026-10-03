const CategoriesService = require('./categories.service');
const ApiResponse = require('../../utils/apiResponse');

class CategoriesController {
  static async list(req, res, next) {
    try {
      const type = req.query.type || null;
      const categories = await CategoriesService.listCategories(req.user.id, type);
      return ApiResponse.success(res, 'Categories retrieved successfully', categories);
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const category = await CategoriesService.createCategory(req.user.id, req.body);
      return ApiResponse.success(res, 'Category created successfully', category, 201);
    } catch (error) {
      next(error);
    }
  }

  static async createSubcategory(req, res, next) {
    try {
      const sub = await CategoriesService.createSubcategory(req.user.id, req.body);
      return ApiResponse.success(res, 'Subcategory created successfully', sub, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CategoriesController;
