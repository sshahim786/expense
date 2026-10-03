const { query } = require('../../config/database');

class AccountsService {
  /**
   * Automatically initializes starter accounts and payment methods for newly registered users.
   */
  static async ensureUserDefaults(userId) {
    const accCount = await query(
      'SELECT COUNT(*) as count FROM financial_accounts WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );

    if (!accCount || accCount[0]?.count === 0) {
      const userRows = await query('SELECT currency FROM users WHERE id = ?', [userId]);
      const currency = userRows[0]?.currency || 'INR';

      await query(
        `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, is_active)
         VALUES 
         (?, 'Primary Bank Account', 'BANK_ACCOUNT', ?, 0.00, 0.00, 1),
         (?, 'Cash in Hand', 'CASH', ?, 0.00, 0.00, 1)`,
        [userId, currency, userId, currency]
      );
    }

    const pmCount = await query(
      'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?',
      [userId]
    );

    if (!pmCount || pmCount[0]?.count === 0) {
      await query(
        `INSERT INTO payment_methods (user_id, name, type, is_default)
         VALUES
         (?, 'Cash', 'CASH', 1),
         (?, 'UPI', 'UPI', 0),
         (?, 'Debit Card', 'DEBIT_CARD', 0),
         (?, 'Credit Card', 'CREDIT_CARD', 0),
         (?, 'Net Banking', 'NET_BANKING', 0)`,
        [userId, userId, userId, userId, userId]
      );
    }
  }

  /**
   * Retrieves all financial accounts for the user.
   */
  static async listAccounts(userId) {
    await this.ensureUserDefaults(userId);

    const accounts = await query(
      `SELECT id, account_name, account_type, currency, opening_balance, current_balance, institution_name, account_number_mask, credit_limit, is_active
       FROM financial_accounts
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY is_active DESC, current_balance DESC`,
      [userId]
    );

    return accounts.map((acc) => ({
      id: acc.id,
      accountName: acc.account_name,
      accountType: acc.account_type,
      currency: acc.currency,
      openingBalance: parseFloat(acc.opening_balance),
      currentBalance: parseFloat(acc.current_balance),
      institutionName: acc.institution_name,
      accountNumberMask: acc.account_number_mask,
      creditLimit: acc.credit_limit ? parseFloat(acc.credit_limit) : null,
      isActive: Boolean(acc.is_active),
    }));
  }

  /**
   * Creates a new financial account for the user.
   */
  static async createAccount(userId, data) {
    const {
      accountName,
      accountType,
      currency = 'INR',
      openingBalance = 0,
      institutionName = null,
      accountNumberMask = null,
      creditLimit = null,
    } = data;

    if (!accountName || !accountName.trim()) {
      const err = new Error('Account name is required');
      err.statusCode = 400;
      throw err;
    }

    const validTypes = ['BANK_ACCOUNT', 'CASH', 'DIGITAL_WALLET', 'SAVINGS', 'CREDIT_CARD'];
    if (!validTypes.includes(accountType)) {
      const err = new Error('Invalid account type');
      err.statusCode = 400;
      throw err;
    }

    const opening = parseFloat(openingBalance) || 0;
    const limit = creditLimit ? parseFloat(creditLimit) : null;
    const mask = accountNumberMask ? accountNumberMask.slice(-4) : null;

    const insertResult = await query(
      `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, institution_name, account_number_mask, credit_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, accountName.trim(), accountType, currency, opening, opening, institutionName, mask, limit]
    );

    return {
      id: insertResult.insertId,
      accountName: accountName.trim(),
      accountType,
      currency,
      openingBalance: opening,
      currentBalance: opening,
      institutionName,
      accountNumberMask: mask,
      creditLimit: limit,
      isActive: true,
    };
  }

  /**
   * Retrieves all payment methods for the user.
   */
  static async listPaymentMethods(userId) {
    await this.ensureUserDefaults(userId);

    const methods = await query(
      `SELECT id, name, type, is_default
       FROM payment_methods
       WHERE user_id = ?
       ORDER BY is_default DESC, name ASC`,
      [userId]
    );

    return methods.map((pm) => ({
      id: pm.id,
      name: pm.name,
      type: pm.type,
      isDefault: Boolean(pm.is_default),
    }));
  }

  /**
   * Creates a new payment method for the user.
   */
  static async createPaymentMethod(userId, data) {
    const { name, type = 'OTHER', isDefault = false } = data;

    if (!name || !name.trim()) {
      const err = new Error('Payment method name is required');
      err.statusCode = 400;
      throw err;
    }

    const insertResult = await query(
      `INSERT INTO payment_methods (user_id, name, type, is_default)
       VALUES (?, ?, ?, ?)`,
      [userId, name.trim(), type, isDefault ? 1 : 0]
    );

    return {
      id: insertResult.insertId,
      name: name.trim(),
      type,
      isDefault: Boolean(isDefault),
    };
  }
}

module.exports = AccountsService;
