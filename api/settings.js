const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const settings = await db.getSettings();
      return res.status(200).json(settings);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const saved = await db.saveSettings(body);
      return res.status(200).json(saved);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API settings error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
