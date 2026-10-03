const { initDatabase, query, transaction } = require('../config/database');
const SYSTEM_CATEGORIES = require('./systemCategories');

async function runMigrations() {
  console.log('==================================================');
  console.log('[Migration] Starting Database Schema Migration...');
  console.log('==================================================');

  await initDatabase();

  // 1. Users Table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      mobile_number VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      country VARCHAR(100) NOT NULL DEFAULT 'India',
      timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
      avatar_url VARCHAR(500) NULL,
      status ENUM('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'ACTIVE',
      reset_password_token VARCHAR(255) NULL,
      reset_password_expires DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      INDEX idx_users_email (email),
      INDEX idx_users_status (status)
    ) ENGINE=InnoDB;
  `);

  // 2. User Settings Table
  await query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
      theme ENUM('LIGHT', 'DARK', 'SYSTEM') NOT NULL DEFAULT 'LIGHT',
      default_dashboard_period ENUM('THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR') NOT NULL DEFAULT 'THIS_MONTH',
      notify_bill_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      notify_budget_alerts BOOLEAN NOT NULL DEFAULT TRUE,
      notify_emi_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      notify_subscription_renewals BOOLEAN NOT NULL DEFAULT TRUE,
      budget_alert_threshold INT UNSIGNED NOT NULL DEFAULT 80,
      custom_widgets JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // 3. Categories Table
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      name VARCHAR(100) NOT NULL,
      type ENUM('INCOME', 'EXPENSE') NOT NULL,
      icon VARCHAR(100) NOT NULL DEFAULT 'category',
      color VARCHAR(20) NOT NULL DEFAULT '#6366F1',
      is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_categories_user_type (user_id, type)
    ) ENGINE=InnoDB;
  `);

  // 4. Subcategories Table
  await query(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_subcategories_category (category_id)
    ) ENGINE=InnoDB;
  `);

  // 5. Financial Accounts Table
  await query(`
    CREATE TABLE IF NOT EXISTS financial_accounts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      account_name VARCHAR(150) NOT NULL,
      account_type ENUM('BANK_ACCOUNT', 'CASH', 'DIGITAL_WALLET', 'SAVINGS', 'CREDIT_CARD') NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      institution_name VARCHAR(150) NULL,
      account_number_mask VARCHAR(10) NULL,
      credit_limit DECIMAL(15, 2) NULL,
      billing_cycle_day INT UNSIGNED NULL,
      due_date_day INT UNSIGNED NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_accounts_user (user_id, is_active)
    ) ENGINE=InnoDB;
  `);

  // 6. Payment Methods Table
  await query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      type ENUM('CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET', 'OTHER') NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_payment_methods_user (user_id)
    ) ENGINE=InnoDB;
  `);

  // 7. Attachments Table
  await query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size_bytes BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_attachments_user (user_id)
    ) ENGINE=InnoDB;
  `);

  // 8. Recurring Transactions Schedule Table
  await query(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      type ENUM('INCOME', 'EXPENSE') NOT NULL,
      category_id BIGINT UNSIGNED NOT NULL,
      subcategory_id BIGINT UNSIGNED NULL,
      account_id BIGINT UNSIGNED NOT NULL,
      payment_method_id BIGINT UNSIGNED NULL,
      title VARCHAR(200) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      next_execution_date DATE NOT NULL,
      last_executed_date DATE NULL,
      day_of_month INT UNSIGNED NULL,
      day_of_week INT UNSIGNED NULL,
      status ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      INDEX idx_recurring_user_status (user_id, status),
      INDEX idx_recurring_execution (next_execution_date, status)
    ) ENGINE=InnoDB;
  `);

  // 9. Income Records Table
  await query(`
    CREATE TABLE IF NOT EXISTS income (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      account_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NOT NULL,
      payment_method_id BIGINT UNSIGNED NULL,
      recurring_id BIGINT UNSIGNED NULL,
      amount DECIMAL(15, 2) NOT NULL,
      income_date DATE NOT NULL,
      frequency ENUM('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'ONE_TIME',
      source_name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY (recurring_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL,
      INDEX idx_income_user_date (user_id, income_date),
      INDEX idx_income_user_category (user_id, category_id)
    ) ENGINE=InnoDB;
  `);

  // 10. Expense Records Table
  await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      account_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NOT NULL,
      subcategory_id BIGINT UNSIGNED NULL,
      payment_method_id BIGINT UNSIGNED NULL,
      recurring_id BIGINT UNSIGNED NULL,
      attachment_id BIGINT UNSIGNED NULL,
      amount DECIMAL(15, 2) NOT NULL,
      expense_date DATE NOT NULL,
      description VARCHAR(255) NOT NULL,
      notes TEXT NULL,
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY (recurring_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE SET NULL,
      INDEX idx_expenses_user_date (user_id, expense_date),
      INDEX idx_expenses_user_category (user_id, category_id),
      INDEX idx_expenses_user_account (user_id, account_id)
    ) ENGINE=InnoDB;
  `);

  // 11. Account Transfers Table (Non-expense internal balance transfers)
  await query(`
    CREATE TABLE IF NOT EXISTS account_transfers (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      from_account_id BIGINT UNSIGNED NOT NULL,
      to_account_id BIGINT UNSIGNED NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      transfer_date DATE NOT NULL,
      transfer_fee DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (to_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      INDEX idx_transfers_user_date (user_id, transfer_date)
    ) ENGINE=InnoDB;
  `);

  // 12. Unified Transactions Ledger Table
  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      account_id BIGINT UNSIGNED NOT NULL,
      type ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT') NOT NULL,
      category_id BIGINT UNSIGNED NULL,
      subcategory_id BIGINT UNSIGNED NULL,
      payment_method_id BIGINT UNSIGNED NULL,
      amount DECIMAL(15, 2) NOT NULL,
      transaction_date DATE NOT NULL,
      description VARCHAR(255) NOT NULL,
      reference_type VARCHAR(50) NULL,
      reference_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      INDEX idx_tx_user_date (user_id, transaction_date),
      INDEX idx_tx_user_type (user_id, type)
    ) ENGINE=InnoDB;
  `);

  // 13. Bills Table
  await query(`
    CREATE TABLE IF NOT EXISTS bills (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NULL,
      bill_name VARCHAR(150) NOT NULL,
      provider VARCHAR(150) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      due_date DATE NOT NULL,
      frequency ENUM('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
      reminder_days_before INT UNSIGNED NOT NULL DEFAULT 3,
      status ENUM('UPCOMING', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UPCOMING',
      paid_date DATE NULL,
      paid_expense_id BIGINT UNSIGNED NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (paid_expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
      INDEX idx_bills_user_due (user_id, due_date, status)
    ) ENGINE=InnoDB;
  `);

  // 14. Loans Table
  await query(`
    CREATE TABLE IF NOT EXISTS loans (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      loan_name VARCHAR(150) NOT NULL,
      loan_type ENUM('HOME_LOAN', 'CAR_LOAN', 'BIKE_LOAN', 'PERSONAL_LOAN', 'EDUCATION_LOAN', 'OTHER') NOT NULL,
      lender VARCHAR(150) NOT NULL,
      principal_amount DECIMAL(15, 2) NOT NULL,
      interest_rate DECIMAL(5, 2) NOT NULL,
      tenure_months INT UNSIGNED NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      emi_amount DECIMAL(15, 2) NOT NULL,
      outstanding_amount DECIMAL(15, 2) NOT NULL,
      emi_due_day INT UNSIGNED NOT NULL DEFAULT 5,
      total_paid DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      interest_paid DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      status ENUM('ACTIVE', 'CLOSED', 'DEFAULTED') NOT NULL DEFAULT 'ACTIVE',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_loans_user_status (user_id, status)
    ) ENGINE=InnoDB;
  `);

  // 15. Loan EMI Payments Table
  await query(`
    CREATE TABLE IF NOT EXISTS loan_payments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      loan_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      expense_id BIGINT UNSIGNED NULL,
      payment_number INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      total_payment DECIMAL(15, 2) NOT NULL,
      principal_component DECIMAL(15, 2) NOT NULL,
      interest_component DECIMAL(15, 2) NOT NULL,
      remaining_balance DECIMAL(15, 2) NOT NULL,
      status ENUM('SCHEDULED', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'SCHEDULED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
      INDEX idx_loan_payments_loan (loan_id, payment_number)
    ) ENGINE=InnoDB;
  `);

  // 16. Budgets Table
  await query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      budget_name VARCHAR(150) NOT NULL,
      period ENUM('MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_budget_amount DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_budgets_user_period (user_id, start_date, end_date)
    ) ENGINE=InnoDB;
  `);

  // 17. Budget Category Allocations Table
  await query(`
    CREATE TABLE IF NOT EXISTS budget_categories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      budget_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NOT NULL,
      allocated_amount DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_budget_category (budget_id, category_id)
    ) ENGINE=InnoDB;
  `);

  // 18. Savings Goals Table
  await query(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      goal_name VARCHAR(150) NOT NULL,
      target_amount DECIMAL(15, 2) NOT NULL,
      current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      target_date DATE NOT NULL,
      description TEXT NULL,
      status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_goals_user_status (user_id, status)
    ) ENGINE=InnoDB;
  `);

  // 19. Investments Table
  await query(`
    CREATE TABLE IF NOT EXISTS investments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      investment_name VARCHAR(150) NOT NULL,
      type ENUM('MUTUAL_FUNDS', 'STOCKS', 'FD', 'PPF', 'NPS', 'GOLD', 'CRYPTO', 'OTHER') NOT NULL,
      amount_invested DECIMAL(15, 2) NOT NULL,
      current_value DECIMAL(15, 2) NOT NULL,
      purchase_date DATE NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_investments_user (user_id)
    ) ENGINE=InnoDB;
  `);

  // 20. Subscriptions Table
  await query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NULL,
      subscription_name VARCHAR(150) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      billing_cycle ENUM('MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
      next_billing_date DATE NOT NULL,
      payment_method_id BIGINT UNSIGNED NULL,
      status ENUM('ACTIVE', 'PAUSED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      INDEX idx_subscriptions_user (user_id, status)
    ) ENGINE=InnoDB;
  `);

  // 21. Notifications Table
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('BILL_REMINDER', 'EMI_REMINDER', 'BUDGET_WARNING', 'RECURRING_TRANSACTION', 'SUBSCRIPTION_RENEWAL', 'SYSTEM') NOT NULL,
      reference_type VARCHAR(50) NULL,
      reference_id BIGINT UNSIGNED NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notifications_user_unread (user_id, is_read, created_at)
    ) ENGINE=InnoDB;
  `);

  // 22. Audit Logs Table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id, created_at),
      INDEX idx_audit_action (action)
    ) ENGINE=InnoDB;
  `);

  console.log('[Migration] All 22 database tables created/verified successfully.');

  // Populate System Default Categories & Subcategories
  console.log('[Migration] Verifying system default categories...');
  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await query(
      'SELECT id FROM categories WHERE name = ? AND user_id IS NULL LIMIT 1',
      [cat.name]
    );

    let categoryId;
    if (!existing || existing.length === 0) {
      const insertResult = await query(
        `INSERT INTO categories (user_id, name, type, icon, color, is_system_default)
         VALUES (NULL, ?, ?, ?, ?, TRUE)`,
        [cat.name, cat.type, cat.icon, cat.color]
      );
      categoryId = insertResult.insertId;
    } else {
      categoryId = existing[0].id;
    }

    // Insert subcategories
    for (const subName of cat.subcategories) {
      const existingSub = await query(
        'SELECT id FROM subcategories WHERE category_id = ? AND name = ? AND user_id IS NULL LIMIT 1',
        [categoryId, subName]
      );
      if (!existingSub || existingSub.length === 0) {
        await query(
          'INSERT INTO subcategories (category_id, user_id, name) VALUES (?, NULL, ?)',
          [categoryId, subName]
        );
      }
    }
  }

  console.log('[Migration] System default categories and subcategories populated successfully.');
  console.log('==================================================');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
