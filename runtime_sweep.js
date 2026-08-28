const http = require('http');
const routes = [
  '/', '/andon', '/schedule', '/operator', '/work-orders', '/projects', 
  '/capacity', '/maintenance', '/spc', '/fives', '/kaizen', '/safety', 
  '/leaderboard', '/digest', '/analyst', '/attendance', '/reconcile', 
  '/handover', '/scrap', '/rework', '/iot', '/landing', '/login', 
  '/change-password', '/billing', '/quotations', '/reports', '/admin',
  '/api/invoices', '/api/quotations', '/api/energy', '/api/work-orders',
  '/api/machines', '/api/plants', '/api/reports/payroll'
];

async function checkRoutes() {
  let passed = 0;
  let failed = 0;
  
  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`);
      if (res.ok || res.status === 401 || res.status === 307) { 
        // 401/307 is fine for unauthenticated runtime check
        console.log(`[PASS] ${route} - Status: ${res.status}`);
        passed++;
      } else {
        console.error(`[FAIL] ${route} - Status: ${res.status}`);
        failed++;
      }
    } catch (err) {
      console.error(`[ERROR] ${route} - ${err.message}`);
      failed++;
    }
  }
  console.log(`\nRuntime Sweep Complete: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

checkRoutes();
