const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (!requireAuth(req, res)) return;

  try {
    const stats = await db.getStats();
    const today = await db.getTodayWork();
    return res.status(200).json({
      totalLeads: stats.total,
      funnel: stats.funnel,
      todayWork: {
        followupsToday: today.followUpsDue?.length || stats.followUpsDueToday || 0,
        overdue: today.overdueFollowUps?.length || 0,
        hotLeads: stats.hotLeads || 0,
        notContacted: stats.notContacted || 0,
        replied: stats.replied || 0,
        todayFollowupsList: today.followUpsDue || [],
        overdueList: today.overdueFollowUps || []
      },
      countsByStatus: {
        '⏳ Not Contacted': stats.notContacted,
        '📤 Sent': stats.contacted,
        '💬 Replied': stats.replied,
        '⭐ Interested': stats.interested,
        '🎥 Demo Sent': stats.demoSent,
        '🔄 Follow Up': stats.followUp,
        '🤝 Trial / Onboarding': stats.trial,
        '💰 Won / Paid': stats.won,
        '🚫 Not Interested': stats.notInterested
      },
      countsByCity: stats.breakdowns?.byCity || {},
      countsByRole: stats.breakdowns?.byRole || {},
      countsByCampaign: stats.breakdowns?.byCampaign || {},
      countsBySource: stats.breakdowns?.bySource || {},
      stats,
      today
    });
  } catch (err) {
    console.error('API stats error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
