const crypto = require('crypto');

/**
 * Validates the founder password.
 * MUST FAIL CLOSED if FOUNDER_PASSWORD is not set in environment variables.
 */
function verifyPassword(inputPassword) {
  const envPassword = process.env.FOUNDER_PASSWORD;
  if (!envPassword || typeof envPassword !== 'string' || envPassword.trim() === '') {
    return {
      success: false,
      unconfigured: true,
      error: 'FOUNDER_PASSWORD environment variable is missing or empty. Server is locked.'
    };
  }

  if (!inputPassword || typeof inputPassword !== 'string') {
    return { success: false, unconfigured: false, error: 'Password is required.' };
  }

  const expectedBuffer = Buffer.from(envPassword, 'utf8');
  const actualBuffer = Buffer.from(inputPassword, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    // Constant time dummy comparison to prevent timing leak on length
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return { success: false, unconfigured: false, error: 'Invalid password.' };
  }

  const isMatch = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  return {
    success: isMatch,
    unconfigured: false,
    error: isMatch ? null : 'Invalid password.'
  };
}

/**
 * Generates a session secret.
 */
function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.FOUNDER_PASSWORD;
  if (!secret) {
    throw new Error('Neither SESSION_SECRET nor FOUNDER_PASSWORD is set in environment.');
  }
  return crypto.createHash('sha256').update(secret + '_coreathlete_session_salt_2026').digest();
}

/**
 * Creates a signed session token (HMAC-SHA256).
 */
function createSessionToken(expiresInDays = 7) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInDays * 24 * 60 * 60;
  
  const payload = Buffer.from(JSON.stringify({
    sub: 'founder',
    role: 'founder',
    iat: now,
    exp: exp
  })).toString('base64url');

  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies a signed session token.
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  try {
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (decoded.exp && decoded.exp < now) {
      return null; // Expired
    }

    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to extract token from request (header or cookie).
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Check Cookies
  const cookieHeader = req.headers['cookie'] || req.headers['Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/ca_session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Middleware: Enforces authentication on API routes.
 * Returns true if authenticated, false if rejected (and sends 401 response).
 */
function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ authenticated: false, error: 'Unauthorized: Authentication required to access CoreAthlete CRM API.' });
    return false;
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ authenticated: false, error: 'Unauthorized: Invalid or expired session. Please log in again.' });
    return false;
  }

  req.user = session;
  return true;
}

module.exports = {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  extractToken,
  requireAuth
};
