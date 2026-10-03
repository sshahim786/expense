const { query, transaction } = require('../../config/database');

class IncomeService {
  /**
   * Retrieves paginated income records for the authenticated user with filtering.
   */
  static async listIncome(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      startDate = null,
      endDate = null,
      categoryId = null,
      accountId = null,
      search = null,
      sortBy = 'income_date',
      sortOrder = 'DESC',
    } = filters;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = 'WHERE i.user_id = ? AND i.deleted_at IS NULL';
    const params = [userId];

    if (startDate) {
      whereClause += ' AND i.income_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND i.income_date <= ?';
      params.push(endDate);
    }

    if (categoryId) {
      whereClause += ' AND i.category_id = ?';
      params.push(categoryId);
    }

    if (accountId) {
      whereClause += ' AND i.account_id = ?';
      params.push(accountId);
    }

    if (search && search.trim()) {
      whereClause += ' AND (i.source_name LIKE ? OR i.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Total Count & Sum in filtered range
    const summarySql = `
      SELECT COUNT(*) as total_count, COALESCE(SUM(i.amount), 0) as total_amount
      FROM income i
      ${whereClause}
    `;
    const summaryRows = await query(summarySql, params);
    const totalCount = summaryRows[0].total_count;
    const totalAmount = parseFloat(summaryRows[0].total_amount);

    // Allowed sort columns
    const allowedSort = ['income_date', 'amount', 'source_name', 'created_at'];
    const safeSortBy = allowedSort.includes(sortBy) ? `i.${sortBy}` : 'i.income_date';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const listSql = `
      SELECT i.id, i.amount, i.income_date, i.frequency, i.source_name, i.description, i.is_recurring, i.created_at,
             c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
             a.id as account_id, a.account_name, a.currency,
             pm.id as payment_method_id, pm.name as payment_method_name
      FROM income i
      JOIN categories c ON c.id = i.category_id
      JOIN financial_accounts a ON a.id = i.account_id
      LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const records = await query(listSql, [...params, parsedLimit, offset]);

    return {
      records: records.map((r) => ({
        id: r.id,
        amount: parseFloat(r.amount),
        incomeDate: r.income_date,
        frequency: r.frequency,
        sourceName: r.source_name,
        description: r.description,
        isRecurring: Boolean(r.is_recurring),
        createdAt: r.created_at,
        category: {
          id: r.category_id,
          name: r.category_name,
          color: r.category_color,
          icon: r.category_icon,
        },
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
   * Retrieves single income record strictly scoped to authenticated user.
   */
  static async getIncomeById(userId, incomeId) {
    const rows = await query(
      `SELECT i.*, c.name as category_name, a.account_name, pm.name as payment_method_name
       FROM income i
       JOIN categories c ON c.id = i.category_id
       JOIN financial_accounts a ON a.id = i.account_id
       LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
       WHERE i.id = ? AND i.user_id = ? AND i.deleted_at IS NULL
       LIMIT 1`,
      [incomeId, userId]
    );

    if (!rows || rows.length === 0) {
      const err = new Error('Income record not found');
      err.statusCode = 404;
      throw err;
    }

    const r = rows[0];
    return {
      id: r.id,
      amount: parseFloat(r.amount),
      incomeDate: r.income_date,
      frequency: r.frequency,
      sourceName: r.source_name,
      description: r.description,
      isRecurring: Boolean(r.is_recurring),
      categoryId: r.category_id,
      categoryName: r.category_name,
      accountId: r.account_id,
      accountName: r.account_name,
      paymentMethodId: r.payment_method_id,
      paymentMethodName: r.payment_method_name,
      createdAt: r.created_at,
    };
  }

  /**
   * Creates an income record and increments account balance atomically.
   */
  static async createIncome(userId, data) {
    const {
      amount,
      incomeDate,
      sourceName,
      categoryId,
      accountId,
      paymentMethodId = null,
      frequency = 'ONE_TIME',
      description = null,
      isRecurring = false,
    } = data;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      const err = new Error('Valid positive amount is required');
      err.statusCode = 400;
      throw err;
    }

    if (!sourceName || !sourceName.trim()) {
      const err = new Error('Income source name is required');
      err.statusCode = 400;
      throw err;
    }

    if (!incomeDate) {
      const err = new Error('Income date is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify account belongs to user
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
      // 1. Insert income record
      const [insertRes] = await conn.query(
        `INSERT INTO income (user_id, account_id, category_id, payment_method_id, amount, income_date, frequency, source_name, description, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          accountId,
          categoryId,
          paymentMethodId || null,
          parsedAmount,
          incomeDate,
          frequency,
          sourceName.trim(),
          description ? description.trim() : null,
          isRecurring ? 1 : 0,
        ]
      );

