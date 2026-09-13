const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const result = await db.getLeads({ ...req.query, limit: 10000 });
    const leads = result.leads;

    // Build CSV
    const headers = [
      'ID', 'Priority', 'Lead Score', 'Person Name', 'Business Name', 'Role',
      'City', 'Area', 'State', 'Mobile', 'WhatsApp Link', 'Instagram', 'Website',
      'Source', 'Campaign', 'Online Coaching', 'Client Count', 'Current System',
      'Outreach Status', 'Last Contact', 'Next Follow-up', 'Call Outcome', 'Why Good'
    ];

    const rows = leads.map(l => [
      l.id,
      l.priority,
      l.lead_score,
      `"${(l.person_name || '').replace(/"/g, '""')}"`,
      `"${(l.business_name || '').replace(/"/g, '""')}"`,
      `"${(l.role || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.area || '').replace(/"/g, '""')}"`,
      `"${(l.state || '').replace(/"/g, '""')}"`,
      `"${(l.mobile || '').replace(/"/g, '""')}"`,
      `"${(l.whatsapp_link || '').replace(/"/g, '""')}"`,
      `"${(l.instagram || '').replace(/"/g, '""')}"`,
      `"${(l.website || '').replace(/"/g, '""')}"`,
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${(l.campaign || '').replace(/"/g, '""')}"`,
      l.online_coaching ? 'Yes' : 'No',
      `"${(l.client_count || '').replace(/"/g, '""')}"`,
      `"${(l.current_system || '').replace(/"/g, '""')}"`,
      `"${(l.outreach_status || '').replace(/"/g, '""')}"`,
      l.last_contact_date ? l.last_contact_date.slice(0, 10) : '',
      l.next_follow_up_date ? l.next_follow_up_date.slice(0, 10) : '',
      `"${(l.call_outcome || '').replace(/"/g, '""')}"`,
      `"${(l.why_good || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="coreathlete_outreach_leads.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('API export error:', err);
    return res.status(500).json({ error: 'Export failed: ' + err.message });
  }
};
