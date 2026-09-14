/**
 * COREATHLETE — LEAD QUALIFICATION ENGINE V2
 * 10-Point Scoring Algorithm & Negative Filter Rules
 */

const NICHE_PRIORITIES = [
  'Sports & Performance',
  'Strength & Conditioning',
  'Concurrent / Multi-Discipline',
  'HYROX / Endurance-Strength',
  'Professional Online Strength',
  'Body Composition & Fat Loss'
];

/**
 * Calculates the 10-point qualification score for a prospect.
 * 
 * Positive Signals:
 * +2: Personal brand / independent coach identity (not facility-dominated)
 * +2: Online / custom coaching clearly offered
 * +2: Real client testimonials / results with names & timeframes
 * +2: Coaching software screenshot/watermark visible (Trainerize, TrueCoach, bTrainr, CoachRx, Everfit)
 * +1: Multiple training modalities / meaningful programming complexity
 * +1: Own application / payment funnel (Calendly, Typeform, bio link)
 * +2: Visible WhatsApp/Sheets/check-in/programming workflow chaos
 * 
 * Negative Filters:
 * -4: Primarily gym/studio/facility identity (Automatic disqualification)
 * -3: Primarily influencer/affiliate/business-content model
 */
function calculate10PointScore(lead) {
  let rawScore = 0;
  const breakdown = [];
  let isRejected = false;
  let rejectionReason = '';

  // 1. Negative Filters FIRST
  const isGym = lead.is_gym_or_studio === true || 
    /\b(gym|fitness studio|fitness club|gym chain|facility|crossfit box|anytime fitness|cult\.fit|gold's gym)\b/i.test(lead.business_name || '') ||
    /\b(gym|studio|club|facility|crossfit box)\b/i.test(lead.role || '') ||
    /\b(gym|studio|club|facility)\b/i.test(lead.notes || '') ||
    lead.source === 'Google Maps Facility';

  const isGenericInfluencer = lead.is_generic_influencer === true ||
    lead.influencer_affiliate_model === true ||
    /\b(affiliate|discount code|supplements sponsor|gymshark athlete|fashion nova|mass challenge|ebook seller)\b/i.test(lead.bio || lead.observed_workflow_signal || '');

  if (isGym) {
    rawScore -= 4;
    breakdown.push({ points: -4, label: 'Primarily gym/studio/facility identity (Commercial entity)', positive: false });
    isRejected = true;
    rejectionReason = 'Profile represents a commercial gym, studio, or facility rather than an independent coach.';
  }

  if (isGenericInfluencer) {
    rawScore -= 3;
    breakdown.push({ points: -3, label: 'Primarily influencer/affiliate/mass challenge creator', positive: false });
    if (!rejectionReason) {
      rejectionReason = 'Profile relies on generic workout content, sponsorships, or generic ebooks with no individualized 1:1 coaching.';
    }
  }

  // 2. Positive Signals
  // Signal A: Personal brand / independent coach identity (+2)
  if (lead.has_personal_brand === true || (lead.name && !isGym)) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Personal brand / independent coach identity', positive: true });
  }

  // Signal B: Online / custom coaching clearly offered (+2)
  if (lead.is_online_coaching === 'YES' || lead.is_online_coaching === true || lead.online_coaching === true) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Online / custom coaching clearly offered', positive: true });
  }

  // Signal C: Real client testimonials / results with names & timeframes (+2)
  if (lead.has_client_testimonials === 'YES' || lead.has_client_testimonials === true) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Real client testimonials/results with names & timeframes', positive: true });
  }

  // Signal D: Coaching software screenshot/watermark visible (+2)
  if (lead.coaching_software_visible === 'YES' || lead.coaching_software_visible === true || 
      (lead.coaching_software && lead.coaching_software !== 'None' && lead.coaching_software !== 'Unknown')) {
    rawScore += 2;
    breakdown.push({ points: 2, label: `Coaching software visible (${lead.coaching_software || 'Trainerize/TrueCoach/CoachRx'})`, positive: true });
  }

  // Signal E: Multiple training modalities / programming complexity (+1)
  if (lead.multiple_modalities === true || lead.is_custom_programming === 'YES' || lead.is_custom_programming === true) {
    rawScore += 1;
    breakdown.push({ points: 1, label: 'Multiple training modalities / individualized programming complexity', positive: true });
  }

  // Signal F: Own application / payment funnel (+1)
  if (lead.application_funnel_visible === 'YES' || lead.application_funnel_visible === true || 
      (lead.application_funnel && lead.application_funnel !== 'None' && lead.application_funnel !== 'Unknown')) {
    rawScore += 1;
    breakdown.push({ points: 1, label: `Own application/payment funnel (${lead.application_funnel || 'Form/Calendly/Link'})`, positive: true });
  }

  // Signal G: Visible WhatsApp/Sheets/check-in/programming workflow chaos (+2)
  if (lead.workflow_chaos_visible === true || 
      /sheet|excel|whatsapp|form|notion|check-in|review|feedback|voice note|chaos/i.test(lead.observed_workflow_signal || '')) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Visible WhatsApp/Sheets/check-in operational complexity', positive: true });
  }

  // Clamped Final Score (0 to 10)
  let finalScore = Math.max(0, Math.min(10, rawScore));

  // Determine Qualification Tier
  let tier = 'POTENTIAL';
  if (isRejected || finalScore < 4) {
    tier = 'DISQUALIFIED';
    isRejected = true;
  } else if (finalScore >= 8) {
    tier = 'HOT PROSPECT';
  } else if (finalScore >= 6) {
    tier = 'QUALIFIED';
  } else {
    tier = 'POTENTIAL';
  }

  let reason = '';
  if (isRejected) {
    reason = rejectionReason || 'Score below qualification threshold (operational complexity or independent coaching evidence missing).';
  } else {
    const positiveItems = breakdown.filter(b => b.positive).map(b => b.label);
    reason = `Qualified (${finalScore}/10). High-intent signals: ${positiveItems.join(', ')}.`;
  }

  return {
    score: finalScore,
    rawScore,
    tier,
    breakdown,
    isRejected,
    rejectionReason: isRejected ? (rejectionReason || 'Disqualified by negative filter or low qualification score') : null,
    reason_for_score: reason
  };
}

