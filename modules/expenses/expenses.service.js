const { query, transaction } = require('../../config/database');

class ExpensesService {
  /**
   * Retrieves paginated expenses for the authenticated user with filtering.
   */
  static async listExpenses(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      startDate = null,
      endDate = null,
      categoryId = null,
      subcategoryId = null,
      accountId = null,
      paymentMethodId = null,
      search = null,
      minAmount = null,
      maxAmount = null,
      sortBy = 'expense_date',
      sortOrder = 'DESC',
    } = filters;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = 'WHERE e.user_id = ? AND e.deleted_at IS NULL';
    const params = [userId];

    if (startDate) {
      whereClause += ' AND e.expense_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND e.expense_date <= ?';
      params.push(endDate);
    }

    if (categoryId) {
      whereClause += ' AND e.category_id = ?';
      params.push(categoryId);
    }

    if (subcategoryId) {
      whereClause += ' AND e.subcategory_id = ?';
      params.push(subcategoryId);
    }

    if (accountId) {
      whereClause += ' AND e.account_id = ?';
      params.push(accountId);
    }

    if (paymentMethodId) {
      whereClause += ' AND e.payment_method_id = ?';
      params.push(paymentMethodId);
    }

    if (minAmount !== null && minAmount !== '') {
      whereClause += ' AND e.amount >= ?';
      params.push(parseFloat(minAmount));
    }

    if (maxAmount !== null && maxAmount !== '') {
      whereClause += ' AND e.amount <= ?';
      params.push(parseFloat(maxAmount));
    }

    if (search && search.trim()) {
      whereClause += ' AND (e.description LIKE ? OR e.notes LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Summary calculations
    const summarySql = `
      SELECT COUNT(*) as total_count, COALESCE(SUM(e.amount), 0) as total_amount
      FROM expenses e
      ${whereClause}
    `;
    const summaryRows = await query(summarySql, params);
    const totalCount = summaryRows[0].total_count;
    const totalAmount = parseFloat(summaryRows[0].total_amount);

    const allowedSort = ['expense_date', 'amount', 'description', 'created_at'];
    const safeSortBy = allowedSort.includes(sortBy) ? `e.${sortBy}` : 'e.expense_date';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const listSql = `
      SELECT e.id, e.amount, e.expense_date, e.description, e.notes, e.is_recurring, e.created_at,
             c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
             s.id as subcategory_id, s.name as subcategory_name,
             a.id as account_id, a.account_name, a.currency,
             pm.id as payment_method_id, pm.name as payment_method_name
      FROM expenses e
      JOIN categories c ON c.id = e.category_id
      JOIN financial_accounts a ON a.id = e.account_id
      LEFT JOIN subcategories s ON s.id = e.subcategory_id
      LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const records = await query(listSql, [...params, parsedLimit, offset]);

    return {
      records: records.map((r) => ({
        id: r.id,
        amount: parseFloat(r.amount),
        expenseDate: r.expense_date,
        description: r.description,
        notes: r.notes,
        isRecurring: Boolean(r.is_recurring),
        createdAt: r.created_at,
        category: {
          id: r.category_id,
          name: r.category_name,
          color: r.category_color,
          icon: r.category_icon,
        },
        subcategory: r.subcategory_id
          ? {
              id: r.subcategory_id,
              name: r.subcategory_name,
            }
          : null,
        account: {
          id: r.account_id,
          name: r.account_name,
          currency: r.currency,
        },
        paymentMethod: r.payment_method_id
          ? {
              id: r.payment_method_id,
              name: r.payment_method_name,
            }
          : null,
      })),
      pagination: {
        totalRecords: totalCount,
        page: parseInt(page, 10),
        limit: parsedLimit,
        totalPages: Math.ceil(totalCount / parsedLimit) || 1,
      },
      summary: {
        totalAmount,
      },
    };
  }

  /**
   * Retrieves single expense by ID strictly scoped to user.
   */
  static async getExpenseById(userId, expenseId) {
    const rows = await query(
      `SELECT e.*, c.name as category_name, a.account_name, s.name as subcategory_name, pm.name as payment_method_name
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       JOIN financial_accounts a ON a.id = e.account_id
       LEFT JOIN subcategories s ON s.id = e.subcategory_id
       LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
       WHERE e.id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       LIMIT 1`,
      [expenseId, userId]
    );

    if (!rows || rows.length === 0) {
      const err = new Error('Expense record not found');
      err.statusCode = 404;
      throw err;
    }

    const r = rows[0];
    return {
      id: r.id,
      amount: parseFloat(r.amount),
      expenseDate: r.expense_date,
      description: r.description,
      notes: r.notes,
      isRecurring: Boolean(r.is_recurring),
      categoryId: r.category_id,
      categoryName: r.category_name,
      subcategoryId: r.subcategory_id,
      subcategoryName: r.subcategory_name,
      accountId: r.account_id,
      accountName: r.account_name,
      paymentMethodId: r.payment_method_id,
      paymentMethodName: r.payment_method_name,
      createdAt: r.created_at,
    };
  }

  /**
   * Creates an expense, decrements account balance, and writes to transactions ledger.
   */
  static async createExpense(userId, data) {
    const {
      amount,
      expenseDate,
      description,
      categoryId,
      subcategoryId = null,
      accountId,
      paymentMethodId = null,
      notes = null,
      isRecurring = false,
    } = data;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      const err = new Error('Valid positive amount is required');
      err.statusCode = 400;
      throw err;
    }

    if (!description || !description.trim()) {
      const err = new Error('Description is required');
      err.statusCode = 400;
      throw err;
    }

    if (!expenseDate) {
      const err = new Error('Expense date is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify account exists & belongs to user
    const accCheck = await query(
      'SELECT id, current_balance FROM financial_accounts WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [accountId, userId]
    );

    if (!accCheck || accCheck.length === 0) {
      const err = new Error('Selected financial account was not found');
      err.statusCode = 400;
      throw err;
    }

    return await transaction(async (conn) => {
      // 1. Insert expense record
      const [insertRes] = await conn.query(
        `INSERT INTO expenses (user_id, account_id, category_id, subcategory_id, payment_method_id, amount, expense_date, description, notes, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          accountId,
          categoryId,
          subcategoryId || null,
          paymentMethodId || null,
          parsedAmount,
          expenseDate,
          description.trim(),
          notes ? notes.trim() : null,
          isRecurring ? 1 : 0,
        ]
      );

