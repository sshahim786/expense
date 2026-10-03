const { query } = require('../../config/database');

class DashboardService {
  /**
   * Returns comprehensive KPI summary metrics for the user.
   */
  static async getSummaryMetrics(userId) {
    // 1. Total Net Worth / Available Balance
    const balanceRows = await query(
      `SELECT COALESCE(SUM(current_balance), 0) AS total_balance
       FROM financial_accounts
       WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [userId]
    );
    const totalBalance = parseFloat(balanceRows[0]?.total_balance || 0);

    // 2. Total active accounts count
    const accCountRows = await query(
      `SELECT COUNT(*) AS total_accounts
       FROM financial_accounts
       WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [userId]
    );
    const totalAccounts = parseInt(accCountRows[0]?.total_accounts || 0, 10);

    // 3. Current Month Income & Previous Month Income
    const incomeRows = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN MONTH(income_date) = MONTH(CURDATE()) AND YEAR(income_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS current_income,
         COALESCE(SUM(CASE WHEN MONTH(income_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(income_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN amount ELSE 0 END), 0) AS last_month_income
       FROM income
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );
    const currentIncome = parseFloat(incomeRows[0]?.current_income || 0);
    const lastMonthIncome = parseFloat(incomeRows[0]?.last_month_income || 0);

    // 4. Current Month Expenses & Previous Month Expenses
    const expenseRows = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS current_expense,
         COALESCE(SUM(CASE WHEN MONTH(expense_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(expense_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN amount ELSE 0 END), 0) AS last_month_expense
       FROM expenses
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );
    const currentExpense = parseFloat(expenseRows[0]?.current_expense || 0);
    const lastMonthExpense = parseFloat(expenseRows[0]?.last_month_expense || 0);

    // 5. Net Savings & Savings Rate
    const netSavings = currentIncome - currentExpense;
    const savingsRate = currentIncome > 0 ? ((netSavings / currentIncome) * 100) : 0;

    // 6. MoM Growth Calculations
    const incomeGrowth = lastMonthIncome > 0
      ? (((currentIncome - lastMonthIncome) / lastMonthIncome) * 100)
      : (currentIncome > 0 ? 100 : 0);

    const expenseGrowth = lastMonthExpense > 0
      ? (((currentExpense - lastMonthExpense) / lastMonthExpense) * 100)
      : (currentExpense > 0 ? 100 : 0);

    // 7. Total Active Debt (Outstanding Loan Balances)
    const debtRows = await query(
      `SELECT 
         COALESCE(SUM(outstanding_amount), 0) AS total_debt,
         COALESCE(SUM(emi_amount), 0) AS total_monthly_emi
       FROM loans
       WHERE user_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [userId]
    );
    const totalDebt = parseFloat(debtRows[0]?.total_debt || 0);
    const monthlyEmi = parseFloat(debtRows[0]?.total_monthly_emi || 0);

    // 8. Upcoming Bills Count (Next 14 Days)
    const upcomingBillsRows = await query(
      `SELECT COUNT(*) AS upcoming_count
       FROM bills
       WHERE user_id = ? AND status = 'UPCOMING' AND deleted_at IS NULL
         AND due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)`,
      [userId]
    );
    const upcomingBillsCount = parseInt(upcomingBillsRows[0]?.upcoming_count || 0, 10);

    // 9. Active Investments Value
    const investRows = await query(
      `SELECT 
         COALESCE(SUM(amount_invested), 0) AS total_invested,
         COALESCE(SUM(current_value), 0) AS total_current_value
       FROM investments
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );
    const totalInvested = parseFloat(investRows[0]?.total_invested || 0);
    const investmentCurrentValue = parseFloat(investRows[0]?.total_current_value || 0);

    return {
      totalBalance,
      totalAccounts,
      monthlyIncome: currentIncome,
      monthlyExpense: currentExpense,
      netSavings,
      savingsRate: parseFloat(savingsRate.toFixed(1)),
      lastMonthIncome,
      lastMonthExpense,
      incomeGrowth: parseFloat(incomeGrowth.toFixed(1)),
      expenseGrowth: parseFloat(expenseGrowth.toFixed(1)),
      totalDebt,
      monthlyEmi,
      upcomingBillsCount,
      totalInvested,
      investmentCurrentValue,
    };
  }

  /**
   * Returns monthly cash flow (income vs expense) for the last N months.
   */
  static async getCashFlow(userId, monthsCount = 6) {
    const limitMonths = Math.min(Math.max(parseInt(monthsCount, 10) || 6, 3), 12);

    // Get aggregated income
    const incomeRows = await query(
      `SELECT 
         DATE_FORMAT(income_date, '%Y-%m') AS ym,
         COALESCE(SUM(amount), 0) AS total_income
       FROM income
       WHERE user_id = ? AND deleted_at IS NULL
         AND income_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)
       GROUP BY ym`,
      [userId, limitMonths - 1]
    );

    // Get aggregated expenses
    const expenseRows = await query(
      `SELECT 
         DATE_FORMAT(expense_date, '%Y-%m') AS ym,
         COALESCE(SUM(amount), 0) AS total_expense
       FROM expenses
       WHERE user_id = ? AND deleted_at IS NULL
         AND expense_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)
       GROUP BY ym`,
      [userId, limitMonths - 1]
    );

    const incomeMap = {};
    incomeRows.forEach((r) => {
      incomeMap[r.ym] = parseFloat(r.total_income);
    });

    const expenseMap = {};
    expenseRows.forEach((r) => {
      expenseMap[r.ym] = parseFloat(r.total_expense);
    });

    // Build ordered list of the past N months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    const now = new Date();

    for (let i = limitMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const ym = `${year}-${String(monthNum).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${String(year).slice(-2)}`;

      const inc = incomeMap[ym] || 0;
      const exp = expenseMap[ym] || 0;
      const sav = inc - exp;
      const rate = inc > 0 ? parseFloat(((sav / inc) * 100).toFixed(1)) : 0;

      result.push({
        month: ym,
        label,
        income: inc,
        expense: exp,
        savings: sav,
        savingsRate: rate,
      });
    }

    return result;
  }

  /**
   * Returns category-wise expense breakdown for the current month.
   */
  static async getCategoryBreakdown(userId) {
    const rows = await query(
      `SELECT 
         c.id AS category_id,
         c.name AS category_name,
         c.color,
         c.icon,
         COALESCE(SUM(e.amount), 0) AS total_amount,
         COUNT(e.id) AS transaction_count
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = ? AND e.deleted_at IS NULL
         AND MONTH(e.expense_date) = MONTH(CURDATE())
         AND YEAR(e.expense_date) = YEAR(CURDATE())
       GROUP BY c.id, c.name, c.color, c.icon
       HAVING total_amount > 0
       ORDER BY total_amount DESC`,
      [userId]
    );

    const totalExpense = rows.reduce((sum, r) => sum + parseFloat(r.total_amount), 0);

    return rows.map((r) => {
      const amt = parseFloat(r.total_amount);
      const percentage = totalExpense > 0 ? parseFloat(((amt / totalExpense) * 100).toFixed(1)) : 0;
      return {
        categoryId: r.category_id,
        categoryName: r.category_name,
        color: r.color || '#64748B',
        icon: r.icon || 'category',
        amount: amt,
        transactionCount: parseInt(r.transaction_count, 10),
        percentage,
      };
    });
  }

  /**
   * Returns the most recent transactions for the dashboard feed.
   */
  static async getRecentTransactions(userId, limit = 7) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 7, 1), 20);