      const incomeId = insertRes.insertId;

      // 2. Rule 1: Income increases available balance
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
        [parsedAmount, accountId]
      );

      // 3. Insert into unified transaction ledger
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, category_id, payment_method_id, amount, transaction_date, description, reference_type, reference_id)
         VALUES (?, ?, 'INCOME', ?, ?, ?, ?, ?, 'INCOME', ?)`,
        [
          userId,
          accountId,
          categoryId,
          paymentMethodId || null,
          parsedAmount,
          incomeDate,
          sourceName.trim(),
          incomeId,
        ]
      );

      return {
        id: incomeId,
        amount: parsedAmount,
        incomeDate,
        frequency,
        sourceName: sourceName.trim(),
        accountId,
        categoryId,
      };
    });
  }

  /**
   * Updates income record and adjusts account balance atomically.
   */
  static async updateIncome(userId, incomeId, data) {
    const existing = await query(
      'SELECT * FROM income WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [incomeId, userId]
    );

    if (!existing || existing.length === 0) {
      const err = new Error('Income record not found');
      err.statusCode = 404;
      throw err;
    }

    const prev = existing[0];
    const prevAmount = parseFloat(prev.amount);
    const newAmount = data.amount !== undefined ? parseFloat(data.amount) : prevAmount;
    const newAccountId = data.accountId || prev.account_id;
    const newSource = data.sourceName !== undefined ? data.sourceName.trim() : prev.source_name;
    const newDate = data.incomeDate || prev.income_date;
    const newCat = data.categoryId || prev.category_id;
    const newPm = data.paymentMethodId !== undefined ? data.paymentMethodId : prev.payment_method_id;
    const newDesc = data.description !== undefined ? data.description : prev.description;
    const newFreq = data.frequency || prev.frequency;

    return await transaction(async (conn) => {
      // Balance Adjustment:
      if (prev.account_id === newAccountId) {
        const diff = newAmount - prevAmount;
        if (diff !== 0) {
          await conn.query(
            'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
            [diff, newAccountId]
          );
        }
      } else {
        // Revert from old account, add to new account
        await conn.query(
          'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
          [prevAmount, prev.account_id]
        );
        await conn.query(
          'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
          [newAmount, newAccountId]
        );
      }

      // Update income record
      await conn.query(
        `UPDATE income
         SET amount = ?, income_date = ?, source_name = ?, category_id = ?, account_id = ?, payment_method_id = ?, description = ?, frequency = ?
         WHERE id = ? AND user_id = ?`,
        [newAmount, newDate, newSource, newCat, newAccountId, newPm, newDesc, newFreq, incomeId, userId]
      );

      // Update transaction ledger
      await conn.query(
        `UPDATE transactions
         SET amount = ?, transaction_date = ?, description = ?, category_id = ?, account_id = ?, payment_method_id = ?
         WHERE reference_type = 'INCOME' AND reference_id = ? AND user_id = ?`,
        [newAmount, newDate, newSource, newCat, newAccountId, newPm, incomeId, userId]
      );

      return {
        id: incomeId,
        amount: newAmount,
        incomeDate: newDate,
        sourceName: newSource,
      };
    });
  }

  /**
   * Soft deletes income and reverts account balance.
   */
  static async deleteIncome(userId, incomeId) {
    const existing = await query(
      'SELECT * FROM income WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
      [incomeId, userId]
    );

    if (!existing || existing.length === 0) {
      const err = new Error('Income record not found');
      err.statusCode = 404;
      throw err;
    }

    const record = existing[0];
    const amount = parseFloat(record.amount);

    return await transaction(async (conn) => {
      // 1. Revert balance (deduct what was previously added)
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
        [amount, record.account_id]
      );

      // 2. Soft delete income
      await conn.query(
        'UPDATE income SET deleted_at = NOW() WHERE id = ? AND user_id = ?',
        [incomeId, userId]
      );

      // 3. Soft delete transaction ledger entry
      await conn.query(
        'UPDATE transactions SET deleted_at = NOW() WHERE reference_type = \'INCOME\' AND reference_id = ? AND user_id = ?',
        [incomeId, userId]
      );

      return { message: 'Income record deleted successfully' };
    });
  }
}

module.exports = IncomeService;