      const expenseId = insertRes.insertId;

      // 2. Rule 2: Expense decreases available balance
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
        [parsedAmount, accountId]
      );

      // 3. Insert into unified transaction ledger
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, category_id, subcategory_id, payment_method_id, amount, transaction_date, description, reference_type, reference_id)
         VALUES (?, ?, 'EXPENSE', ?, ?, ?, ?, ?, ?, 'EXPENSE', ?)`,
        [
          userId,
          accountId,
          categoryId,
          subcategoryId || null,
          paymentMethodId || null,
          parsedAmount,
          expenseDate,
          description.trim(),
          expenseId,
        ]
      );

      return {
        id: expenseId,
        amount: parsedAmount,
        expenseDate,
        description: description.trim(),
        accountId,
        categoryId,
      };
    });
  }

  /**
   * Updates expense record and synchronizes balance differences.
   */
  static async updateExpense(userId, expenseId, data) {
    const existing = await query(
      'SELECT * FROM expenses WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [expenseId, userId]
    );

    if (!existing || existing.length === 0) {
      const err = new Error('Expense record not found');
      err.statusCode = 404;
      throw err;
    }

    const prev = existing[0];
    const prevAmount = parseFloat(prev.amount);
    const newAmount = data.amount !== undefined ? parseFloat(data.amount) : prevAmount;
    const newAccountId = data.accountId || prev.account_id;
    const newDesc = data.description !== undefined ? data.description.trim() : prev.description;
    const newDate = data.expenseDate || prev.expense_date;
    const newCat = data.categoryId || prev.category_id;
    const newSubCat = data.subcategoryId !== undefined ? data.subcategoryId : prev.subcategory_id;
    const newPm = data.paymentMethodId !== undefined ? data.paymentMethodId : prev.payment_method_id;
    const newNotes = data.notes !== undefined ? data.notes : prev.notes;

    return await transaction(async (conn) => {
      // Balance Adjustment:
      if (prev.account_id === newAccountId) {
        const diff = newAmount - prevAmount;
        if (diff !== 0) {
          // If expense increased, decrease balance; if expense decreased, increase balance
          await conn.query(
            'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
            [diff, newAccountId]
          );
        }
      } else {
        // Revert from old account (add back), deduct from new account
        await conn.query(
          'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
          [prevAmount, prev.account_id]
        );
        await conn.query(
          'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
          [newAmount, newAccountId]
        );
      }

      // Update expense
      await conn.query(
        `UPDATE expenses
         SET amount = ?, expense_date = ?, description = ?, category_id = ?, subcategory_id = ?, account_id = ?, payment_method_id = ?, notes = ?
         WHERE id = ? AND user_id = ?`,
        [newAmount, newDate, newDesc, newCat, newSubCat, newAccountId, newPm, newNotes, expenseId, userId]
      );

      // Update transaction ledger
      await conn.query(
        `UPDATE transactions
         SET amount = ?, transaction_date = ?, description = ?, category_id = ?, subcategory_id = ?, account_id = ?, payment_method_id = ?
         WHERE reference_type = 'EXPENSE' AND reference_id = ? AND user_id = ?`,
        [newAmount, newDate, newDesc, newCat, newSubCat, newAccountId, newPm, expenseId, userId]
      );

      return {
        id: expenseId,
        amount: newAmount,
        expenseDate: newDate,
        description: newDesc,
      };
    });
  }

  /**
   * Soft deletes expense and restores account balance.
   */
  static async deleteExpense(userId, expenseId) {
    const existing = await query(
      'SELECT * FROM expenses WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [expenseId, userId]
    );

    if (!existing || existing.length === 0) {
      const err = new Error('Expense record not found');
      err.statusCode = 404;
      throw err;
    }

    const record = existing[0];
    const amount = parseFloat(record.amount);

    return await transaction(async (conn) => {
      // 1. Rule 6: Revert balance (add back deducted amount)
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
        [amount, record.account_id]
      );

      // 2. Soft delete expense
      await conn.query(
        'UPDATE expenses SET deleted_at = NOW() WHERE id = ? AND user_id = ?',
        [expenseId, userId]
      );

      // 3. Soft delete transaction ledger entry
      await conn.query(
        'UPDATE transactions SET deleted_at = NOW() WHERE reference_type = \'EXPENSE\' AND reference_id = ? AND user_id = ?',
        [expenseId, userId]
      );

      return { message: 'Expense deleted successfully' };
    });
  }
}

module.exports = ExpensesService;