    const rows = await query(
      `SELECT 
         t.id,
         t.type,
         t.amount,
         t.transaction_date,
         t.description,
         t.reference_type,
         t.reference_id,
         a.account_name,
         a.account_type,
         c.name AS category_name,
         c.color AS category_color,
         c.icon AS category_icon
       FROM transactions t
       LEFT JOIN financial_accounts a ON t.account_id = a.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.deleted_at IS NULL
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT ?`,
      [userId, safeLimit]
    );

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: parseFloat(r.amount),
      transactionDate: r.transaction_date,
      description: r.description,
      accountName: r.account_name,
      accountType: r.account_type,
      categoryName: r.category_name,
      categoryColor: r.category_color || '#64748B',
      categoryIcon: r.category_icon || 'receipt',
    }));
  }

  /**
   * Returns upcoming bills and active loan EMIs due in the next N days.
   */
  static async getUpcomingDues(userId, days = 14) {
    const safeDays = Math.min(Math.max(parseInt(days, 10) || 14, 1), 30);

    // 1. Upcoming Unpaid Bills
    const billRows = await query(
      `SELECT 
         b.id,
         b.bill_name AS title,
         b.provider,
         b.amount,
         b.due_date,
         b.status,
         DATEDIFF(b.due_date, CURDATE()) AS days_left,
         c.name AS category_name,
         c.color AS category_color
       FROM bills b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.status = 'UPCOMING' AND b.deleted_at IS NULL
         AND b.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.due_date ASC`,
      [userId, safeDays]
    );

    const upcomingBills = billRows.map((b) => ({
      id: `bill-${b.id}`,
      billId: b.id,
      type: 'BILL',
      title: b.title,
      subtitle: b.provider || b.category_name || 'Bill Payment',
      amount: parseFloat(b.amount),
      dueDate: b.due_date,
      daysLeft: parseInt(b.days_left, 10),
      isUrgent: parseInt(b.days_left, 10) <= 3,
      categoryColor: b.category_color || '#F59E0B',
    }));

    // 2. Upcoming Active Loan EMIs
    const loanRows = await query(
      `SELECT 
         l.id,
         l.loan_name,
         l.lender,
         l.emi_amount,
         l.emi_due_day
       FROM loans l
       WHERE l.user_id = ? AND l.status = 'ACTIVE' AND l.deleted_at IS NULL`,
      [userId]
    );

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const upcomingLoans = [];

    loanRows.forEach((l) => {
      const emiDay = parseInt(l.emi_due_day, 10) || 5;
      let dueDate = new Date(currentYear, currentMonth, emiDay);
      if (dueDate < now) {
        // Next month's EMI
        dueDate = new Date(currentYear, currentMonth + 1, emiDay);
      }

      const diffTime = dueDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysLeft >= 0 && daysLeft <= safeDays) {
        const ymDate = dueDate.toISOString().split('T')[0];
        upcomingLoans.push({
          id: `loan-${l.id}`,
          loanId: l.id,
          type: 'LOAN_EMI',
          title: `${l.loan_name} EMI`,
          subtitle: l.lender || 'Bank Loan EMI',
          amount: parseFloat(l.emi_amount),
          dueDate: ymDate,
          daysLeft,
          isUrgent: daysLeft <= 3,
          categoryColor: '#EF4444',
        });
      }
    });

    // Merge and sort by dueDate
    const allDues = [...upcomingBills, ...upcomingLoans].sort((a, b) => a.daysLeft - b.daysLeft);
    return allDues;
  }

  /**
   * Returns current active budget status and category consumption.
   */
  static async getBudgetStatus(userId) {
    const budgetRows = await query(
      `SELECT id, budget_name, start_date, end_date, total_budget_amount
       FROM budgets
       WHERE user_id = ? AND deleted_at IS NULL
         AND CURDATE() BETWEEN start_date AND end_date
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    );

    if (!budgetRows || budgetRows.length === 0) {
      return null;
    }

    const budget = budgetRows[0];
    const totalAllocated = parseFloat(budget.total_budget_amount);

    // Get categories allocated in this budget
    const categoryRows = await query(
      `SELECT 
         bc.category_id,
         bc.allocated_amount,
         c.name AS category_name,
         c.color,
         c.icon,
         COALESCE(
           (SELECT SUM(e.amount) 
            FROM expenses e 
            WHERE e.user_id = ? 
              AND e.category_id = bc.category_id 
              AND e.deleted_at IS NULL 
              AND e.expense_date BETWEEN ? AND ?), 
           0
         ) AS spent_amount
       FROM budget_categories bc
       JOIN categories c ON bc.category_id = c.id
       WHERE bc.budget_id = ? AND bc.user_id = ?
       ORDER BY spent_amount DESC`,
      [userId, budget.start_date, budget.end_date, budget.id, userId]
    );

    let totalSpent = 0;
    const categories = categoryRows.map((cat) => {
      const allocated = parseFloat(cat.allocated_amount);
      const spent = parseFloat(cat.spent_amount);
      totalSpent += spent;
      const percentage = allocated > 0 ? parseFloat(((spent / allocated) * 100).toFixed(1)) : 0;

      let status = 'HEALTHY';
      if (percentage >= 100) status = 'EXCEEDED';
      else if (percentage >= 90) status = 'DANGER';
      else if (percentage >= 70) status = 'WARNING';

      return {
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        color: cat.color || '#64748B',
        icon: cat.icon || 'pie_chart',
        allocated,
        spent,
        remaining: Math.max(allocated - spent, 0),
        percentage,
        status,
      };
    });

    const totalPercentage = totalAllocated > 0 ? parseFloat(((totalSpent / totalAllocated) * 100).toFixed(1)) : 0;

    return {
      budgetId: budget.id,
      budgetName: budget.budget_name,
      startDate: budget.start_date,
      endDate: budget.end_date,
      totalAllocated,
      totalSpent,
      totalRemaining: Math.max(totalAllocated - totalSpent, 0),
      totalPercentage,
      isOverBudget: totalSpent > totalAllocated,
      categories,
    };
  }
}

module.exports = DashboardService;
