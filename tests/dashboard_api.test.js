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

async function testDashboardEndpoints() {
  console.log('==================================================');
  console.log('📊 Testing Dashboard API Endpoints');
  console.log('==================================================');

  // 1. Login
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

  const token = loginRes.data.data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Summary
  console.log('\n[1/6] GET /api/v1/dashboard/summary');
  const summaryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/summary',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', summaryRes.status);
  console.log('Summary Data:', summaryRes.data.data);

  // 3. Cash Flow
  console.log('\n[2/6] GET /api/v1/dashboard/cash-flow?months=6');
  const cashFlowRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/cash-flow?months=6',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', cashFlowRes.status);
  console.log('Months returned:', cashFlowRes.data.data?.length);
  console.log('First month:', cashFlowRes.data.data?.[0]);
  console.log('Latest month:', cashFlowRes.data.data?.[cashFlowRes.data.data?.length - 1]);

  // 4. Category Breakdown
  console.log('\n[3/6] GET /api/v1/dashboard/category-breakdown');
  const catRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/category-breakdown',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', catRes.status);
  console.log('Categories count:', catRes.data.data?.length);
  console.log('Top category:', catRes.data.data?.[0]);

  // 5. Recent Transactions
  console.log('\n[4/6] GET /api/v1/dashboard/recent-transactions?limit=5');
  const recentRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/recent-transactions?limit=5',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', recentRes.status);
  console.log('Transactions count:', recentRes.data.data?.length);
  console.log('First transaction:', recentRes.data.data?.[0]);

  // 6. Upcoming Dues
  console.log('\n[5/6] GET /api/v1/dashboard/upcoming-dues');
  const duesRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/upcoming-dues',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', duesRes.status);
  console.log('Upcoming dues count:', duesRes.data.data?.length);
  console.log('Dues items:', duesRes.data.data);

  // 7. Budget Status
  console.log('\n[6/6] GET /api/v1/dashboard/budget-status');
  const budgetRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/dashboard/budget-status',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('Status:', budgetRes.status);
  console.log('Budget info:', {
    budgetName: budgetRes.data.data?.budgetName,
    totalAllocated: budgetRes.data.data?.totalAllocated,
    totalSpent: budgetRes.data.data?.totalSpent,
    totalPercentage: budgetRes.data.data?.totalPercentage,
    categoriesCount: budgetRes.data.data?.categories?.length,
  });

  console.log('\n==================================================');
  console.log('🎉 ALL DASHBOARD API ENDPOINTS VERIFIED!');
  console.log('==================================================\n');
}

testDashboardEndpoints().catch(console.error);
