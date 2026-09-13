const { verifyPassword, createSessionToken, verifySessionToken, extractToken } = require('../lib/auth');

module.exports = async (req, res) => {
  // CORS / Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  const action = req.query.action || (req.url.includes('/logout') ? 'logout' : (req.url.includes('/me') ? 'me' : 'login'));

  // GET /api/auth/me or GET /api/auth?action=me
  if (req.method === 'GET' || action === 'me') {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ authenticated: false, error: 'No active session.' });
    }
    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ authenticated: false, error: 'Session expired or invalid.' });
    }
    return res.status(200).json({ authenticated: true, user: session.sub });
  }

  // POST /api/auth/logout or POST /api/auth?action=logout or DELETE
  if (action === 'logout' || req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'ca_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  }

  // POST /api/auth/login or POST /api/auth
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const password = body?.password;

    const result = verifyPassword(password);

    // Fail closed if unconfigured!
    if (result.unconfigured) {
      return res.status(500).json({
        error: 'Authentication is locked. FOUNDER_PASSWORD environment variable is missing on the server.',
        unconfigured: true
      });
    }

    if (!result.success) {
      return res.status(401).json({ error: result.error || 'Invalid founder password.' });
    }

    // Success: Generate session
    const token = createSessionToken(7);
    const maxAge = 7 * 24 * 60 * 60;
    const cookie = `ca_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      success: true,
      token: token,
      user: 'founder',
      expiresIn: maxAge
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
