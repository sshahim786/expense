const { query, transaction } = require('../../config/database');

class TransactionsService {
  /**
   * Retrieves unified financial transaction ledger with filtering.
   */
  static async listTransactions(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      type = null,
      startDate = null,
      endDate = null,
      accountId = null,
      search = null,
      sortBy = 'transaction_date',
      sortOrder = 'DESC',
    } = filters;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = 'WHERE t.user_id = ? AND t.deleted_at IS NULL';
    const params = [userId];

    if (type) {
      whereClause += ' AND t.type = ?';
      params.push(type.toUpperCase());
    }

    if (startDate) {
      whereClause += ' AND t.transaction_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND t.transaction_date <= ?';
      params.push(endDate);
    }

    if (accountId) {
      whereClause += ' AND t.account_id = ?';
      params.push(accountId);
    }

    if (search && search.trim()) {
      whereClause += ' AND t.description LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    // Summary calculation
    const summarySql = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN t.type = 'TRANSFER' THEN t.amount ELSE 0 END), 0) as total_transfers
      FROM transactions t
      ${whereClause}
    `;
    const summaryRows = await query(summarySql, params);
    const summary = summaryRows[0];

    const allowedSort = ['transaction_date', 'amount', 'created_at', 'type'];
    const safeSortBy = allowedSort.includes(sortBy) ? `t.${sortBy}` : 't.transaction_date';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const listSql = `
      SELECT t.id, t.type, t.amount, t.transaction_date, t.description, t.reference_type, t.reference_id, t.created_at,
             a.id as account_id, a.account_name, a.currency,
             c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
             pm.id as payment_method_id, pm.name as payment_method_name
      FROM transactions t
      JOIN financial_accounts a ON a.id = t.account_id
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const records = await query(listSql, [...params, parsedLimit, offset]);

    return {
      records: records.map((r) => ({
        id: r.id,
        type: r.type,
        amount: parseFloat(r.amount),
        transactionDate: r.transaction_date,
        description: r.description,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        createdAt: r.created_at,
        account: {
          id: r.account_id,
          name: r.account_name,
          currency: r.currency,
        },
        category: r.category_id
          ? {
              id: r.category_id,
              name: r.category_name,
              color: r.category_color,
              icon: r.category_icon,
            }
          : null,
        paymentMethod: r.payment_method_id
          ? {
              id: r.payment_method_id,
              name: r.payment_method_name,
            }
          : null,
      })),
      pagination: {
        totalRecords: summary.total_count,
        page: parseInt(page, 10),
        limit: parsedLimit,
        totalPages: Math.ceil(summary.total_count / parsedLimit) || 1,
      },
      summary: {
        totalIncome: parseFloat(summary.total_income),
        totalExpense: parseFloat(summary.total_expense),
        totalTransfers: parseFloat(summary.total_transfers),
      },
    };
  }

  /**
   * Executes internal money transfer between user's own accounts.
   * Rule 3: Transfers must NOT count as expenses!
   */
  static async createTransfer(userId, data) {
    const { fromAccountId, toAccountId, amount, transferDate, transferFee = 0, notes = null } = data;

    const parsedAmount = parseFloat(amount);
    const parsedFee = parseFloat(transferFee) || 0;

    if (!parsedAmount || parsedAmount <= 0) {
      const err = new Error('Transfer amount must be greater than zero');
      err.statusCode = 400;
      throw err;
    }

    if (!fromAccountId || !toAccountId) {
      const err = new Error('Both source and destination accounts are required');
      err.statusCode = 400;
      throw err;
    }

    if (parseInt(fromAccountId, 10) === parseInt(toAccountId, 10)) {
      const err = new Error('Source and destination accounts must be different');
      err.statusCode = 400;
      throw err;
    }

    if (!transferDate) {
      const err = new Error('Transfer date is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify both accounts belong to user
    const accounts = await query(
      'SELECT id, account_name, current_balance FROM financial_accounts WHERE id IN (?, ?) AND user_id = ? AND deleted_at IS NULL',
      [fromAccountId, toAccountId, userId]
    );

    if (accounts.length < 2) {
      const err = new Error('One or both selected accounts do not exist or belong to another user');
      err.statusCode = 400;
      throw err;
    }

    const fromAcc = accounts.find((a) => a.id === parseInt(fromAccountId, 10));
    const toAcc = accounts.find((a) => a.id === parseInt(toAccountId, 10));

    return await transaction(async (conn) => {
      // 1. Deduct from source account (amount + fee)
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance - ? WHERE id = ?',
        [parsedAmount + parsedFee, fromAccountId]
      );

      // 2. Add to destination account (amount)
      await conn.query(
        'UPDATE financial_accounts SET current_balance = current_balance + ? WHERE id = ?',
        [parsedAmount, toAccountId]
      );

      // 3. Record in account_transfers
      const [insertTransfer] = await conn.query(
        `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date, transfer_fee, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, fromAccountId, toAccountId, parsedAmount, transferDate, parsedFee, notes ? notes.trim() : null]
      );

      const transferId = insertTransfer.insertId;

      // 4. Log in unified transaction ledger (Rule 3: Recorded as TRANSFER, not EXPENSE)
      await conn.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, transaction_date, description, reference_type, reference_id)
         VALUES (?, ?, 'TRANSFER', ?, ?, ?, 'TRANSFER', ?)`,
        [
          userId,
          fromAccountId,
          parsedAmount,
          transferDate,
          `Transfer from ${fromAcc.account_name} to ${toAcc.account_name}`,
          transferId,
        ]
      );

      return {
        id: transferId,
        fromAccountId,
        toAccountId,
        fromAccountName: fromAcc.account_name,
        toAccountName: toAcc.account_name,
        amount: parsedAmount,
        transferFee: parsedFee,
        transferDate,
        notes,
      };
    });
  }
}

module.exports = TransactionsService;
