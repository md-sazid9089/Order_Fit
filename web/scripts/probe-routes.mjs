import http from 'http';

const routes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/invitations/accept',
  '/overview',
  '/deals',
  '/deals/new',
  '/deals/new/validate',
  '/deals/customers',
  '/deals/sources',
  '/orders',
  '/cash-flow',
  '/financing',
  '/payees',
  '/risk-constraints',
  '/sandbox',
  '/audit-log',
  '/settings',
  '/useraccess',
  '/users',
  '/admin',
  '/admin/users',
  '/admin/tenants',
  '/admin/orders',
  '/admin/system',
  '/admin/logs',
  '/admin/engine',
  '/admin/security',
  '/api/health'
];

async function probe(path) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'OrderFit-Audit-Runner/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            path,
            status: res.statusCode,
            location: res.headers.location || null,
            contentType: res.headers['content-type'] || '',
            csp: Boolean(res.headers['content-security-policy']),
            xFrameOptions: res.headers['x-frame-options'] || null,
            bodyLength: body.length
          });
        });
      }
    );
    req.on('error', (err) => {
      resolve({ path, status: 'ERROR', error: err.message });
    });
    req.end();
  });
}

async function run() {
  console.log('--- Probing all 30 routes ---');
  const results = [];
  for (const r of routes) {
    const res = await probe(r);
    results.push(res);
    console.log(`${res.status} ${res.path} ${res.location ? `-> ${res.location}` : ''}`);
  }
}

run();