/**
 * Builds high-intent multi-channel search queries with strict negative exclusions.
 */
function generateChannelSearchQuery(channel, niche, location = 'India') {
  const negativeExclusions = '-gym -studio -club -facility -crossfit_box -"fitness center" -"health club"';
  
  const nicheKeywords = {
    'Sports & Performance': '("sports performance coach" OR "athletic performance" OR "athlete development" OR "speed and agility")',
    'Strength & Conditioning': '("strength and conditioning coach" OR "S&C coach" OR "CSCS" OR "barbell coach")',
    'Concurrent / Multi-Discipline': '("concurrent training" OR "hybrid athlete" OR "strength and endurance" OR "triathlon coach")',
    'HYROX / Endurance-Strength': '("HYROX coach" OR "HYROX training" OR "endurance coach" OR "race prep coach")',
    'Professional Online Strength': '("online strength coach" OR "powerlifting coach" OR "custom strength program")',
    'Body Composition & Fat Loss': '("online physique coach" OR "body recomposition coach" OR "custom programming")'
  };

  const selectedNicheQuery = nicheKeywords[niche] || '("online fitness coach" OR "online strength coach" OR "1:1 coaching")';

  switch (channel.toLowerCase()) {
    case 'instagram':
      return {
        channel: 'Instagram',
        query: `site:instagram.com ${selectedNicheQuery} ("DM to apply" OR "client check-ins" OR "accepting clients" OR "weekly check-in") ("${location}" OR "Delhi" OR "Mumbai" OR "Bangalore") ${negativeExclusions}`,
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${selectedNicheQuery} ("DM to apply" OR "client check-ins" OR "accepting clients" OR "weekly check-in") ${negativeExclusions}`)}`
      };

    case 'youtube':
      return {
        channel: 'YouTube',
        query: `site:youtube.com ${selectedNicheQuery} ("client check in" OR "how I program for clients" OR "weekly check in" OR "google sheets" OR "trainerize") ${negativeExclusions}`,
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:youtube.com ${selectedNicheQuery} ("client check in" OR "how I program for clients" OR "weekly check in") ${negativeExclusions}`)}`
      };

    case 'linkedin':
      return {
        channel: 'LinkedIn',
        query: `site:linkedin.com/in ${selectedNicheQuery} ("online coaching" OR "remote coaching" OR "custom programming") ("${location}" OR "India") ${negativeExclusions}`,
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in ${selectedNicheQuery} ("online coaching" OR "custom programming") ${negativeExclusions}`)}`
      };

    case 'google':
    default:
      return {
        channel: 'Google Search',
        query: `${selectedNicheQuery} ("apply for coaching" OR "1:1 coaching" OR "client check-in") ("${location}" OR "India") ${negativeExclusions}`,
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${selectedNicheQuery} ("apply for coaching" OR "1:1 coaching") ("${location}" OR "India") ${negativeExclusions}`)}`
      };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculate10PointScore,
    generateChannelSearchQuery,
    NICHE_PRIORITIES
  };
}
