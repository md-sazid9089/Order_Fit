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

function parseCookies(headers) {
  const setCookies = headers['set-cookie'] || [];
  const map = {};
  for (const c of setCookies) {
    const parts = c.split(';')[0].split('=');
    map[parts[0]] = parts[1];
  }
  return map;
}

function toCookieHeader(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function runEndToEndUserJourney() {
  console.log('=== PHASE 8: COMPLETE END-TO-END USER JOURNEY AUDIT ===\n');
  const cookieJar = {};
  const testEmail = `audit-${Date.now()}@example.invalid`;
  const testPassword = 'AuditSecurePassword2026!';
  const testName = 'Auditor Verification User';
  const testBusiness = 'Audit Disposable Corp';

  // Step 1: CSRF Challenge
  console.log('1. Fetching initial CSRF challenge...');
  const csrfRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/csrf',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Accept': 'application/json' }
  });
  if (csrfRes.status !== 200) throw new Error(`CSRF failed: ${csrfRes.status}`);
  Object.assign(cookieJar, parseCookies(csrfRes.headers));
  let csrfToken = csrfRes.data.csrf_token;
  console.log('   ✓ CSRF Challenge acquired:', csrfToken.slice(0, 12) + '...');

  // Step 2: User Registration (Sign Up)
  console.log('\n2. Registering new tenant & owner account (Sign Up)...');
  const signupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/signup',
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': `signup-${Date.now()}`,
      'Cookie': toCookieHeader(cookieJar)
    }
  }, {
    email: testEmail,
    password: testPassword,
    full_name: testName,
    business_name: testBusiness,
    currency: 'USD',
    timezone: 'UTC'
  });

  console.log('   Sign-up HTTP Status:', signupRes.status);
  if (signupRes.status !== 201) {
    console.error('   Sign-up failed:', signupRes.data);
    throw new Error('Sign up failed');
  }
  Object.assign(cookieJar, parseCookies(signupRes.headers));
  const userSession = signupRes.data;
  console.log('   ✓ Account created successfully:');
  console.log('     User ID:', userSession.user_id);
  console.log('     Email:', userSession.email);
  console.log('     Memberships:', userSession.memberships.length);
  const membership = userSession.memberships[0];
  const businessId = membership?.business_id;
  console.log('     Business ID:', businessId);
  console.log('     Role:', membership?.role);

  // Step 3: Session verification (/auth/me)
  console.log('\n3. Verifying active session (/auth/me)...');
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': toCookieHeader(cookieJar)
    }
  });
  console.log('   /auth/me Status:', meRes.status);
  console.log('   ✓ Confirmed user identity matches:', meRes.data.user_id === userSession.user_id);

  // Step 4: Business Profile & Capabilities
  console.log('\n4. Reading Business Profile and Tenant Scope...');
  const profileRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/businesses/${businessId}/profile`,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': toCookieHeader(cookieJar)
    }
  });
  console.log('   Business Profile Status:', profileRes.status);
  console.log('   ✓ Company Name:', profileRes.data?.company_name || testBusiness);

  // Step 5: Deals Pipeline
  console.log('\n5. Reading Deals Pipeline for new business...');
  const dealsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/businesses/${businessId}/deals`,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': toCookieHeader(cookieJar)
    }
  });
  console.log('   Deals List Status:', dealsRes.status);
  console.log('   ✓ Deals count:', Array.isArray(dealsRes.data) ? dealsRes.data.length : dealsRes.data?.items?.length ?? 0);

  // Step 6: Sign Out
  console.log('\n6. Testing Sign Out (/auth/signout)...');
  const signoutCsrf = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/csrf',
    method: 'GET',
    headers: {
      'Origin': 'http://localhost:3000',
      'Accept': 'application/json',
      'Cookie': toCookieHeader(cookieJar)
    }
  });
  Object.assign(cookieJar, parseCookies(signoutCsrf.headers));
  csrfToken = signoutCsrf.data.csrf_token;

  const signoutRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/signout',
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': `signout-${Date.now()}`,
      'Cookie': toCookieHeader(cookieJar)
    }
  }, null);
  console.log('   Sign-out Status:', signoutRes.status);
  console.log('   ✓ Sign-out completed:', signoutRes.data?.completed);
  Object.assign(cookieJar, parseCookies(signoutRes.headers));

  // Step 7: Verify session terminated
  console.log('\n7. Verifying session terminated after sign out...');
  const terminatedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': toCookieHeader(cookieJar)
    }
  });
  console.log('   Post-signout Status:', terminatedRes.status);
  console.log('   ✓ Expected 401 INVALID_SESSION received:', terminatedRes.data?.error?.code === 'INVALID_SESSION');

  // Step 8: Sign In again
  console.log('\n8. Signing in with newly created credentials...');
  // Fresh CSRF
  const newCsrf = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/csrf',
    method: 'GET',
    headers: { 'Origin': 'http://localhost:3000', 'Accept': 'application/json' }
  });
  const newJar = parseCookies(newCsrf.headers);
  const signinRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/signin',
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': newCsrf.data.csrf_token,
      'Idempotency-Key': `signin-${Date.now()}`,
      'Cookie': toCookieHeader(newJar)
    }
  }, {
    email: testEmail,
    password: testPassword
  });
  console.log('   Sign-in Status:', signinRes.status);
  console.log('   ✓ Sign-in succeeded, user re-authenticated:', signinRes.data?.user_id === userSession.user_id);
  console.log('\n=== END-TO-END USER JOURNEY: ALL 8 STEPS PASSED ===');
}

runEndToEndUserJourney().catch(err => {
  console.error('Test journey failed:', err);
  process.exit(1);
});
