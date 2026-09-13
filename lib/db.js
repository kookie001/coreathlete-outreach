const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;

function getPool() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Local file store fallback for development / seed (gitignored)
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalLeads() {
  ensureDataDir();
  if (fs.existsSync(LEADS_FILE)) {
    try {
      const content = fs.readFileSync(LEADS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Error reading local leads.json:', e);
    }
  }
  return [];
}

function writeLocalLeads(leads) {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

function readLocalSettings() {
  ensureDataDir();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {}
  }
  return defaultSettings;
}

function writeLocalSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

// Default Settings
const defaultSettings = {
  cities: [
    { name: 'Delhi NCR', phase: 1 },
    { name: 'Gurgaon', phase: 1 },
    { name: 'Noida', phase: 1 },
    { name: 'Ghaziabad', phase: 1 },
    { name: 'Faridabad', phase: 1 },
    { name: 'Mumbai', phase: 2 },
    { name: 'Bangalore', phase: 2 },
    { name: 'Pune', phase: 2 },
    { name: 'Hyderabad', phase: 2 },
    { name: 'Chandigarh', phase: 2 },
    { name: 'Chennai', phase: 3 },
    { name: 'Ahmedabad', phase: 3 },
    { name: 'Jaipur', phase: 3 },
    { name: 'Kolkata', phase: 3 },
    { name: 'Indore', phase: 3 }
  ],
  roles: [
    'Strength & Conditioning Coach',
    'Sports Performance Coach',
    'Strength Coach',
    'Online Coach',
    'Online Personal Trainer',
    'Personal Trainer',
    'Fitness Coach',
    'Functional Fitness Coach',
    'CrossFit Coach',
    'MMA Coach',
    'Boxing Coach',
    'Combat Sports Coach',
    'Running Coach',
    'Endurance Coach',
    'Cricket S&C Coach',
    'Football S&C Coach',
    'Sports Coach',
    'Sports Dietitian',
    'Sports Nutritionist',
    'Performance Nutritionist',
    'Dietitian',
    'Nutritionist',
    'Other'
  ],
  statuses: [
    '⏳ Not Contacted',
    '📤 Sent',
    '💬 Replied',
    '⭐ Interested',
    '🎥 Demo Sent',
    '📞 Call Scheduled',
    '🔄 Follow Up',
    '🤝 Trial / Onboarding',
    '💰 Won / Paid',
    '❌ Lost',
    '🚫 Not Interested',
    '❌ Number Invalid',
    '🛑 Do Not Contact'
  ],
  sources: ['Google Maps', 'Instagram', 'LinkedIn', 'Website', 'Referral', 'Other'],
  campaigns: ['September Founder Outreach', 'Delhi NCR Founder Outreach', 'October Launch', 'Mumbai Outreach']
};

/**
 * Normalizes an Indian/international phone number to last 10 digits.
 */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Computes the recommended Lead Score (0 to 5) based on criteria.
 */
function calculateLeadScore(lead) {
  let score = 0;
  const reasons = [];

  // +1: Works with athletes
  const athleteKeywords = ['cricket', 'football', 'mma', 'boxing', 'combat', 'running', 'endurance', 'strength', 'hybrid', 'crossfit', 's&c', 'performance'];
  const hasAthletes = (lead.athlete_types && lead.athlete_types.length > 0 && lead.athlete_types.some(t => athleteKeywords.some(k => t.toLowerCase().includes(k)))) ||
    athleteKeywords.some(k => (lead.role || '').toLowerCase().includes(k));
  if (hasAthletes) {
    score += 1;
    reasons.push('Works with athletes');
  }

  // +1: Offers online coaching
  if (lead.online_coaching === true || (lead.role || '').toLowerCase().includes('online')) {
    score += 1;
    reasons.push('Offers online coaching');
  }

  // +1: Uses custom programming
  const currentSys = (lead.current_system || '').toLowerCase();
  if (['google sheets', 'excel', 'trainerize', 'truecoach', 'everfit', 'pdf'].some(s => currentSys.includes(s)) || (lead.role || '').toLowerCase().includes('s&c')) {
    score += 1;
    reasons.push('Uses custom programming');
  }

  // +1: Manages multiple clients
  const count = String(lead.client_count || '');
  if (['11-20', '21-50', '50+', '4-10'].includes(count)) {
    score += 1;
    reasons.push('Manages multiple clients');
  }

  // +1: Combines strength with another modality / hybrid
  const roleLower = (lead.role || '').toLowerCase();
  if (roleLower.includes('hybrid') || roleLower.includes('functional') || roleLower.includes('performance') || roleLower.includes('s&c') || (lead.athlete_types && lead.athlete_types.length > 1)) {
    score += 1;
    reasons.push('Hybrid / multi-modality coaching');
  }

  return {
    score: Math.min(5, Math.max(0, score)),
    reasons: reasons
  };
}

/**
 * Seed initial leads from leads_100_fitness_coaches.csv if no leads exist.
 */
async function seedInitialLeadsIfEmpty() {
  const currentLeads = await getAllLeadsList();
  if (currentLeads.length > 0) return;

  const csvPath = path.join(__dirname, '..', 'leads_100_fitness_coaches.csv');
  if (!fs.existsSync(csvPath)) return;

  console.log('Seeding initial 101 leads from leads_100_fitness_coaches.csv...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return;

  const seeded = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 5) continue;

    const sno = row[0];
    const name = row[1];
    const catRole = row[2];
    const city = row[3];
    const rawPhone = row[4];
    const waLink = row[5] || `https://wa.me/${normalizePhone(rawPhone)}`;
    const status = row[6] || '⏳ Not Contacted';

    let role = 'Personal Trainer';
    if (catRole.includes('Dietitian')) role = 'Dietitian';
    else if (catRole.includes('Nutritionist')) role = 'Nutritionist';
    else if (catRole.includes('Yoga')) role = 'Yoga Teacher';
    else if (catRole.includes('S&C') || catRole.includes('Strength & Conditioning')) role = 'Strength & Conditioning Coach';
    else if (catRole.includes('Fitness Coach') || catRole.includes('Transformation')) role = 'Fitness Coach';

    const normalizedP = normalizePhone(rawPhone);

    const lead = {
      id: parseInt(sno, 10) || i,
      person_name: name,
      business_name: catRole.split('-')[1]?.trim() || name,
      role: role,
      city: city || 'Delhi NCR',
      area: '',
      state: city === 'Gurgaon' ? 'Haryana' : (city === 'Noida' ? 'Uttar Pradesh' : 'Delhi'),
      country: 'India',
      mobile: rawPhone,
      phone_normalized: normalizedP,
      whatsapp_link: waLink,
      email: '',
      instagram: '',
      website: '',
      maps_url: '',
      source: 'Google Maps',
      campaign: 'Delhi NCR Founder Outreach',
      online_coaching: catRole.toLowerCase().includes('online'),
      client_count: 'Unknown',
      athlete_types: ['General Fitness'],
      current_system: 'WhatsApp',
      pain_points: ['Client tracking', 'WhatsApp chaos', 'Follow-ups'],
      lead_score: 3,
      score_reasons: ['Initial qualification', 'Verified independent practitioner'],
      priority: 'MEDIUM',
      why_good: `${name} is an active independent coach in ${city}.`,
      qualification_notes: '',
      qualified: 'Needs Research',
      unqualified_reason: '',
      outreach_status: status.startsWith('⏳') ? status : `⏳ ${status}`,
      last_contact_date: null,
      next_follow_up_date: null,
      follow_up_notes: '',
      call_outcome: '',
      call_notes: '',
      general_notes: '',
      timeline: [
        {
          date: new Date().toISOString(),
          action: 'Lead Imported',
          notes: 'Imported from initial CoreAthlete 100 coach research list.'
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const calc = calculateLeadScore(lead);
    lead.lead_score = calc.score;
    lead.score_reasons = calc.reasons;
    if (lead.lead_score >= 4) lead.priority = 'HOT';
    else if (lead.lead_score === 3) lead.priority = 'HIGH';

    seeded.push(lead);
  }

  const p = getPool();
  if (p) {
    for (const l of seeded) {
      await insertLeadPostgres(p, l);
    }
  } else {
    writeLocalLeads(seeded);
  }
  console.log(`Successfully seeded ${seeded.length} leads!`);
}

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

async function insertLeadPostgres(p, l) {
  const query = `
    INSERT INTO outreach_leads (
      person_name, business_name, role, city, area, state, country,
      mobile, phone_normalized, whatsapp_link, email, instagram, website, maps_url,
      source, campaign, online_coaching, client_count, athlete_types,
      current_system, pain_points, lead_score, score_reasons, priority,
      why_good, qualification_notes, qualified, unqualified_reason,
      outreach_status, last_contact_date, next_follow_up_date, follow_up_notes,
      call_outcome, call_notes, general_notes, timeline, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24,
      $25, $26, $27, $28,
      $29, $30, $31, $32,
      $33, $34, $35, $36, $37, $38
    ) RETURNING *;
  `;
  const values = [
    l.person_name, l.business_name, l.role, l.city, l.area, l.state, l.country,
    l.mobile, l.phone_normalized, l.whatsapp_link, l.email, l.instagram, l.website, l.maps_url,
    l.source, l.campaign, l.online_coaching, l.client_count, JSON.stringify(l.athlete_types),
    l.current_system, JSON.stringify(l.pain_points), l.lead_score, JSON.stringify(l.score_reasons), l.priority,
    l.why_good, l.qualification_notes, l.qualified, l.unqualified_reason,
    l.outreach_status, l.last_contact_date, l.next_follow_up_date, l.follow_up_notes,
    l.call_outcome, l.call_notes, l.general_notes, JSON.stringify(l.timeline), l.created_at, l.updated_at
  ];
  const res = await p.query(query, values);
  return res.rows[0];
}

async function getAllLeadsList() {
  const p = getPool();
  if (p) {
    try {
      const res = await p.query('SELECT * FROM outreach_leads ORDER BY id ASC');
      return res.rows.map(formatPostgresLead);
    } catch (e) {
      console.error('Postgres error, falling back to local file:', e.message);
    }
  }
  return readLocalLeads();
}

function formatPostgresLead(row) {
  return {
    ...row,
    athlete_types: typeof row.athlete_types === 'string' ? JSON.parse(row.athlete_types) : (row.athlete_types || []),
    pain_points: typeof row.pain_points === 'string' ? JSON.parse(row.pain_points) : (row.pain_points || []),
    score_reasons: typeof row.score_reasons === 'string' ? JSON.parse(row.score_reasons) : (row.score_reasons || []),
    timeline: typeof row.timeline === 'string' ? JSON.parse(row.timeline) : (row.timeline || [])
  };
}

/**
 * Check for duplicate leads against existing records.
 */
async function checkDuplicate(leadData, excludeId = null) {
  const leads = await getAllLeadsList();
  const normPhone = normalizePhone(leadData.mobile || leadData.phone_normalized);
  const normIg = (leadData.instagram || '').toLowerCase().replace(/[@\s]/g, '').replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  const normWeb = (leadData.website || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const normName = (leadData.person_name || '').toLowerCase().trim();
  const normCity = (leadData.city || '').toLowerCase().trim();

  for (const l of leads) {
    if (excludeId && String(l.id) === String(excludeId)) continue;

    // 1. Phone match
    if (normPhone && l.phone_normalized && l.phone_normalized === normPhone) {
      return { isDuplicate: true, lead: l, matchField: 'Phone Number', matchValue: normPhone };
    }

    // 2. Instagram match
    if (normIg) {
      const existingIg = (l.instagram || '').toLowerCase().replace(/[@\s]/g, '').replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      if (existingIg && existingIg === normIg) {
        return { isDuplicate: true, lead: l, matchField: 'Instagram Handle', matchValue: normIg };
      }
    }

    // 3. Website match
    if (normWeb) {
      const existingWeb = (l.website || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      if (existingWeb && existingWeb === normWeb) {
        return { isDuplicate: true, lead: l, matchField: 'Website Domain', matchValue: normWeb };
      }
    }

    // 4. Name + City match
    if (normName && normCity && l.person_name && l.city) {
      if (l.person_name.toLowerCase().trim() === normName && l.city.toLowerCase().trim() === normCity) {
        return { isDuplicate: true, lead: l, matchField: 'Name and City', matchValue: `${l.person_name} (${l.city})` };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Filtered & paginated lead query
 */
async function getLeads(params = {}) {
  await seedInitialLeadsIfEmpty();
  let leads = await getAllLeadsList();

  // Search
  if (params.search) {
    const q = params.search.toLowerCase();
    leads = leads.filter(l =>
      (l.person_name || '').toLowerCase().includes(q) ||
      (l.business_name || '').toLowerCase().includes(q) ||
      (l.role || '').toLowerCase().includes(q) ||
      (l.city || '').toLowerCase().includes(q) ||
      (l.mobile || '').includes(q) ||
      (l.instagram || '').toLowerCase().includes(q) ||
      (l.website || '').toLowerCase().includes(q)
    );
  }

  // Filters
  if (params.role && params.role !== 'all') {
    leads = leads.filter(l => l.role === params.role);
  }
  if (params.city && params.city !== 'all') {
    leads = leads.filter(l => l.city === params.city);
  }
  if (params.state && params.state !== 'all') {
    leads = leads.filter(l => l.state === params.state);
  }
  if (params.source && params.source !== 'all') {
    leads = leads.filter(l => l.source === params.source);
  }
  if (params.campaign && params.campaign !== 'all') {
    leads = leads.filter(l => l.campaign === params.campaign);
  }
  if (params.status && params.status !== 'all') {
    leads = leads.filter(l => l.outreach_status === params.status);
  }
  if (params.priority && params.priority !== 'all') {
    leads = leads.filter(l => l.priority === params.priority);
  }
  if (params.minScore !== undefined && params.minScore !== null && params.minScore !== 'all') {
    const min = parseInt(params.minScore, 10);
    leads = leads.filter(l => (l.lead_score || 0) >= min);
  }
  if (params.onlineCoaching !== undefined && params.onlineCoaching !== 'all') {
    const isOnline = params.onlineCoaching === 'true' || params.onlineCoaching === true;
    leads = leads.filter(l => Boolean(l.online_coaching) === isOnline);
  }
  if (params.clientCount && params.clientCount !== 'all') {
    leads = leads.filter(l => l.client_count === params.clientCount);
  }
  if (params.currentSystem && params.currentSystem !== 'all') {
    leads = leads.filter(l => l.current_system === params.currentSystem);
  }
  if (params.athleteType && params.athleteType !== 'all') {
    leads = leads.filter(l => (l.athlete_types || []).includes(params.athleteType));
  }
  if (params.contacted !== undefined && params.contacted !== 'all') {
    const isContacted = params.contacted === 'true' || params.contacted === true;
    leads = leads.filter(l => {
      const isNot = l.outreach_status === '⏳ Not Contacted';
      return isContacted ? !isNot : isNot;
    });
  }
  if (params.followUpDue === 'true' || params.followUpDue === true) {
    const today = new Date().toISOString().slice(0, 10);
    leads = leads.filter(l => l.next_follow_up_date && l.next_follow_up_date.slice(0, 10) <= today && l.outreach_status !== '💰 Won / Paid' && l.outreach_status !== '🚫 Not Interested' && l.outreach_status !== '🛑 Do Not Contact');
  }

  // Sorting
  const sort = params.sort || 'priority';
  const order = (params.order || 'asc').toLowerCase();

  leads.sort((a, b) => {
    let valA = a[sort];
    let valB = b[sort];

    if (sort === 'priority') {
      const pMap = { HOT: 5, HIGH: 4, MEDIUM: 3, LOW: 2, SKIP: 1 };
      valA = pMap[a.priority] || 0;
      valB = pMap[b.priority] || 0;
      return order === 'asc' ? valB - valA : valA - valB;
    }

    if (sort === 'lead_score') {
      valA = a.lead_score || 0;
      valB = b.lead_score || 0;
      return order === 'asc' ? valB - valA : valA - valB;
    }

    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = leads.length;
  const page = parseInt(params.page, 10) || 1;
  const limit = parseInt(params.limit, 10) || 50;
  const start = (page - 1) * limit;
  const paginated = leads.slice(start, start + limit);

  return {
    leads: paginated,
    total: total,
    page: page,
    limit: limit,
    totalPages: Math.ceil(total / limit)
  };
}

async function getLeadById(id) {
  const leads = await getAllLeadsList();
  return leads.find(l => String(l.id) === String(id)) || null;
}

async function createLead(data) {
  const normPhone = normalizePhone(data.mobile);
  const calc = calculateLeadScore(data);

  const newLead = {
    id: Date.now(),
    person_name: (data.person_name || '').trim(),
    business_name: (data.business_name || '').trim() || (data.person_name || '').trim(),
    role: data.role || 'Strength & Conditioning Coach',
    city: data.city || 'Delhi NCR',
    area: data.area || '',
    state: data.state || 'Delhi',
    country: data.country || 'India',
    mobile: data.mobile || '',
    phone_normalized: normPhone,
    whatsapp_link: data.whatsapp_link || `https://wa.me/${normPhone}`,
    email: data.email || '',
    instagram: data.instagram || '',
    website: data.website || '',
    maps_url: data.maps_url || '',
    source: data.source || 'Google Maps',
    campaign: data.campaign || 'Founder Outreach',
    online_coaching: Boolean(data.online_coaching),
    client_count: data.client_count || 'Unknown',
    athlete_types: Array.isArray(data.athlete_types) ? data.athlete_types : ['General Fitness'],
    current_system: data.current_system || 'WhatsApp',
    pain_points: Array.isArray(data.pain_points) ? data.pain_points : [],
    lead_score: data.lead_score !== undefined ? data.lead_score : calc.score,
    score_reasons: data.score_reasons || calc.reasons,
    priority: data.priority || (calc.score >= 4 ? 'HOT' : (calc.score === 3 ? 'HIGH' : 'MEDIUM')),
    why_good: data.why_good || '',
    qualification_notes: data.qualification_notes || '',
    qualified: data.qualified || 'Needs Research',
    unqualified_reason: data.unqualified_reason || '',
    outreach_status: data.outreach_status || '⏳ Not Contacted',
    last_contact_date: data.last_contact_date || null,
    next_follow_up_date: data.next_follow_up_date || null,
    follow_up_notes: data.follow_up_notes || '',
    call_outcome: data.call_outcome || '',
    call_notes: data.call_notes || '',
    general_notes: data.general_notes || '',
    timeline: [
      {
        date: new Date().toISOString(),
        action: 'Lead Created',
        notes: `Quick captured via ${data.source || 'Google Maps'}`
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const p = getPool();
  if (p) {
    const created = await insertLeadPostgres(p, newLead);
    return formatPostgresLead(created);
  }

  const leads = readLocalLeads();
  leads.unshift(newLead);
  writeLocalLeads(leads);
  return newLead;
}

async function updateLead(id, updates) {
  const p = getPool();
  if (p) {
    const lead = await getLeadById(id);
    if (!lead) return null;

    const merged = { ...lead, ...updates, updated_at: new Date().toISOString() };
    if (updates.mobile) {
      merged.phone_normalized = normalizePhone(updates.mobile);
      merged.whatsapp_link = `https://wa.me/${merged.phone_normalized}`;
    }

    const query = `
      UPDATE outreach_leads SET
        person_name = $1, business_name = $2, role = $3, city = $4, area = $5, state = $6,
        mobile = $7, phone_normalized = $8, whatsapp_link = $9, email = $10, instagram = $11,
        website = $12, maps_url = $13, source = $14, campaign = $15, online_coaching = $16,
        client_count = $17, athlete_types = $18, current_system = $19, pain_points = $20,
        lead_score = $21, score_reasons = $22, priority = $23, why_good = $24,
        qualification_notes = $25, qualified = $26, unqualified_reason = $27,
        outreach_status = $28, last_contact_date = $29, next_follow_up_date = $30,
        follow_up_notes = $31, call_outcome = $32, call_notes = $33, general_notes = $34,
        timeline = $35, updated_at = $36
      WHERE id = $37 RETURNING *;
    `;
    const values = [
      merged.person_name, merged.business_name, merged.role, merged.city, merged.area, merged.state,
      merged.mobile, merged.phone_normalized, merged.whatsapp_link, merged.email, merged.instagram,
      merged.website, merged.maps_url, merged.source, merged.campaign, merged.online_coaching,
      merged.client_count, JSON.stringify(merged.athlete_types), merged.current_system, JSON.stringify(merged.pain_points),
      merged.lead_score, JSON.stringify(merged.score_reasons), merged.priority, merged.why_good,
      merged.qualification_notes, merged.qualified, merged.unqualified_reason,
      merged.outreach_status, merged.last_contact_date, merged.next_follow_up_date,
      merged.follow_up_notes, merged.call_outcome, merged.call_notes, merged.general_notes,
      JSON.stringify(merged.timeline), merged.updated_at, id
    ];
    const res = await p.query(query, values);
    return formatPostgresLead(res.rows[0]);
  }

  const leads = readLocalLeads();
  const idx = leads.findIndex(l => String(l.id) === String(id));
  if (idx === -1) return null;

  const lead = leads[idx];
  const merged = { ...lead, ...updates, updated_at: new Date().toISOString() };
  if (updates.mobile) {
    merged.phone_normalized = normalizePhone(updates.mobile);
    merged.whatsapp_link = `https://wa.me/${merged.phone_normalized}`;
  }

  leads[idx] = merged;
  writeLocalLeads(leads);
  return merged;
}

async function deleteLead(id) {
  const p = getPool();
  if (p) {
    await p.query('DELETE FROM outreach_leads WHERE id = $1', [id]);
    return true;
  }
  const leads = readLocalLeads();
  const filtered = leads.filter(l => String(l.id) !== String(id));
  writeLocalLeads(filtered);
  return true;
}

async function addTimelineEvent(leadId, action, notes = '') {
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  const timeline = lead.timeline || [];
  timeline.unshift({
    date: new Date().toISOString(),
    action: action,
    notes: notes
  });

  return await updateLead(leadId, { timeline });
}

async function getStats() {
  await seedInitialLeadsIfEmpty();
  const leads = await getAllLeadsList();

  const total = leads.length;
  let notContacted = 0;
  let contacted = 0;
  let replied = 0;
  let interested = 0;
  let demoSent = 0;
  let callScheduled = 0;
  let followUp = 0;
  let trial = 0;
  let won = 0;
  let lost = 0;
  let notInterested = 0;
  let invalidNumber = 0;
  let doNotContact = 0;

  let hotLeads = 0;
  let highPriority = 0;
  let followUpsDueToday = 0;

  const today = new Date().toISOString().slice(0, 10);

  const cityMap = {};
  const roleMap = {};
  const campaignMap = {};
  const sourceMap = {};

  leads.forEach(l => {
    const s = l.outreach_status || '⏳ Not Contacted';
    if (s.includes('Not Contacted')) notContacted++;
    else if (s.includes('Sent')) contacted++;
    else if (s.includes('Replied')) { contacted++; replied++; }
    else if (s.includes('Interested')) { contacted++; replied++; interested++; }
    else if (s.includes('Demo')) { contacted++; replied++; interested++; demoSent++; }
    else if (s.includes('Call')) { contacted++; replied++; callScheduled++; }
    else if (s.includes('Follow Up')) { contacted++; followUp++; }
    else if (s.includes('Trial')) { contacted++; replied++; interested++; demoSent++; trial++; }
    else if (s.includes('Won')) { contacted++; replied++; interested++; demoSent++; trial++; won++; }
    else if (s.includes('Lost')) lost++;
    else if (s.includes('Not Interested')) notInterested++;
    else if (s.includes('Invalid')) invalidNumber++;
    else if (s.includes('Do Not Contact')) doNotContact++;

    if (l.priority === 'HOT') hotLeads++;
    if (l.priority === 'HIGH') highPriority++;

    if (l.next_follow_up_date && l.next_follow_up_date.slice(0, 10) <= today && s !== '💰 Won / Paid' && s !== '🚫 Not Interested') {
      followUpsDueToday++;
    }

    const c = l.city || 'Other';
    cityMap[c] = (cityMap[c] || 0) + 1;

    const r = l.role || 'Other';
    roleMap[r] = (roleMap[r] || 0) + 1;

    const camp = l.campaign || 'Default';
    campaignMap[camp] = (campaignMap[camp] || 0) + 1;

    const src = l.source || 'Other';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });

  const funnel = {
    leads: total,
    contacted: contacted,
    replied: replied,
    interested: interested,
    demo: demoSent,
    trial: trial,
    paid: won,
    rates: {
      contactedRate: total ? Math.round((contacted / total) * 100) : 0,
      replyRate: contacted ? Math.round((replied / contacted) * 100) : 0,
      interestedRate: replied ? Math.round((interested / replied) * 100) : 0,
      demoRate: interested ? Math.round((demoSent / interested) * 100) : 0,
      trialRate: demoSent ? Math.round((trial / demoSent) * 100) : 0,
      paidRate: trial ? Math.round((won / trial) * 100) : 0,
      overallConversion: total ? (won / total * 100).toFixed(1) : '0.0'
    }
  };

  return {
    total,
    notContacted,
    contacted,
    replied,
    interested,
    demoSent,
    callScheduled,
    followUp,
    trial,
    won,
    lost,
    notInterested,
    invalidNumber,
    doNotContact,
    hotLeads,
    highPriority,
    followUpsDueToday,
    funnel,
    breakdowns: {
      byCity: cityMap,
      byRole: roleMap,
      byCampaign: campaignMap,
      bySource: sourceMap
    }
  };
}

async function getTodayWork() {
  await seedInitialLeadsIfEmpty();
  const leads = await getAllLeadsList();
  const today = new Date().toISOString().slice(0, 10);

  const followUpsDue = leads.filter(l =>
    l.next_follow_up_date &&
    l.next_follow_up_date.slice(0, 10) === today &&
    !['💰 Won / Paid', '🚫 Not Interested', '🛑 Do Not Contact'].includes(l.outreach_status)
  );

  const overdueFollowUps = leads.filter(l =>
    l.next_follow_up_date &&
    l.next_follow_up_date.slice(0, 10) < today &&
    !['💰 Won / Paid', '🚫 Not Interested', '🛑 Do Not Contact'].includes(l.outreach_status)
  );

  const hotNotContacted = leads.filter(l =>
    l.priority === 'HOT' && l.outreach_status === '⏳ Not Contacted'
  );

  const recentlyReplied = leads.filter(l =>
    l.outreach_status === '💬 Replied' || l.outreach_status === '⭐ Interested'
  );

  const demosScheduled = leads.filter(l =>
    l.outreach_status === '🎥 Demo Sent' || l.outreach_status === '📞 Call Scheduled'
  );

  return {
    followUpsDue,
    overdueFollowUps,
    hotNotContacted,
    recentlyReplied,
    demosScheduled
  };
}

async function getSettings() {
  return readLocalSettings();
}

async function saveSettings(data) {
  writeLocalSettings(data);
  return data;
}

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  addTimelineEvent,
  checkDuplicate,
  calculateLeadScore,
  getStats,
  getTodayWork,
  getSettings,
  saveSettings,
  normalizePhone,
  seedInitialLeadsIfEmpty
};
