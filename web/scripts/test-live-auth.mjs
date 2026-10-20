import http from 'http';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data ? (res.headers['content-type']?.includes('json') ? JSON.parse(data) : data) : null
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runLiveAuthAudit() {
  console.log('--- 1. Testing CSRF Challenge Retrieval ---');
  const csrfRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/csrf',
    method: 'GET',
    headers: {
      'Origin': 'http://localhost:3000',
      'Accept': 'application/json'
    }
  });
  console.log('CSRF Status:', csrfRes.status);
  console.log('CSRF Token received:', csrfRes.data?.csrf_token ? 'YES' : 'NO');
  const cookies = csrfRes.headers['set-cookie'] || [];
  const csrfCookie = cookies.find(c => c.startsWith('orderfit_csrf='));
  console.log('orderfit_csrf Cookie set:', Boolean(csrfCookie));

  const csrfToken = csrfRes.data?.csrf_token;
  const cookieHeader = csrfCookie ? csrfCookie.split(';')[0] : '';

  console.log('\n--- 2. Testing Invalid Sign-in (Wrong Credentials) ---');
  const badSigninRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/signin',
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': 'audit-test-key-01',
      'Cookie': cookieHeader
    }
  }, {
    email: 'nonexistent@example.invalid',
    password: 'WrongPassword123!'
  });
  console.log('Bad Signin Status:', badSigninRes.status);
  console.log('Error Code:', badSigninRes.data?.error?.code);
  console.log('Error Message:', badSigninRes.data?.error?.message);

  console.log('\n--- 3. Testing Sign-in Payload Validation (Invalid Email) ---');
  const malformedEmailRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/signin',
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': 'audit-test-key-02',
      'Cookie': cookieHeader
    }
  }, {
    email: 'not-an-email',
    password: 'Password123!'
  });
  console.log('Malformed Email Status:', malformedEmailRes.status);
  console.log('Validation Error:', JSON.stringify(malformedEmailRes.data?.detail || malformedEmailRes.data?.error));

  console.log('\n--- 4. Testing Admin Capabilities Gate Unauthenticated ---');
  const adminCapRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/admin/capabilities',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  console.log('Admin Capabilities Status:', adminCapRes.status);
  console.log('Admin Gate Error Code:', adminCapRes.data?.error?.code);

  console.log('\n--- 5. Testing Health Proxy Route ---');
  const healthRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  console.log('Health Status:', healthRes.status);
  console.log('Health Payload:', healthRes.data);
}

runLiveAuthAudit().catch(console.error);
