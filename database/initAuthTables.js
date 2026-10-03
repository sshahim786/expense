const { query } = require('../config/database');

async function createAuthTables() {
  console.log('[DB] Ensuring Auth & User tables exist...');

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

  // 3. Audit Logs Table
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

  console.log('[DB] Auth tables created/verified successfully.');
}

module.exports = { createAuthTables };
