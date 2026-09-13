const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const { leads = [], previewOnly = false } = body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'No lead records provided for import.' });
    }

    const preview = [];
    const validToImport = [];

    for (const item of leads) {
      if (!item.person_name || !item.mobile) continue;
      const dup = await db.checkDuplicate(item);
      const rowResult = {
        lead: item,
        isDuplicate: dup.isDuplicate,
        duplicateReason: dup.isDuplicate ? `${dup.matchField}: ${dup.matchValue}` : null,
        existingId: dup.isDuplicate ? dup.lead.id : null
      };
      preview.push(rowResult);
      if (!dup.isDuplicate) {
        validToImport.push(item);
      }
    }

    if (previewOnly) {
      return res.status(200).json({
        total: leads.length,
        validCount: validToImport.length,
        duplicateCount: preview.filter(p => p.isDuplicate).length,
        preview
      });
    }

    // Commit import
    const created = [];
    for (const item of validToImport) {
      const c = await db.createLead(item);
      created.push(c);
    }

    return res.status(200).json({
      success: true,
      importedCount: created.length,
      skippedDuplicates: preview.filter(p => p.isDuplicate).length
    });
  } catch (err) {
    console.error('API import error:', err);
    return res.status(500).json({ error: 'Import failed: ' + err.message });
  }
};
