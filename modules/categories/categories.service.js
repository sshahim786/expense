const { query } = require('../../config/database');

class CategoriesService {
  /**
   * Retrieves all categories (system defaults + user custom) with subcategories.
   */
  static async listCategories(userId, type = null) {
    let sql = `
      SELECT c.id, c.user_id, c.name, c.type, c.icon, c.color, c.is_system_default
      FROM categories c
      WHERE (c.user_id IS NULL OR c.user_id = ?) AND c.deleted_at IS NULL
    `;
    const params = [userId];

    if (type) {
      sql += ' AND c.type = ?';
      params.push(type.toUpperCase());
    }

    sql += ' ORDER BY c.type DESC, c.name ASC';

    const categories = await query(sql, params);

    // Fetch all applicable subcategories
    const subSql = `
      SELECT s.id, s.category_id, s.name, s.user_id
      FROM subcategories s
      WHERE s.user_id IS NULL OR s.user_id = ?
      ORDER BY s.name ASC
    `;
    const subcategories = await query(subSql, [userId]);

    const subMap = {};
    subcategories.forEach((s) => {
      if (!subMap[s.category_id]) subMap[s.category_id] = [];
      subMap[s.category_id].push(s);
    });

    return categories.map((cat) => ({
      ...cat,
      isSystemDefault: Boolean(cat.is_system_default),
      subcategories: subMap[cat.id] || [],
    }));
  }

  /**
   * Creates a user-specific custom category.
   */
  static async createCategory(userId, data) {
    const { name, type, icon = 'category', color = '#6366F1' } = data;

    if (!name || !name.trim()) {
      const err = new Error('Category name is required');
      err.statusCode = 400;
      throw err;
    }

    if (!['INCOME', 'EXPENSE'].includes(type?.toUpperCase())) {
      const err = new Error('Type must be either INCOME or EXPENSE');
      err.statusCode = 400;
      throw err;
    }

    const insertResult = await query(
      `INSERT INTO categories (user_id, name, type, icon, color, is_system_default)
       VALUES (?, ?, ?, ?, ?, FALSE)`,
      [userId, name.trim(), type.toUpperCase(), icon, color]
    );

    return {
      id: insertResult.insertId,
      userId,
      name: name.trim(),
      type: type.toUpperCase(),
      icon,
      color,
      isSystemDefault: false,
      subcategories: [],
    };
  }

  /**
   * Creates a user-specific subcategory under a category.
   */
  static async createSubcategory(userId, data) {
    const { categoryId, name } = data;

    if (!name || !name.trim()) {
      const err = new Error('Subcategory name is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify category exists and is accessible
    const cats = await query(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)',
      [categoryId, userId]
    );

    if (!cats || cats.length === 0) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    const insertResult = await query(
      'INSERT INTO subcategories (category_id, user_id, name) VALUES (?, ?, ?)',
      [categoryId, userId, name.trim()]
    );

    return {
      id: insertResult.insertId,
      categoryId,
      userId,
      name: name.trim(),
    };
  }
}

module.exports = CategoriesService;
