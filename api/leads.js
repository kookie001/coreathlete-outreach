const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Enforce mandatory server-side authentication
  if (!requireAuth(req, res)) return;

  const method = req.method;
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  try {
    // GET /api/leads - List, get by id, or check duplicate
    if (method === 'GET') {
      const action = req.query.action;
      if (action === 'check-duplicate') {
        const phone = req.query.phone || req.query.mobile || '';
        const instagram = req.query.instagram || req.query.instagram_handle || '';
        const dupCheck = await db.checkDuplicate({ mobile: phone, instagram: instagram });
        return res.status(200).json({
          isDuplicate: dupCheck.isDuplicate,
          duplicate: dupCheck.isDuplicate ? dupCheck.lead : null,
          matchField: dupCheck.matchField || null,
          matchValue: dupCheck.matchValue || null
        });
      }

      const id = req.query.id;
      if (id) {
        const lead = await db.getLeadById(id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        // Ensure both field aliases are available
        lead.mobile_number = lead.mobile || lead.mobile_number;
        lead.instagram_handle = lead.instagram || lead.instagram_handle;
        return res.status(200).json({ lead, ...lead });
      }

      const result = await db.getLeads(req.query);
      // Ensure all leads have both mobile and mobile_number, instagram and instagram_handle
      if (result.leads) {
        result.leads.forEach(l => {
          l.mobile_number = l.mobile || l.mobile_number;
          l.instagram_handle = l.instagram || l.instagram_handle;
        });
      }
      return res.status(200).json(result);
    }

    // POST /api/leads - Create / Quick Add with Duplicate Check
    if (method === 'POST') {
      const mobileVal = body?.mobile || body?.mobile_number;
      if (!body || !body.person_name || !mobileVal) {
        return res.status(400).json({ error: 'Person Name and Mobile are required.' });
      }

      body.mobile = mobileVal;
      body.mobile_number = mobileVal;
      if (body.instagram_handle && !body.instagram) body.instagram = body.instagram_handle;
      if (body.instagram && !body.instagram_handle) body.instagram_handle = body.instagram;

      // Duplicate detection
      const dupCheck = await db.checkDuplicate(body);
      if (dupCheck.isDuplicate && !body.force) {
        return res.status(409).json({
          error: `Possible duplicate lead detected via ${dupCheck.matchField}.`,
          duplicate: true,
          matchField: dupCheck.matchField,
          matchValue: dupCheck.matchValue,
          existingLead: dupCheck.lead
        });
      }

      const created = await db.createLead(body);
      created.mobile_number = created.mobile || created.mobile_number;
      created.instagram_handle = created.instagram || created.instagram_handle;
      return res.status(201).json({ lead: created, ...created });
    }

    // PATCH / PUT /api/leads - Update lead
    if (method === 'PATCH' || method === 'PUT') {
      const id = req.query.id || body?.id;
      if (!id) return res.status(400).json({ error: 'Lead ID is required.' });

      if (body.mobile_number && !body.mobile) body.mobile = body.mobile_number;
      if (body.instagram_handle && !body.instagram) body.instagram = body.instagram_handle;

      // If updating mobile/instagram, check for duplicate conflicts with OTHER leads
      if (body.mobile || body.instagram) {
        const dupCheck = await db.checkDuplicate(body, id);
        if (dupCheck.isDuplicate && !body.force) {
          return res.status(409).json({
            error: `Conflict: Another lead has the same ${dupCheck.matchField}.`,
            duplicate: true,
            existingLead: dupCheck.lead
          });
        }
      }

      // Check if status changed and log timeline
      const existing = await db.getLeadById(id);
      if (existing && body.outreach_status && body.outreach_status !== existing.outreach_status) {
        const timeline = existing.timeline || [];
        timeline.unshift({
          date: new Date().toISOString(),
          action: `Status: ${body.outreach_status}`,
          notes: body.status_note || `Status updated from ${existing.outreach_status} to ${body.outreach_status}`
        });
        body.timeline = timeline;
        body.last_contact_date = new Date().toISOString();
      }

      const updated = await db.updateLead(id, body);
      if (!updated) return res.status(404).json({ error: 'Lead not found.' });
      updated.mobile_number = updated.mobile || updated.mobile_number;
      updated.instagram_handle = updated.instagram || updated.instagram_handle;
      return res.status(200).json({ lead: updated, ...updated });
    }

    // DELETE /api/leads - Delete lead
    if (method === 'DELETE') {
      const id = req.query.id || body?.id;
      if (!id) return res.status(400).json({ error: 'Lead ID is required.' });

      await db.deleteLead(id);
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API leads error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
