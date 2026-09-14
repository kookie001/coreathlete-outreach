const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const subtle = crypto.webcrypto.subtle;

async function testSecurity() {
  console.log('Testing AES-256-GCM Vault Security & Zero Leakage V2...');

  // 1. Test index.html zero leakage
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const phoneMatchesIndex = indexHtml.match(/\b[6-9]\d{9}\b/g) || [];
  assert.strictEqual(phoneMatchesIndex.length, 0, `Leaked phone in index.html: ${phoneMatchesIndex.join(', ')}`);
  assert.ok(!indexHtml.includes('Siddharth Rao'), 'Leaked coach in index.html');
  assert.ok(!indexHtml.includes('Abhishek Kumar'), 'Leaked coach in index.html');
  console.log('✅ index.html: 0 phone numbers, 0 coach records leaked.');

  // 2. Test app.js zero leakage
  const appJs = fs.readFileSync('app.js', 'utf8');
  const phoneMatchesApp = (appJs.match(/\b[6-9]\d{9}\b/g) || []).filter(p => p !== '9876543210');
  assert.strictEqual(phoneMatchesApp.length, 0, `Leaked phone in app.js: ${phoneMatchesApp.join(', ')}`);
  assert.ok(!appJs.includes('Siddharth Rao'), 'Leaked coach in app.js');
  console.log('✅ app.js: 0 phone numbers, 0 coach records leaked.');

  // 3. Test vault.json decryption with correct password
  const vault = JSON.parse(fs.readFileSync('vault.json', 'utf8'));
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode('CoreAthlete@2026'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const validKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: Buffer.from(vault.salt, 'hex'),
      iterations: vault.iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(vault.iv, 'hex') },
    validKey,
    Buffer.from(vault.ciphertext, 'base64')
  );

  const leads = JSON.parse(new TextDecoder('utf-8').decode(decryptedBuf));
  assert.strictEqual(leads.length, 121, `Expected 121 leads, got ${leads.length}`);
  console.log(`✅ vault.json: Successfully decrypted all ${leads.length} leads with CoreAthlete@2026.`);

  // 4. Test vault.json fails with wrong password
  let wrongPasswordBlocked = false;
  try {
    const wrongKeyMaterial = await subtle.importKey(
      'raw',
      enc.encode('wrong_guess_123'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const wrongKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: Buffer.from(vault.salt, 'hex'),
        iterations: vault.iterations,
        hash: 'SHA-256'
      },
      wrongKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    await subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(vault.iv, 'hex') },
      wrongKey,
      Buffer.from(vault.ciphertext, 'base64')
    );
  } catch (e) {
    wrongPasswordBlocked = true;
  }
  assert.ok(wrongPasswordBlocked, 'Wrong password must throw cryptographic authentication error');
  console.log('✅ vault.json: Cryptographically blocks wrong password with authentication tag error.');

  console.log('\nALL ZERO-LEAKAGE & VAULT TESTS PASSED! 🛡️⚡');
}

testSecurity().catch(err => {
  console.error('Security test failed:', err);
  process.exit(1);
});
