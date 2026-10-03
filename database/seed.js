const { initDatabase, query } = require('../config/database');
const AuthService = require('../modules/auth/auth.service');

async function seedDatabase() {
  console.log('==================================================');
  console.log('[Seeder] Starting Demo Data Seeding...');
  console.log('==================================================');

  await initDatabase();

  // 1. Ensure Demo User exists
  let demoUser = null;
  const existingUsers = await query(
    'SELECT id, email, first_name, last_name FROM users WHERE email = ? LIMIT 1',
    ['demo@example.com']
  );

  if (existingUsers && existingUsers.length > 0) {
    demoUser = existingUsers[0];
    console.log(`[Seeder] Using existing demo user ID: ${demoUser.id} (${demoUser.email})`);
  } else {
    console.log('[Seeder] Creating demo user: demo@example.com...');
    const regResult = await AuthService.register({
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@example.com',
      mobileNumber: '+919876543210',
      password: 'Demo@12345',
      confirmPassword: 'Demo@12345',
      currency: 'INR',
      country: 'India',
      timezone: 'Asia/Kolkata',
    });
    demoUser = regResult.user;
    console.log(`[Seeder] Created demo user ID: ${demoUser.id}`);
  }

  const userId = demoUser.id;

  // 2. Fetch Category IDs for mapping
  const categoryRows = await query(
    'SELECT id, name, type FROM categories WHERE user_id IS NULL OR user_id = ?',
    [userId]
  );
  const catMap = {};
  categoryRows.forEach((c) => {
    catMap[c.name] = c.id;
  });

  // 3. Clear existing demo financial data to ensure clean, predictable seed run
  console.log('[Seeder] Refreshing demo user records...');
  await query('DELETE FROM transactions WHERE user_id = ?', [userId]);
  await query('DELETE FROM account_transfers WHERE user_id = ?', [userId]);
  await query('DELETE FROM expenses WHERE user_id = ?', [userId]);
  await query('DELETE FROM income WHERE user_id = ?', [userId]);
  await query('DELETE FROM loan_payments WHERE user_id = ?', [userId]);
  await query('DELETE FROM loans WHERE user_id = ?', [userId]);
  await query('DELETE FROM bills WHERE user_id = ?', [userId]);
  await query('DELETE FROM budget_categories WHERE user_id = ?', [userId]);
  await query('DELETE FROM budgets WHERE user_id = ?', [userId]);
  await query('DELETE FROM savings_goals WHERE user_id = ?', [userId]);
  await query('DELETE FROM investments WHERE user_id = ?', [userId]);
  await query('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
  await query('DELETE FROM notifications WHERE user_id = ?', [userId]);
  await query('DELETE FROM payment_methods WHERE user_id = ?', [userId]);
  await query('DELETE FROM financial_accounts WHERE user_id = ?', [userId]);

  // 4. Financial Accounts
  console.log('[Seeder] Seeding Financial Accounts...');
  const accSalary = await query(
    `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, institution_name, account_number_mask)
     VALUES (?, 'HDFC Salary Account', 'BANK_ACCOUNT', 'INR', 85000.00, 85000.00, 'HDFC Bank', '4589')`,
    [userId]
  );
  const accSavings = await query(
    `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, institution_name, account_number_mask)
     VALUES (?, 'ICICI Emergency Savings', 'SAVINGS', 'INR', 150000.00, 150000.00, 'ICICI Bank', '1102')`,
    [userId]
  );
  const accCash = await query(
    `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, institution_name)
     VALUES (?, 'Cash in Hand', 'CASH', 'INR', 12500.00, 12500.00, 'Physical Cash')`,
    [userId]
  );
  const accCard = await query(
    `INSERT INTO financial_accounts (user_id, account_name, account_type, currency, opening_balance, current_balance, institution_name, account_number_mask, credit_limit, billing_cycle_day, due_date_day)
     VALUES (?, 'HDFC Regalia Credit Card', 'CREDIT_CARD', 'INR', 0.00, 15400.00, 'HDFC Bank', '8821', 200000.00, 15, 5)`,
    [userId]
  );

  const salaryAccId = accSalary.insertId;
  const savingsAccId = accSavings.insertId;
  const cashAccId = accCash.insertId;
  const cardAccId = accCard.insertId;

  // 5. Payment Methods
  console.log('[Seeder] Seeding Payment Methods...');
  const pmUpi = await query(
    `INSERT INTO payment_methods (user_id, name, type, is_default)
     VALUES (?, 'Google Pay UPI', 'UPI', TRUE)`,
    [userId]
  );
  const pmNetBanking = await query(
    `INSERT INTO payment_methods (user_id, name, type, is_default)
     VALUES (?, 'HDFC Net Banking', 'NET_BANKING', FALSE)`,
    [userId]
  );
  const pmCreditCard = await query(
    `INSERT INTO payment_methods (user_id, name, type, is_default)
     VALUES (?, 'Regalia Credit Card', 'CREDIT_CARD', FALSE)`,
    [userId]
  );
  const pmCash = await query(
    `INSERT INTO payment_methods (user_id, name, type, is_default)
     VALUES (?, 'Cash', 'CASH', FALSE)`,
    [userId]
  );

  const upiId = pmUpi.insertId;
  const netBankingId = pmNetBanking.insertId;
  const creditCardPmId = pmCreditCard.insertId;
  const cashPmId = pmCash.insertId;

  // 6. Income Records (Current + Historical 5 Months)
  console.log('[Seeder] Seeding Income Records...');
  const incomes = [
    // Historical Months
    { source: 'Tech Solutions Fixed Salary', amount: 100000.00, date: '2026-05-01', frequency: 'MONTHLY', cat: catMap['Salary'], desc: 'May Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'Freelance UI/UX Project', amount: 15000.00, date: '2026-05-18', frequency: 'ONE_TIME', cat: catMap['Freelance & Business'], desc: 'Web design payout', acc: salaryAccId, pm: netBankingId, recurring: false },
    { source: 'Tech Solutions Fixed Salary', amount: 100000.00, date: '2026-06-01', frequency: 'MONTHLY', cat: catMap['Salary'], desc: 'June Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'Consulting Retainer', amount: 20000.00, date: '2026-06-15', frequency: 'ONE_TIME', cat: catMap['Freelance & Business'], desc: 'Backend audit', acc: salaryAccId, pm: netBankingId, recurring: false },
    { source: 'Tech Solutions Fixed Salary', amount: 100000.00, date: '2026-07-01', frequency: 'MONTHLY', cat: catMap['Salary'], desc: 'July Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'Quarterly Mutual Fund Dividend', amount: 4200.00, date: '2026-07-20', frequency: 'QUARTERLY', cat: catMap['Investments & Returns'], desc: 'UTI Dividend', acc: salaryAccId, pm: netBankingId, recurring: false },
    { source: 'Tech Solutions Fixed Salary', amount: 100000.00, date: '2026-08-01', frequency: 'MONTHLY', cat: catMap['Salary'], desc: 'August Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'Fullstack Freelance Milestone', amount: 25000.00, date: '2026-08-16', frequency: 'ONE_TIME', cat: catMap['Freelance & Business'], desc: 'React Native app', acc: salaryAccId, pm: netBankingId, recurring: false },
    { source: 'Tech Solutions Fixed Salary', amount: 100000.00, date: '2026-09-01', frequency: 'MONTHLY', cat: catMap['Salary'], desc: 'September Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'System Architecture Audit', amount: 30000.00, date: '2026-09-18', frequency: 'ONE_TIME', cat: catMap['Freelance & Business'], desc: 'API security review', acc: salaryAccId, pm: netBankingId, recurring: false },

    // Current Month (October 2026)
    { source: 'Tech Solutions Private Ltd', amount: 100000.00, date: '2026-10-01', frequency: 'MONTHLY', cat: catMap['Salary'] || null, desc: 'October Monthly Fixed Salary', acc: salaryAccId, pm: netBankingId, recurring: true },
    { source: 'Cloud Architecture Consulting', amount: 25000.00, date: '2026-10-15', frequency: 'ONE_TIME', cat: catMap['Freelance & Business'] || null, desc: 'Microservices architecture review for US Client', acc: salaryAccId, pm: netBankingId, recurring: false },
    { source: 'Infosys Quarterly Dividend', amount: 3500.00, date: '2026-10-20', frequency: 'QUARTERLY', cat: catMap['Investments & Returns'] || null, desc: 'Direct dividend credit in salary bank account', acc: salaryAccId, pm: netBankingId, recurring: false },
  ];

  for (const inc of incomes) {
    const res = await query(
      `INSERT INTO income (user_id, account_id, category_id, payment_method_id, amount, income_date, frequency, source_name, description, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, inc.acc, inc.cat, inc.pm, inc.amount, inc.date, inc.frequency, inc.source, inc.desc, inc.recurring]
    );

    // Record in unified transaction ledger
    await query(
      `INSERT INTO transactions (user_id, account_id, type, category_id, payment_method_id, amount, transaction_date, description, reference_type, reference_id)
       VALUES (?, ?, 'INCOME', ?, ?, ?, ?, ?, 'INCOME', ?)`,
      [userId, inc.acc, inc.cat, inc.pm, inc.amount, inc.date, inc.desc, res.insertId]
    );
  }

  // 7. Expense Records (Current + Historical 5 Months)
  console.log('[Seeder] Seeding Expense Records...');
  const expenses = [
    // Historical Months
    { desc: 'House Rent (Green Valley)', amount: 25000.00, date: '2026-05-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'DMart Groceries', amount: 7800.00, date: '2026-05-05', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Car Loan EMI', amount: 16413.00, date: '2026-05-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Fuel Full Tank', amount: 4200.00, date: '2026-05-12', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Electricity & Broadband', amount: 4100.00, date: '2026-05-15', cat: catMap['Utilities'], acc: salaryAccId, pm: upiId, rec: true },

    { desc: 'House Rent (Green Valley)', amount: 25000.00, date: '2026-06-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'DMart Groceries', amount: 8200.00, date: '2026-06-05', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Car Loan EMI', amount: 16413.00, date: '2026-06-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Weekend Restaurant', amount: 3600.00, date: '2026-06-11', cat: catMap['Food & Dining'], acc: salaryAccId, pm: creditCardPmId, rec: false },
    { desc: 'Fuel Full Tank', amount: 4400.00, date: '2026-06-14', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },

    { desc: 'House Rent (Green Valley)', amount: 25000.00, date: '2026-07-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'DMart Groceries', amount: 8900.00, date: '2026-07-06', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Car Loan EMI', amount: 16413.00, date: '2026-07-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Shopping Clothes', amount: 6200.00, date: '2026-07-16', cat: catMap['Lifestyle & Entertainment'], acc: cardAccId, pm: creditCardPmId, rec: false },
    { desc: 'Fuel Full Tank', amount: 4300.00, date: '2026-07-22', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },

    { desc: 'House Rent (Green Valley)', amount: 25000.00, date: '2026-08-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'DMart Groceries', amount: 8400.00, date: '2026-08-05', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Car Loan EMI', amount: 16413.00, date: '2026-08-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Doctor Consultation & Meds', amount: 3500.00, date: '2026-08-14', cat: catMap['Healthcare'], acc: salaryAccId, pm: netBankingId, rec: false },
    { desc: 'Fuel Full Tank', amount: 4600.00, date: '2026-08-20', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },

    { desc: 'House Rent (Green Valley)', amount: 25000.00, date: '2026-09-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'DMart Groceries', amount: 8900.00, date: '2026-09-04', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Car Loan EMI', amount: 16413.00, date: '2026-09-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Airtel Broadband + Light Bill', amount: 4650.00, date: '2026-09-12', cat: catMap['Utilities'], acc: salaryAccId, pm: upiId, rec: true },
    { desc: 'Fuel Full Tank', amount: 4800.00, date: '2026-09-21', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },

    // Current Month (October 2026)
    { desc: 'House Rent (Green Valley Apartments)', amount: 25000.00, date: '2026-10-02', cat: catMap['Housing'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Monthly Grocery Shopping (DMart)', amount: 8500.00, date: '2026-10-04', cat: catMap['Food & Dining'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Family Weekend Dinner (Barbeque Nation)', amount: 3200.00, date: '2026-10-06', cat: catMap['Food & Dining'], acc: salaryAccId, pm: creditCardPmId, rec: false },
    { desc: 'Car Loan EMI Auto-Debit', amount: 16413.00, date: '2026-10-07', cat: catMap['Loans & EMI'], acc: salaryAccId, pm: netBankingId, rec: true },
    { desc: 'Tata Power Electricity Bill', amount: 2800.00, date: '2026-10-10', cat: catMap['Utilities'], acc: salaryAccId, pm: upiId, rec: true },
    { desc: 'Petrol Full Tank (Indian Oil)', amount: 4500.00, date: '2026-10-12', cat: catMap['Transportation'], acc: salaryAccId, pm: upiId, rec: false },
    { desc: 'Airtel Broadband + Mobile Bills', amount: 1798.00, date: '2026-10-14', cat: catMap['Utilities'], acc: salaryAccId, pm: upiId, rec: true },
    { desc: 'Festive Shopping & Clothes (Zara)', amount: 4800.00, date: '2026-10-18', cat: catMap['Lifestyle & Entertainment'], acc: cardAccId, pm: creditCardPmId, rec: false },
    { desc: 'Health Insurance Family Top-Up', amount: 5500.00, date: '2026-10-22', cat: catMap['Healthcare'], acc: salaryAccId, pm: netBankingId, rec: false },
  ];

  for (const exp of expenses) {
    const res = await query(
      `INSERT INTO expenses (user_id, account_id, category_id, payment_method_id, amount, expense_date, description, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, exp.acc, exp.cat, exp.pm, exp.amount, exp.date, exp.desc, exp.rec]
    );

    // Record in unified transaction ledger
    await query(
      `INSERT INTO transactions (user_id, account_id, type, category_id, payment_method_id, amount, transaction_date, description, reference_type, reference_id)
       VALUES (?, ?, 'EXPENSE', ?, ?, ?, ?, ?, 'EXPENSE', ?)`,
      [userId, exp.acc, exp.cat, exp.pm, exp.amount, exp.date, exp.desc, res.insertId]
    );
  }

  // 8. Internal Account Transfer (Salary -> Emergency Savings)
  console.log('[Seeder] Seeding Account Transfers...');
  const transferRes = await query(
    `INSERT INTO account_transfers (user_id, from_account_id, to_account_id, amount, transfer_date, transfer_fee, notes)
     VALUES (?, ?, ?, 20000.00, '2026-10-03', 0.00, 'Monthly allocation to Emergency Savings')`,
    [userId, salaryAccId, savingsAccId]
  );
  // Internal transfer does NOT count as an expense
  await query(
    `INSERT INTO transactions (user_id, account_id, type, amount, transaction_date, description, reference_type, reference_id)
     VALUES (?, ?, 'TRANSFER', 20000.00, '2026-10-03', 'Transfer to ICICI Emergency Savings', 'TRANSFER', ?)`,
    [userId, salaryAccId, transferRes.insertId]
  );

  // 9. Budgets & Allocations
  console.log('[Seeder] Seeding Budgets...');
  const budgetRes = await query(
    `INSERT INTO budgets (user_id, budget_name, period, start_date, end_date, total_budget_amount)
     VALUES (?, 'October 2026 Monthly Budget', 'MONTHLY', '2026-10-01', '2026-10-31', 75000.00)`,
    [userId]
  );
  const budgetId = budgetRes.insertId;

  const budgetAllocations = [
    { cat: catMap['Housing'], amt: 26000.00 },
    { cat: catMap['Food & Dining'], amt: 14000.00 },
    { cat: catMap['Utilities'], amt: 6000.00 },
    { cat: catMap['Transportation'], amt: 8000.00 },
    { cat: catMap['Lifestyle & Entertainment'], amt: 8000.00 },
    { cat: catMap['Healthcare'], amt: 7000.00 },
    { cat: catMap['Miscellaneous'], amt: 6000.00 },
  ];

  for (const alloc of budgetAllocations) {
    if (alloc.cat) {
      await query(
        `INSERT INTO budget_categories (budget_id, user_id, category_id, allocated_amount)
         VALUES (?, ?, ?, ?)`,
        [budgetId, userId, alloc.cat, alloc.amt]
      );
    }
  }

  // 10. Loan & Amortization
  console.log('[Seeder] Seeding Loan & EMI Schedule...');
  const loanRes = await query(
    `INSERT INTO loans (user_id, loan_name, loan_type, lender, principal_amount, interest_rate, tenure_months, start_date, end_date, emi_amount, outstanding_amount, emi_due_day, total_paid, interest_paid, status)
     VALUES (?, 'Hyundai Creta Car Loan', 'CAR_LOAN', 'HDFC Bank', 800000.00, 8.50, 60, '2024-05-01', '2029-04-30', 16413.00, 521800.00, 7, 344673.00, 66473.00, 'ACTIVE')`,
    [userId]
  );
  const loanId = loanRes.insertId;

  // Insert recent payment legs
  await query(
    `INSERT INTO loan_payments (loan_id, user_id, payment_number, payment_date, total_payment, principal_component, interest_component, remaining_balance, status)
     VALUES
     (?, ?, 21, '2026-08-07', 16413.00, 12650.00, 3763.00, 547100.00, 'PAID'),
     (?, ?, 22, '2026-09-07', 16413.00, 12740.00, 3673.00, 534360.00, 'PAID'),
     (?, ?, 23, '2026-10-07', 16413.00, 12830.00, 3583.00, 521530.00, 'PAID'),
     (?, ?, 24, '2026-11-07', 16413.00, 12920.00, 3493.00, 508610.00, 'SCHEDULED')`,
    [loanId, userId, loanId, userId, loanId, userId, loanId, userId]
  );

  // 11. Bills
  console.log('[Seeder] Seeding Bills...');
  await query(
    `INSERT INTO bills (user_id, category_id, bill_name, provider, amount, due_date, frequency, status, paid_date)
     VALUES
     (?, ?, 'Tata Power Light Bill', 'Tata Power', 2800.00, '2026-10-10', 'MONTHLY', 'PAID', '2026-10-10'),
     (?, ?, 'Airtel Broadband Bill', 'Airtel Xstream', 999.00, '2026-10-14', 'MONTHLY', 'PAID', '2026-10-14'),
     (?, ?, 'Mahanagar Gas Bill', 'MGL Gas', 850.00, '2026-10-28', 'MONTHLY', 'UPCOMING', NULL),
     (?, ?, 'HDFC Credit Card Statement', 'HDFC Bank', 15400.00, '2026-11-05', 'MONTHLY', 'UPCOMING', NULL),
     (?, ?, 'ICICI Lombard Health Care', 'ICICI Lombard', 14500.00, '2026-11-15', 'YEARLY', 'UPCOMING', NULL)`,
    [
      userId, catMap['Utilities'],
      userId, catMap['Utilities'],
      userId, catMap['Utilities'],
      userId, catMap['Loans & EMI'],
      userId, catMap['Healthcare'],
    ]
  );

  // 12. Subscriptions
  console.log('[Seeder] Seeding Subscriptions...');
  await query(
    `INSERT INTO subscriptions (user_id, category_id, payment_method_id, subscription_name, amount, billing_cycle, next_billing_date, status)
     VALUES
     (?, ?, ?, 'Netflix 4K Premium', 649.00, 'MONTHLY', '2026-11-10', 'ACTIVE'),
     (?, ?, ?, 'Spotify Family Plan', 179.00, 'MONTHLY', '2026-11-18', 'ACTIVE'),
     (?, ?, ?, 'Amazon Prime Annual', 1499.00, 'YEARLY', '2026-12-05', 'ACTIVE'),
     (?, ?, ?, 'Google One 100GB Storage', 130.00, 'MONTHLY', '2026-10-24', 'ACTIVE')`,
    [
      userId, catMap['Subscriptions'], creditCardPmId,
      userId, catMap['Subscriptions'], creditCardPmId,
      userId, catMap['Subscriptions'], creditCardPmId,
      userId, catMap['Subscriptions'], upiId,
    ]
  );

  // 13. Savings Goals
  console.log('[Seeder] Seeding Savings Goals...');
  await query(
    `INSERT INTO savings_goals (user_id, goal_name, target_amount, current_amount, target_date, description, status)
     VALUES
     (?, '6 Months Emergency Fund', 300000.00, 185000.00, '2027-03-31', 'Liquid savings in ICICI Bank FD and savings account', 'ACTIVE'),
     (?, 'Europe Family Holiday 2027', 250000.00, 90000.00, '2027-09-01', 'Trip to Switzerland and Italy', 'ACTIVE'),
     (?, 'MacBook Pro M3 Pro Fund', 180000.00, 120000.00, '2026-12-31', 'Hardware upgrade for freelance consulting', 'ACTIVE')`,
    [userId, userId, userId]
  );

  // 14. Investments
  console.log('[Seeder] Seeding Investments...');
  await query(
    `INSERT INTO investments (user_id, investment_name, type, amount_invested, current_value, purchase_date, notes)
     VALUES
     (?, 'UTI Nifty 50 Index Mutual Fund', 'MUTUAL_FUNDS', 150000.00, 186400.00, '2023-01-10', 'Monthly SIP ₹10,000 active'),
     (?, 'Parag Parikh Flexi Cap Fund', 'MUTUAL_FUNDS', 100000.00, 128500.00, '2023-06-15', 'Diversified equity allocation'),
     (?, 'Sovereign Gold Bond (SGB 2022-23 Series IV)', 'GOLD', 50000.00, 68500.00, '2022-09-20', 'Gold appreciation + 2.5% p.a. interest'),
     (?, 'HDFC Fixed Deposit 3-Year', 'FD', 100000.00, 107100.00, '2025-01-05', 'Fixed 7.10% compounded annually')`,
    [userId, userId, userId, userId]
  );

  // 15. In-App Notifications
  console.log('[Seeder] Seeding Notifications...');
  await query(
    `INSERT INTO notifications (user_id, title, message, type, is_read)
     VALUES
     (?, 'MGL Gas Bill Due Soon', 'Your Mahanagar Gas bill of ₹850 is due on 28th October.', 'BILL_REMINDER', FALSE),
     (?, 'Car Loan EMI Paid', 'EMI payment of ₹16,413 for Hyundai Creta was successfully recorded.', 'EMI_REMINDER', TRUE),
     (?, 'Food & Dining Budget Alert', 'You have used 82% of your Food & Dining budget for October.', 'BUDGET_WARNING', FALSE)`,
    [userId, userId, userId]
  );

  console.log('==================================================');
  console.log('[Seeder] Demo seed data successfully populated for demo@example.com!');
  console.log('==================================================');
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeder process completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeder process failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
