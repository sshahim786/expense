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

async function testDashboardIsolation() {
  console.log('==================================================');
  console.log('🔒 Testing Multi-Tenancy Dashboard Isolation');
  console.log('==================================================');

  // 1. Login User A (Demo)
  const loginARes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'demo@example.com', password: 'Demo@12345' }
  );

  const tokenA = loginARes.data.data.token;
  const summaryA = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  console.log('User A Total Balance:', summaryA.data.data.totalBalance);
  console.log('User A Monthly Income:', summaryA.data.data.monthlyIncome);

  // 2. Register / Login User B
  const userBEmail = 'isolation_dashboard_b@example.com';
  let tokenB;
  const regBRes = await request(
    {
      hostname: 'localhost',
      port: 5001,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      firstName: 'UserB',
      lastName: 'Isolation',
      email: userBEmail,
      mobileNumber: '+919999988888',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      currency: 'INR',
      country: 'India',
      timezone: 'Asia/Kolkata',
    }
  );

  if (regBRes.status === 201) {
    tokenB = regBRes.data.data.token;
  } else {
    // Already registered, login
    const loginBRes = await request(
      {
        hostname: 'localhost',
        port: 5001,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: userBEmail, password: 'Password123!' }
    );
    tokenB = loginBRes.data.data.token;
  }

  // 3. Query User B Dashboard
  const summaryB = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });

  console.log('User B Total Balance:', summaryB.data.data.totalBalance);
  console.log('User B Monthly Income:', summaryB.data.data.monthlyIncome);

  const txB = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/recent-transactions',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });

  console.log('User B Recent Transactions Count:', txB.data.data.length);

  // Assertions
  if (summaryB.data.data.totalBalance === 0 && txB.data.data.length === 0) {
    console.log('\n[PASS] Multi-tenant isolation verified: User B has 0 balance and 0 transaction leaks from User A.');
  } else {
    console.error('\n[FAIL] Cross-tenant data leak detected!');
    process.exit(1);
  }

  console.log('==================================================\n');
}

testDashboardIsolation().catch(console.error);
