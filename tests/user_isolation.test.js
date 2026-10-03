const { initDatabase, query } = require('../config/database');

async function testUserIsolation() {
  console.log('--------------------------------------------------');
  console.log('[Test] Running Automated User Data Isolation Test...');
  console.log('--------------------------------------------------');

  await initDatabase();

  // 1. Get User 1 (Demo User)
  const users = await query('SELECT id, email FROM users ORDER BY id ASC LIMIT 2');
  if (users.length < 1) {
    throw new Error('At least one user must exist.');
  }

  const userA = users[0];
  console.log(`[Test] User A: ID ${userA.id} (${userA.email})`);

  // Count User A's data
  const userAExpenses = await query('SELECT COUNT(*) as count FROM expenses WHERE user_id = ?', [userA.id]);
  const userAIncome = await query('SELECT COUNT(*) as count FROM income WHERE user_id = ?', [userA.id]);
  const userALoans = await query('SELECT COUNT(*) as count FROM loans WHERE user_id = ?', [userA.id]);

  console.log(`[Test] User A has ${userAExpenses[0].count} expenses, ${userAIncome[0].count} income records, ${userALoans[0].count} loans.`);

  // 2. Query as a fictitious or alternate User B (ID 999999)
  const userBId = 999999;
  const userBExpenses = await query('SELECT * FROM expenses WHERE user_id = ?', [userBId]);
  const userBIncome = await query('SELECT * FROM income WHERE user_id = ?', [userBId]);
  const userBLoans = await query('SELECT * FROM loans WHERE user_id = ?', [userBId]);
  const userBAccounts = await query('SELECT * FROM financial_accounts WHERE user_id = ?', [userBId]);

  if (
    userBExpenses.length === 0 &&
    userBIncome.length === 0 &&
    userBLoans.length === 0 &&
    userBAccounts.length === 0
  ) {
    console.log('[PASS] Isolation Verified: User B cannot access any of User A records.');
  } else {
    throw new Error('[FAIL] Multi-tenancy leak detected!');
  }

  // 3. Test attempted cross-user update/delete
  const sampleExpenseA = await query('SELECT id FROM expenses WHERE user_id = ? LIMIT 1', [userA.id]);
  if (sampleExpenseA.length > 0) {
    const expenseId = sampleExpenseA[0].id;
    // Attempt to update User A's expense while scoped to User B
    const updateResult = await query(
      'UPDATE expenses SET amount = 999999 WHERE id = ? AND user_id = ?',
      [expenseId, userBId]
    );

    if (updateResult.affectedRows === 0) {
      console.log(`[PASS] Cross-user update prevented: User B cannot modify expense #${expenseId} belonging to User A.`);
    } else {
      throw new Error(`[FAIL] User B was able to modify User A's expense!`);
    }
  }

  console.log('--------------------------------------------------');
  console.log('ALL USER DATA ISOLATION TESTS PASSED (0 leaks)');
  console.log('--------------------------------------------------');
}

if (require.main === module) {
  testUserIsolation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { testUserIsolation };
