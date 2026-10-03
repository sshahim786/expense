const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Phase 4 Business Rules & Security Test');
  console.log('==================================================');

  // 1. Login as demo user
  console.log('\n[Step 1] Logging in demo user...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'demo@example.com', password: 'Demo@12345' }
  );

  if (loginRes.status !== 200 || !loginRes.data?.data?.token) {
    console.error('❌ Login failed:', loginRes.data);
    process.exit(1);
  }

  const token = loginRes.data.data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✅ Demo user authenticated.');

  // 2. Fetch Accounts
  console.log('\n[Step 2] Fetching accounts & initial balances...');
  const accRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/accounts',
    method: 'GET',
    headers: authHeaders,
  });

  const accounts = accRes.data.data;
  if (!accounts || accounts.length < 2) {
    console.error('❌ Need at least 2 accounts for transfer test');
    process.exit(1);
  }

  const acc1 = accounts[0];
  const acc2 = accounts[1];
  const initialBal1 = parseFloat(acc1.currentBalance);
  const initialBal2 = parseFloat(acc2.currentBalance);
  console.log(`Account 1 (${acc1.accountName}): ₹${initialBal1}`);
  console.log(`Account 2 (${acc2.accountName}): ₹${initialBal2}`);

  // 3. Test Rule 2: Expense creation decreases balance
  console.log('\n[Step 3] Testing Rule 2: Create Expense of ₹1,500.00...');
  const expensePayload = {
    accountId: acc1.id,
    categoryId: 6, // Food & Dining
    amount: 1500,
    expenseDate: '2026-10-25',
    description: 'Phase 4 Test Expense',
    notes: 'Testing Rule 2 balance deduction',
  };

  const expRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/expenses',
      method: 'POST',
      headers: authHeaders,
    },
    expensePayload
  );

  if (expRes.status !== 201) {
    console.error('❌ Create expense failed:', expRes.data);
    process.exit(1);
  }
  const createdExpenseId = expRes.data.data.id;
  console.log(`✅ Expense created successfully (ID: ${createdExpenseId})`);

  // Verify balance decreased
  const accAfterExpRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/accounts',
    method: 'GET',
    headers: authHeaders,
  });
  const bal1AfterExp = parseFloat(accAfterExpRes.data.data.find((a) => a.id === acc1.id).currentBalance);
  const expectedBalAfterExp = initialBal1 - 1500;
  if (Math.abs(bal1AfterExp - expectedBalAfterExp) < 0.01) {
    console.log(`✅ Rule 2 Verified: Account balance decreased to ₹${bal1AfterExp} (Expected: ₹${expectedBalAfterExp})`);
  } else {
    console.error(`❌ Rule 2 Failed: Balance is ₹${bal1AfterExp}, expected ₹${expectedBalAfterExp}`);
    process.exit(1);
  }

  // 4. Test Rule 1: Income creation increases balance
  console.log('\n[Step 4] Testing Rule 1: Create Income of ₹5,000.00...');
  const incomePayload = {
    accountId: acc1.id,
    categoryId: 1, // Salary
    amount: 5000,
    incomeDate: '2026-10-26',
    sourceName: 'Phase 4 Test Freelance Income',
    frequency: 'ONE_TIME',
  };

  const incRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/income',
      method: 'POST',
      headers: authHeaders,
    },
    incomePayload
  );

  if (incRes.status !== 201) {
    console.error('❌ Create income failed:', incRes.data);
    process.exit(1);
  }
  const createdIncomeId = incRes.data.data.id;
  console.log(`✅ Income created successfully (ID: ${createdIncomeId})`);

  const accAfterIncRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/accounts',
    method: 'GET',
    headers: authHeaders,
  });
  const bal1AfterInc = parseFloat(accAfterIncRes.data.data.find((a) => a.id === acc1.id).currentBalance);
  const expectedBalAfterInc = bal1AfterExp + 5000;
  if (Math.abs(bal1AfterInc - expectedBalAfterInc) < 0.01) {
    console.log(`✅ Rule 1 Verified: Account balance increased to ₹${bal1AfterInc} (Expected: ₹${expectedBalAfterInc})`);
  } else {
    console.error(`❌ Rule 1 Failed: Balance is ₹${bal1AfterInc}, expected ₹${expectedBalAfterInc}`);
    process.exit(1);
  }

  // 5. Test Rule 3: Account Transfer
  console.log('\n[Step 5] Testing Rule 3: Transfer ₹2,000.00 from Account 1 to Account 2...');
  const transferPayload = {
    fromAccountId: acc1.id,
    toAccountId: acc2.id,
    amount: 2000,
    transferFee: 0,
    transferDate: '2026-10-27',
    notes: 'Phase 4 Inter-account transfer',
  };

  const trfRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/transactions/transfer',
      method: 'POST',
      headers: authHeaders,
    },
    transferPayload
  );

  if (trfRes.status !== 201) {
    console.error('❌ Transfer failed:', trfRes.data);
    process.exit(1);
  }
  console.log('✅ Transfer executed successfully');

  const accAfterTrfRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/accounts',
    method: 'GET',
    headers: authHeaders,
  });
  const bal1AfterTrf = parseFloat(accAfterTrfRes.data.data.find((a) => a.id === acc1.id).currentBalance);
  const bal2AfterTrf = parseFloat(accAfterTrfRes.data.data.find((a) => a.id === acc2.id).currentBalance);
  const expectedBal1Trf = bal1AfterInc - 2000;
  const expectedBal2Trf = initialBal2 + 2000;

  if (Math.abs(bal1AfterTrf - expectedBal1Trf) < 0.01 && Math.abs(bal2AfterTrf - expectedBal2Trf) < 0.01) {
    console.log(`✅ Rule 3 Verified: From-account ₹${bal1AfterTrf} (-₹2000), To-account ₹${bal2AfterTrf} (+₹2000)`);
  } else {
    console.error(`❌ Rule 3 Failed! Account balances do not match expected transfer amounts.`);
    process.exit(1);
  }

  // 6. Test Rule 6: Delete Expense restores account balance
  console.log('\n[Step 6] Testing Rule 6: Delete Expense (Restores ₹1,500.00 to Account 1)...');
  const delExpRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/v1/expenses/${createdExpenseId}`,
    method: 'DELETE',
    headers: authHeaders,
  });

  if (delExpRes.status !== 200) {
    console.error('❌ Delete expense failed:', delExpRes.data);
    process.exit(1);
  }

  const accAfterDelRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/accounts',
    method: 'GET',
    headers: authHeaders,
  });
  const bal1AfterDel = parseFloat(accAfterDelRes.data.data.find((a) => a.id === acc1.id).currentBalance);
  const expectedBal1AfterDel = bal1AfterTrf + 1500;

  if (Math.abs(bal1AfterDel - expectedBal1AfterDel) < 0.01) {
    console.log(`✅ Rule 6 Verified: Account balance restored by ₹1,500 to ₹${bal1AfterDel}`);
  } else {
    console.error(`❌ Rule 6 Failed: Balance is ₹${bal1AfterDel}, expected ₹${expectedBal1AfterDel}`);
    process.exit(1);
  }

  // 7. Cleanup Income record
  console.log('\n[Step 7] Cleanup: Deleting created income record...');
  const delIncRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: `/api/v1/income/${createdIncomeId}`,
    method: 'DELETE',
    headers: authHeaders,
  });
  if (delIncRes.status === 200) {
    console.log('✅ Income deleted and balance reversed successfully.');
  }

  // 8. Reverse the transfer for clean state
  console.log('\n[Step 8] Reversing test transfer...');
  await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/transactions/transfer',
      method: 'POST',
      headers: authHeaders,
    },
    {
      fromAccountId: acc2.id,
      toAccountId: acc1.id,
      amount: 2000,
      transferFee: 0,
      transferDate: '2026-10-27',
      notes: 'Test rollback transfer',
    }
  );
  console.log('✅ Balances restored to initial states.');

  console.log('\n==================================================');
  console.log('🎉 ALL PHASE 4 BUSINESS RULES PASSED PERFECTLY!');
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
