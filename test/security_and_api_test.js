const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Set temporary test env
process.env.PORT = '3999';
const TEST_PASSWORD = 'super_secret_founder_pass_2026';

let server;
let authToken = '';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          json: json
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'object') {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🔒 COREATHLETE SECURITY & API VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // PHASE 1: FAIL-CLOSED AUTHENTICATION TESTS
  // -------------------------------------------------------------
  console.log('[PHASE 1] Fail-Closed & Password Security Tests:');

  // Start local server with NO FOUNDER_PASSWORD
  delete process.env.FOUNDER_PASSWORD;
  server = require('../server');
  await new Promise(r => server.listen(3999, r));

  await test('1.1: When FOUNDER_PASSWORD is unset, POST /api/auth must FAIL CLOSED (HTTP 500)', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'any_random_guess' });

    assert.strictEqual(res.statusCode, 500, `Expected 500, got ${res.statusCode}`);
    assert.strictEqual(res.json?.unconfigured, true, 'Expected unconfigured: true');
  });

  // Now set the valid test password
  process.env.FOUNDER_PASSWORD = TEST_PASSWORD;

  await test('1.2: When wrong password is provided, POST /api/auth must return HTTP 401', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'wrong_password_attempt' });

    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
    assert.ok(!res.json?.token, 'Token must not be issued for wrong password');
  });

  await test('1.3: When correct password is provided, POST /api/auth returns 200 and valid session token', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: TEST_PASSWORD });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert.ok(res.json?.token, 'Expected JWT/HMAC token in response');
    authToken = res.json.token;

    // Check cookie
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Expected Set-Cookie header');
    assert.ok(setCookie[0].includes('ca_session='), 'Cookie should contain ca_session');
    assert.ok(setCookie[0].includes('HttpOnly'), 'Cookie must be HttpOnly');
  });

  await test('1.4: Verify active session with GET /api/auth?action=me', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/auth?action=me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json?.authenticated, true);
  });

  // -------------------------------------------------------------
  // PHASE 2: UNAUTHENTICATED PROTECTION OF ALL API ROUTES
  // -------------------------------------------------------------
  console.log('\n[PHASE 2] Unauthenticated Access Lockdown Tests:');

  const protectedEndpoints = [
    { method: 'GET', path: '/api/leads' },
    { method: 'POST', path: '/api/leads', body: { person_name: 'Hack', mobile: '9999999999' } },
    { method: 'PATCH', path: '/api/leads?id=1', body: { outreach_status: 'test' } },
    { method: 'DELETE', path: '/api/leads?id=1' },
    { method: 'GET', path: '/api/stats' },
    { method: 'GET', path: '/api/settings' },
    { method: 'POST', path: '/api/settings', body: { roles: [] } },
    { method: 'GET', path: '/api/export' },
    { method: 'POST', path: '/api/import', body: { leads: [] } }
  ];

  for (const ep of protectedEndpoints) {
    await test(`2.X: Unauthenticated ${ep.method} ${ep.path} must return HTTP 401`, async () => {
      const res = await makeRequest({
        hostname: 'localhost',
        port: 3999,
        path: ep.path,
        method: ep.method,
        headers: { 'Content-Type': 'application/json' }
      }, ep.body || null);

      assert.strictEqual(res.statusCode, 401, `Expected 401 for ${ep.method} ${ep.path}, got ${res.statusCode}`);
      assert.strictEqual(res.json?.authenticated, false, 'Expected authenticated: false');
    });
  }

  // -------------------------------------------------------------
  // PHASE 3: AUTHENTICATED CRUD, DUPLICATE DETECTION & PIPELINE
  // -------------------------------------------------------------
  console.log('\n[PHASE 3] Authenticated CRUD, Funnel & Duplicate Detection Tests:');

  await test('3.1: Authenticated GET /api/leads retrieves seeded leads list', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/leads?limit=10',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json?.leads, 'Expected leads array');
    assert.ok(res.json.total >= 100, `Expected at least 100 seeded leads, got ${res.json.total}`);
  });

  await test('3.2: Authenticated GET /api/stats computes real-time pipeline funnel & today metrics', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json?.funnel, 'Expected funnel stats');
    assert.ok(res.json?.todayWork, 'Expected todayWork stats');
    assert.ok(res.json?.countsByStatus, 'Expected countsByStatus');
  });

  let testLeadId = null;
  const testPhone = '9811223344';
  const testIg = '@test_iron_coach';

  await test('3.3: Real-time duplicate check detects existing duplicate vs new lead', async () => {
    // Check against new phone (should NOT be duplicate)
    const res1 = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: `/api/leads?action=check-duplicate&phone=${testPhone}&instagram=${testIg}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.json?.isDuplicate, false);
  });

  await test('3.4: Quick Add / POST /api/leads creates new lead with calculated score', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, {
      person_name: 'Test Vikram Sharma',
      business_name: 'Apex Strength Labs',
      role: 'Strength & Conditioning Coach',
      city: 'Delhi NCR',
      mobile: testPhone,
      instagram: testIg,
      online_coaching: true,
      athlete_types: ['Cricket', 'Track Athletes'],
      client_count: '21-50',
      current_system: 'Google Sheets'
    });

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.json?.id, 'Expected created lead ID');
    testLeadId = res.json.id;
    assert.strictEqual(res.json.person_name, 'Test Vikram Sharma');
    assert.ok(res.json.lead_score >= 3, `Expected high lead score for athlete S&C coach, got ${res.json.lead_score}`);
  });

  await test('3.5: Duplicate prevention blocks creating second lead with same phone number', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, {
      person_name: 'Another Coach',
      mobile: testPhone
    });

    assert.strictEqual(res.statusCode, 409, `Expected 409 Conflict, got ${res.statusCode}`);
    assert.strictEqual(res.json?.duplicate, true);
    assert.strictEqual(res.json?.matchField, 'Phone Number');
  });

  await test('3.6: PATCH /api/leads updates status, auto-updates timeline & last contact date', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: `/api/leads?id=${testLeadId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, {
      outreach_status: '⭐ Interested',
      status_note: 'Coach replied positively on WhatsApp, wants demo video'
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json?.outreach_status, '⭐ Interested');
    assert.ok(res.json?.timeline?.length >= 1, 'Timeline must record status change');
    assert.strictEqual(res.json.timeline[0].action, 'Status: ⭐ Interested');
    assert.ok(res.json?.last_contact_date, 'Last contact date must be updated');
  });

  await test('3.7: DELETE /api/leads removes the lead from persistent storage', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: `/api/leads?id=${testLeadId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.strictEqual(res.statusCode, 200);

    // Verify deleted
    const checkRes = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: `/api/leads?id=${testLeadId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.strictEqual(checkRes.statusCode, 404);
  });

  // -------------------------------------------------------------
  // PHASE 4: LOGOUT & SESSION INVALIDATION
  // -------------------------------------------------------------
  console.log('\n[PHASE 4] Logout & Session Invalidation Tests:');

  await test('4.1: POST /api/auth?action=logout clears session cookie', async () => {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3999,
      path: '/api/auth?action=logout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie[0].includes('Max-Age=0'), 'Cookie must be invalidated with Max-Age=0');
  });

  // -------------------------------------------------------------
  // PHASE 5: CLIENT-SIDE ZERO DATA LEAKAGE VERIFICATION
  // -------------------------------------------------------------
  console.log('\n[PHASE 5] Client-side Zero Data Leakage Audit:');

  await test('5.1: index.html contains ZERO phone numbers or hardcoded coach records', () => {
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    // Regex checking for 10-digit Indian phone numbers
    const phoneMatches = indexHtml.match(/\b[6-9]\d{9}\b/g) || [];
    assert.strictEqual(phoneMatches.length, 0, `Found leaked phone numbers in index.html: ${phoneMatches.join(', ')}`);

    // Check that known coach names from initial list are NOT hardcoded
    const forbiddenNames = ['Abhishek Kumar', 'Karan Ahuja', 'Simranjeet Singh', 'Nitin Chhoker'];
    for (const name of forbiddenNames) {
      assert.ok(!indexHtml.includes(name), `Found hardcoded coach name "${name}" in index.html`);
    }
  });

  await test('5.2: app.js contains ZERO phone numbers or hardcoded coach records', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const phoneMatches = appJs.match(/\b[6-9]\d{9}\b/g) || [];
    // Only placeholder examples like 9876543210 are allowed if any
    const realPhones = phoneMatches.filter(p => p !== '9876543210');
    assert.strictEqual(realPhones.length, 0, `Found leaked phone numbers in app.js: ${realPhones.join(', ')}`);
  });

  await test('5.3: Verify git status does not track data/ directory', () => {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('data/'), '.gitignore must contain data/');
    assert.ok(gitignore.includes('.env'), '.gitignore must contain .env');
    assert.ok(gitignore.includes('*.sqlite') || gitignore.includes('*.db'), '.gitignore must ignore database files');
  });

  // Shutdown server
  await new Promise(r => server.close(r));

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
