const { query } = require('../../config/database');
const { isValidMobile } = require('../../utils/validator');

class UsersService {
  /**
   * Fetches full profile and settings for the authenticated user.
   */
  static async getProfile(userId) {
    const users = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.mobile_number, u.currency, u.country, u.timezone, u.avatar_url, u.status, u.created_at,
              s.date_format, s.theme, s.default_dashboard_period, s.notify_bill_reminders, s.notify_budget_alerts, s.notify_emi_reminders, s.notify_subscription_renewals, s.budget_alert_threshold, s.custom_widgets
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );

    if (!users || users.length === 0) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const row = users[0];
    return {
      profile: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        mobileNumber: row.mobile_number,
        currency: row.currency,
        country: row.country,
        timezone: row.timezone,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
      },
      settings: {
        dateFormat: row.date_format,
        theme: row.theme,
        defaultDashboardPeriod: row.default_dashboard_period,
        notifyBillReminders: Boolean(row.notify_bill_reminders),
        notifyBudgetAlerts: Boolean(row.notify_budget_alerts),
        notifyEmiReminders: Boolean(row.notify_emi_reminders),
        notifySubscriptionRenewals: Boolean(row.notify_subscription_renewals),
        budgetAlertThreshold: row.budget_alert_threshold,
        customWidgets: row.custom_widgets ? (typeof row.custom_widgets === 'string' ? JSON.parse(row.custom_widgets) : row.custom_widgets) : null,
      },
    };
  }

  /**
   * Updates profile fields for the authenticated user.
   */
  static async updateProfile(userId, data) {
    const { firstName, lastName, mobileNumber, currency, country, timezone, avatarUrl } = data;
    const errors = [];

    if (firstName && firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }

    if (mobileNumber && !isValidMobile(mobileNumber)) {
      errors.push('Mobile number must be a valid phone number');
    }

    if (errors.length > 0) {
      const error = new Error('Validation failed');
      error.statusCode = 400;
      error.errors = errors;
      throw error;
    }

    const updates = [];
    const params = [];

    if (firstName) { updates.push('first_name = ?'); params.push(firstName.trim()); }
    if (lastName) { updates.push('last_name = ?'); params.push(lastName.trim()); }
    if (mobileNumber) { updates.push('mobile_number = ?'); params.push(mobileNumber.trim()); }
    if (currency) { updates.push('currency = ?'); params.push(currency.trim().toUpperCase()); }
    if (country) { updates.push('country = ?'); params.push(country.trim()); }
    if (timezone) { updates.push('timezone = ?'); params.push(timezone.trim()); }
    if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }

    if (updates.length === 0) {
      return this.getProfile(userId);
    }

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);

    return this.getProfile(userId);
  }

  /**
   * Updates settings for the authenticated user.
   */
  static async updateSettings(userId, data) {
    const {
      dateFormat,
      theme,
      defaultDashboardPeriod,
      notifyBillReminders,
      notifyBudgetAlerts,
      notifyEmiReminders,
      notifySubscriptionRenewals,
      budgetAlertThreshold,
      customWidgets,
    } = data;

    const updates = [];
    const params = [];

    if (dateFormat) { updates.push('date_format = ?'); params.push(dateFormat); }
    if (theme) { updates.push('theme = ?'); params.push(theme); }
    if (defaultDashboardPeriod) { updates.push('default_dashboard_period = ?'); params.push(defaultDashboardPeriod); }
    if (notifyBillReminders !== undefined) { updates.push('notify_bill_reminders = ?'); params.push(notifyBillReminders ? 1 : 0); }
    if (notifyBudgetAlerts !== undefined) { updates.push('notify_budget_alerts = ?'); params.push(notifyBudgetAlerts ? 1 : 0); }
    if (notifyEmiReminders !== undefined) { updates.push('notify_emi_reminders = ?'); params.push(notifyEmiReminders ? 1 : 0); }
    if (notifySubscriptionRenewals !== undefined) { updates.push('notify_subscription_renewals = ?'); params.push(notifySubscriptionRenewals ? 1 : 0); }
    if (budgetAlertThreshold !== undefined) { updates.push('budget_alert_threshold = ?'); params.push(Number(budgetAlertThreshold)); }
    if (customWidgets !== undefined) { updates.push('custom_widgets = ?'); params.push(JSON.stringify(customWidgets)); }

    if (updates.length > 0) {
      params.push(userId);
      await query(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`, params);
    }

    return this.getProfile(userId);
  }
}

module.exports = UsersService;
