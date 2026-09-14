/**
 * COREATHLETE — Coach Prospector & Outreach CRM V2
 * Client-Side Private OS with AES-256-GCM Vault Decryption
 * Built for Founder-led Outreach to Independent Professional Fitness Coaches
 */

// ================= GLOBAL APPLICATION STATE =================
const state = {
  isUnlocked: false,
  leads: [],
  filteredLeads: [],
  currentLead: null,
  activeTab: 'dashboard',
  searchQuery: '',
  discoveryChannel: 'Instagram',
  filters: {
    tier: 'all',
    niche: 'all',
    social_channel: 'all',
    status: 'all',
    priority: 'all',
    quick: ''
  },
  sortField: 'qualification_score',
  sortAsc: false,
  pagination: {
    page: 1,
    pageSize: 50,
    total: 0
  },
  settings: {
    niches: [
      'Sports & Performance',
      'Strength & Conditioning',
      'Concurrent / Multi-Discipline',
      'HYROX / Endurance-Strength',
      'Professional Online Strength',
      'Body Composition & Fat Loss'
    ],
    channels: ['Instagram', 'YouTube', 'LinkedIn', 'Google Search', 'Facebook', 'Directory'],
    statuses: [
      '⏳ Not Contacted',
      '📤 Sent',
      '💬 Replied',
      '⭐ Interested',
      '🎥 Demo Sent',
      '🔄 Follow Up',
      '🤝 Trial / Onboarding',
      '💰 Won / Paid',
      '🚫 Not Interested'
    ]
  },
  vault: null,
  sessionPassword: null
};

// ================= UTILITIES & TOAST =================
function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotice');
  const toastText = document.getElementById('toastNoticeText');
  if (!toast || !toastText) return;
  toastText.textContent = message;
  toast.style.borderColor = isError ? '#ef4444' : 'var(--lime)';
  toast.style.color = isError ? '#fca5a5' : '#fff';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function bufToBase64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function normalizeDigits(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
  if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
  return cleaned.slice(-10);
}

function formatPhoneDisplay(phone) {
  const norm = normalizeDigits(phone);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone || '—';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isDateOverdue(dateStr) {
  if (!dateStr || dateStr === '—') return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

// ================= 10-POINT QUALIFICATION ENGINE =================
function calculate10PointScore(lead) {
  let rawScore = 0;
  const breakdown = [];
  let isRejected = false;
  let rejectionReason = '';

  const biz = (lead.business_name || '') + ' ' + (lead.role || '') + ' ' + (lead.general_notes || '');
  const isGym = lead.is_gym_or_studio === true || 
    /\b(gym|fitness studio|fitness club|gym chain|facility|crossfit box|anytime fitness|cult\.fit|gold's gym)\b/i.test(biz) ||
    lead.source === 'Google Maps Facility';

  const isGenericInfluencer = lead.is_generic_influencer === true ||
    lead.influencer_affiliate_model === true ||
    /\b(affiliate|discount code|supplements sponsor|gymshark athlete|fashion nova|mass challenge|ebook seller)\b/i.test(lead.bio || lead.observed_workflow_signal || '');

  if (isGym) {
    rawScore -= 4;
    breakdown.push({ points: -4, label: 'Commercial gym/studio/facility identity', positive: false });
    isRejected = true;
    rejectionReason = 'Commercial gym or fitness facility identity rather than independent coach.';
  }

  if (isGenericInfluencer) {
    rawScore -= 3;
    breakdown.push({ points: -3, label: 'Generic influencer/affiliate model', positive: false });
    if (!rejectionReason) {
      rejectionReason = 'Generic influencer content with no individualized coaching.';
    }
  }

  // Positive Signal 1: Personal brand / independent coach (+2)
  if (lead.has_personal_brand === true || (lead.name && !isGym && !isGenericInfluencer)) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Personal brand / independent coach identity', positive: true });
  }

  // Positive Signal 2: Online / custom coaching offered (+2)
  if (lead.is_online_coaching === 'YES' || lead.is_online_coaching === true || lead.online_coaching === true) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Online / custom coaching clearly offered', positive: true });
  }

  // Positive Signal 3: Real client testimonials / results with names (+2)
  if (lead.has_client_testimonials === 'YES' || lead.has_client_testimonials === true) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Real client testimonials/results with names & timeframes', positive: true });
  }

  // Positive Signal 4: Coaching software visible (+2)
  const software = String(lead.coaching_software || '').toLowerCase();
  const hasDedicatedSoftware = ['trainerize', 'truecoach', 'coachrx', 'everfit', 'btrainr'].some(s => software.includes(s));
  if ((lead.coaching_software_visible === 'YES' || lead.coaching_software_visible === true) && hasDedicatedSoftware) {
    rawScore += 2;
    breakdown.push({ points: 2, label: `Coaching software visible (${lead.coaching_software})`, positive: true });
  }

  // Positive Signal 5: Multiple modalities / programming complexity (+1)
  if (lead.multiple_modalities === true || lead.is_custom_programming === 'YES') {
    rawScore += 1;
    breakdown.push({ points: 1, label: 'Multiple modalities / programming complexity', positive: true });
  }

  // Positive Signal 6: Own application / payment funnel (+1)
  const funnel = String(lead.application_funnel || '').toLowerCase();
  const hasFunnel = ['typeform', 'calendly', 'form', 'linktree', 'website', 'stripe', 'notion'].some(f => funnel.includes(f));
  if ((lead.application_funnel_visible === 'YES' || lead.application_funnel_visible === true) && hasFunnel) {
    rawScore += 1;
    breakdown.push({ points: 1, label: `Own application/payment funnel (${lead.application_funnel})`, positive: true });
  }

  // Positive Signal 7: Visible WhatsApp/Sheets workflow chaos (+2)
  const sig = String(lead.observed_workflow_signal || '');
  if (lead.workflow_chaos_visible === true || /sheet|excel|check-in|review|feedback|voice note|chaos|backlog/i.test(sig)) {
    rawScore += 2;
    breakdown.push({ points: 2, label: 'Visible WhatsApp/Sheets operational chaos', positive: true });
  }

  const finalScore = Math.max(0, Math.min(10, rawScore));

  let tier = 'POTENTIAL';
  if (isRejected || finalScore < 4) {
    tier = 'DISQUALIFIED';
    isRejected = true;
  } else if (finalScore >= 8) {
    tier = 'HOT PROSPECT';
  } else if (finalScore >= 6) {
    tier = 'QUALIFIED';
  }

  const reason = isRejected ? (rejectionReason || 'Score below qualification threshold.') : `Score ${finalScore}/10. High-intent signals: ${breakdown.filter(b => b.positive).map(b => b.label).join(', ')}`;

  return {
    score: finalScore,
    rawScore,
    tier,
    breakdown,
    isRejected,
    reason_for_score: reason
  };
}

// ================= MULTI-CHANNEL DISCOVERY ASSISTANT =================
function openDiscoveryModal() {
  const modal = document.getElementById('discoveryModal');
  if (!modal) return;
  modal.classList.add('active');
  updateDiscoveryQuery();
}

function closeDiscoveryModal() {
  const modal = document.getElementById('discoveryModal');
  if (modal) modal.classList.remove('active');
}

function selectDiscoveryChannel(channel) {
  state.discoveryChannel = channel;
  document.querySelectorAll('.channel-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(channel));
  });
  updateDiscoveryQuery();
}

function updateDiscoveryQuery() {
  const nicheSelect = document.getElementById('discoveryNicheSelect');
  const locationSelect = document.getElementById('discoveryLocationSelect');
  const queryBox = document.getElementById('discoveryQueryText');
  if (!nicheSelect || !locationSelect || !queryBox) return;

  const niche = nicheSelect.value;
  const location = locationSelect.value;
  const channel = state.discoveryChannel;

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
  let query = '';

  switch (channel.toLowerCase()) {
    case 'instagram':
      query = `site:instagram.com ${selectedNicheQuery} ("DM to apply" OR "client check-ins" OR "accepting clients" OR "weekly check-in") ("${location}" OR "India") ${negativeExclusions}`;
      break;
    case 'youtube':
      query = `site:youtube.com ${selectedNicheQuery} ("client check in" OR "how I program for clients" OR "weekly check in" OR "google sheets" OR "trainerize") ${negativeExclusions}`;
      break;
    case 'linkedin':
      query = `site:linkedin.com/in ${selectedNicheQuery} ("online coaching" OR "remote coaching" OR "custom programming") ("${location}" OR "India") ${negativeExclusions}`;
      break;
    case 'google':
    default:
      query = `${selectedNicheQuery} ("apply for coaching" OR "1:1 coaching" OR "client check-in") ("${location}" OR "India") ${negativeExclusions}`;
      break;
  }

  queryBox.value = query;
}

function copyDiscoveryQuery() {
  const queryBox = document.getElementById('discoveryQueryText');
  if (!queryBox) return;
  navigator.clipboard.writeText(queryBox.value).then(() => {
    showToast('Search query copied to clipboard!');
  }).catch(() => {
    showToast('Copy failed. Please manually copy text.', true);
  });
}

function launchDiscoverySearch() {
  const queryBox = document.getElementById('discoveryQueryText');
  if (!queryBox || !queryBox.value) return;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queryBox.value)}`;
  window.open(searchUrl, '_blank');
}

// ================= LIVE SCORE METER IN QUICK ADD MODAL =================
function calculateModalLiveScore() {
  const isGym = document.getElementById('checkGym')?.checked;
  const isInfluencer = document.getElementById('checkInfluencer')?.checked;
  const hasBrand = document.getElementById('checkBrand')?.checked;
  const isOnline = document.getElementById('checkOnline')?.checked;
  const hasTestimonials = document.getElementById('checkTestimonials')?.checked;
  const hasSoftware = document.getElementById('checkSoftware')?.checked;
  const hasModalities = document.getElementById('checkModalities')?.checked;
  const hasFunnel = document.getElementById('checkFunnel')?.checked;
  const hasChaos = document.getElementById('checkChaos')?.checked;

  const softwareSelect = document.getElementById('quickInputSoftware')?.value;
  const funnelSelect = document.getElementById('quickInputFunnel')?.value;
  const signalInput = document.getElementById('quickInputSignal')?.value || '';

  let rawScore = 0;
  if (isGym) rawScore -= 4;
  if (isInfluencer) rawScore -= 3;
  if (hasBrand && !isGym) rawScore += 2;
  if (isOnline) rawScore += 2;
  if (hasTestimonials) rawScore += 2;
  if (hasSoftware || (softwareSelect && !['None', 'Unknown'].includes(softwareSelect))) rawScore += 2;
  if (hasModalities) rawScore += 1;
  if (hasFunnel || (funnelSelect && !['None', 'Unknown'].includes(funnelSelect))) rawScore += 1;
  if (hasChaos || /sheet|excel|whatsapp|check-in|review|feedback|voice note/i.test(signalInput)) rawScore += 2;

  const finalScore = Math.max(0, Math.min(10, rawScore));

  let tier = 'POTENTIAL';
  if (isGym || isInfluencer || finalScore < 4) {
    tier = 'DISQUALIFIED';
  } else if (finalScore >= 8) {
    tier = 'HOT PROSPECT';
  } else if (finalScore >= 6) {
    tier = 'QUALIFIED';
  }

  const scoreVal = document.getElementById('modalScoreVal');
  const tierVal = document.getElementById('modalTierVal');
  const scoreDisplay = document.getElementById('modalScoreDisplay');
  const warn = document.getElementById('modalDisqualifyWarning');

  if (scoreVal) scoreVal.textContent = finalScore;
  if (tierVal) tierVal.textContent = tier;
  if (warn) warn.style.display = (isGym || isInfluencer) ? 'block' : 'none';

  if (scoreDisplay) {
    scoreDisplay.className = `score-display-badge ${tier === 'HOT PROSPECT' ? 'badge-tier-hot' : (tier === 'QUALIFIED' ? 'badge-tier-qualified' : (tier === 'DISQUALIFIED' ? 'badge-tier-disqualified' : 'badge-tier-potential'))}`;
  }
}

// ================= VAULT ENCRYPTION & AUTHENTICATION =================
async function unlockVaultWithPassword(password) {
  let vaultJsonStr = localStorage.getItem('ca_encrypted_vault');
  let vault;

  if (vaultJsonStr) {
    try {
      vault = JSON.parse(vaultJsonStr);
    } catch (e) {}
  }

  if (!vault) {
    const res = await fetch('vault.json');
    if (!res.ok) {
      throw new Error('Could not load vault.json asset.');
    }
    vault = await res.json();
  }

  state.vault = vault;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuf = hexToBuf(vault.salt);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: vault.iterations || 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt', 'encrypt']
  );

  const ivBuf = hexToBuf(vault.iv);
  const ctBuf = base64ToBuf(vault.ciphertext);

  let decryptedBuf;
  try {
    decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      derivedKey,
      ctBuf
    );
  } catch (err) {
    throw new Error('Incorrect founder password. Vault unlock failed.');
  }

  const dec = new TextDecoder('utf-8');
  const plaintext = dec.decode(decryptedBuf);
  const leadsData = JSON.parse(plaintext);

  state.leads = leadsData.map(l => {
    const qual = calculate10PointScore(l);
    return {
      ...l,
      name: l.name || l.person_name || 'Coach',
      social_channel: l.social_channel || (l.instagram ? 'Instagram' : (l.website ? 'Website' : 'Google Search')),
      social_handle: l.social_handle || l.instagram || l.website || 'Unknown',
      niche: l.niche || 'Strength & Conditioning',
      city_country: l.city_country || `${l.city || 'India'}, India`,
      qualification_score: qual.score,
      qualification_tier: qual.tier,
      reason_for_score: qual.reason_for_score,
      score_breakdown: qual.breakdown
    };
  });

  state.sessionPassword = password;
  state.isUnlocked = true;
  sessionStorage.setItem('ca_session_password', password);

  return true;
}

async function persistVaultEdits() {
  if (!state.sessionPassword || !state.vault) return;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(state.sessionPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuf = hexToBuf(state.vault.salt);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: state.vault.iterations || 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const plaintext = JSON.stringify(state.leads);
  const plaintextBuf = enc.encode(plaintext);
  const newIv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: newIv },
    derivedKey,
    plaintextBuf
  );

  state.vault.iv = bufToHex(newIv);
  state.vault.ciphertext = bufToBase64(encryptedBuf);
  state.vault.lead_count = state.leads.length;
  state.vault.updated_at = new Date().toISOString();

  localStorage.setItem('ca_encrypted_vault', JSON.stringify(state.vault));
}

async function handleLogin(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('passwordInput');
  const errDiv = document.getElementById('authError');
  const btn = document.getElementById('loginBtn');
  if (!pwdInput) return;

  const password = pwdInput.value.trim();
  if (!password) return;

  btn.textContent = 'DECRYPTING VAULT...';
  btn.disabled = true;
  errDiv.textContent = '';

  try {
    await unlockVaultWithPassword(password);
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('appView').style.display = 'block';
    initializeAppUI();
    showToast('Vault unlocked. Coach OS V2 initialized.');
  } catch (err) {
    errDiv.textContent = err.message || 'Unlock failed';
  } finally {
    btn.textContent = 'ENTER DASHBOARD';
    btn.disabled = false;
  }
}

function handleLogout() {
  state.isUnlocked = false;
  state.leads = [];
  state.sessionPassword = null;
  sessionStorage.removeItem('ca_session_password');
  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  const pwdInput = document.getElementById('passwordInput');
  if (pwdInput) pwdInput.value = '';
  showToast('Logged out securely.');
}

async function checkSessionOnLoad() {
  const savedPwd = sessionStorage.getItem('ca_session_password');
  if (savedPwd) {
    try {
      await unlockVaultWithPassword(savedPwd);
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('appView').style.display = 'block';
      initializeAppUI();
      return;
    } catch (e) {
      sessionStorage.removeItem('ca_session_password');
    }
  }
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('appView').style.display = 'none';
}

// ================= UI INITIALIZATION & DASHBOARD =================
function initializeAppUI() {
  applyFilters();
  computeAndRenderDashboard();
}

function computeAndRenderDashboard() {
  const total = state.leads.length;
  const hot = state.leads.filter(l => l.qualification_tier === 'HOT PROSPECT').length;
  const qualified = state.leads.filter(l => l.qualification_tier === 'QUALIFIED').length;
  const potential = state.leads.filter(l => l.qualification_tier === 'POTENTIAL').length;
  const disqualified = state.leads.filter(l => l.qualification_tier === 'DISQUALIFIED').length;

  const notContacted = state.leads.filter(l => l.outreach_status === '⏳ Not Contacted').length;
  const contacted = state.leads.filter(l => l.outreach_status === '📤 Sent').length;
  const replied = state.leads.filter(l => l.outreach_status === '💬 Replied').length;
  const interested = state.leads.filter(l => l.outreach_status === '⭐ Interested').length;
  const trial = state.leads.filter(l => l.outreach_status === '🤝 Trial / Onboarding').length;
  const paid = state.leads.filter(l => l.outreach_status === '💰 Won / Paid').length;

  // Metric counts
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('metric-total', total);
  setEl('metric-hot-prospects', hot);
  setEl('metric-qualified-coaches', qualified);
  setEl('metric-potential', potential);
  setEl('metric-disqualified', disqualified);
  setEl('metric-not-contacted', notContacted);
  setEl('metric-contacted', contacted);
  setEl('metric-replied', replied);
  setEl('metric-interested', interested);
  setEl('metric-trial', trial);

  // Today's action strip
  setEl('todayHotCount', hot);
  setEl('todayQualifiedCount', qualified);
  setEl('todayNewCount', notContacted);
  setEl('todayRepliedCount', replied);

  // Funnel
  setEl('funnel-leads', total);
  setEl('funnel-qualified', hot + qualified);
  setEl('rate-qualified', total ? `${Math.round(((hot + qualified) / total) * 100)}%` : '0%');
  setEl('funnel-contacted', contacted + replied + interested + trial + paid);
  setEl('rate-contacted', total ? `${Math.round(((contacted + replied + interested + trial + paid) / total) * 100)}%` : '0%');
  setEl('funnel-replied', replied + interested + trial + paid);
  setEl('rate-replied', contacted ? `${Math.round(((replied + interested + trial + paid) / (contacted + replied + interested + trial + paid)) * 100)}%` : '0%');
  setEl('funnel-interested', interested + trial + paid);
  setEl('rate-interested', replied ? `${Math.round(((interested + trial + paid) / (replied + interested + trial + paid)) * 100)}%` : '0%');
  setEl('funnel-paid', paid);
  setEl('rate-paid', (interested + trial + paid) ? `${Math.round((paid / (interested + trial + paid)) * 100)}%` : '0%');

  // Tab count badges
  setEl('tabCountLeads', total);
}

// ================= NAVIGATION & VIEWS =================
function switchMainTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const dashPanel = document.getElementById('tabView-dashboard');
  const analyticsPanel = document.getElementById('tabView-analytics');
  const leadsWrapper = document.getElementById('leadsSectionWrapper');

  if (tab === 'dashboard') {
    if (dashPanel) dashPanel.style.display = 'block';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    clearAllFilters();
  } else if (tab === 'leads') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
  } else if (tab === 'top20') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    applySavedView('top_20_hot');
  } else if (tab === 'today') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    applySavedView('followups_today');
  } else if (tab === 'analytics') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'block';
    if (leadsWrapper) leadsWrapper.style.display = 'none';
    renderAnalytics();
  }
}

// ================= SEARCH & FILTERING =================
function handleSearchInput() {
  const input = document.getElementById('globalSearchInput');
  state.searchQuery = input ? input.value.trim().toLowerCase() : '';
  state.pagination.page = 1;
  applyFilters();
}

function setFilter(type, value) {
  state.filters[type] = value;
  state.pagination.page = 1;

  const rowId = `${type}FiltersRow`;
  const row = document.getElementById(rowId);
  if (row) {
    row.querySelectorAll('.filter-pill').forEach(pill => {
      pill.classList.toggle('active', pill.textContent.includes(value) || (value === 'all' && pill.textContent.includes('All')));
    });
  }

  applyFilters();
}

function filterByTier(tier) {
  setFilter('tier', tier);
  const leadsWrap = document.getElementById('leadsSectionWrapper');
  if (leadsWrap) leadsWrap.scrollIntoView({ behavior: 'smooth' });
}

function filterByStatus(status) {
  state.filters.status = status;
  state.pagination.page = 1;
  applyFilters();
  const leadsWrap = document.getElementById('leadsSectionWrapper');
  if (leadsWrap) leadsWrap.scrollIntoView({ behavior: 'smooth' });
}

function quickFilter(type) {
  state.filters.quick = type;
  if (type === 'hotLeads') {
    setFilter('tier', 'HOT PROSPECT');
  } else if (type === 'qualifiedCoaches') {
    setFilter('tier', 'QUALIFIED');
  } else if (type === 'notContacted') {
    filterByStatus('⏳ Not Contacted');
  } else if (type === 'replied') {
    filterByStatus('💬 Replied');
  } else if (type === 'followupsToday') {
    applySavedView('followups_today');
  }
}

function applySavedView(view) {
  clearAllFilters(false);
  const select = document.getElementById('savedViewsSelect');
  if (select) select.value = view;

  if (view === 'top_20_hot') {
    state.filters.tier = 'HOT PROSPECT';
    state.sortField = 'qualification_score';
    state.sortAsc = false;
  } else if (view === 'all_qualified') {
    state.filters.quick = 'all_qualified';
  } else if (view === 'sports_performance') {
    state.filters.niche = 'Sports & Performance';
  } else if (view === 'sc_coaches') {
    state.filters.niche = 'Strength & Conditioning';
  } else if (view === 'hyrox_coaches') {
    state.filters.niche = 'HYROX / Endurance-Strength';
  } else if (view === 'concurrent_coaches') {
    state.filters.niche = 'Concurrent / Multi-Discipline';
  } else if (view === 'online_strength') {
    state.filters.niche = 'Professional Online Strength';
  } else if (view === 'has_software') {
    state.filters.quick = 'has_software';
  } else if (view === 'workflow_chaos') {
    state.filters.quick = 'workflow_chaos';
  } else if (view === 'followups_today') {
    state.filters.quick = 'followups_today';
  } else if (view === 'disqualified') {
    state.filters.tier = 'DISQUALIFIED';
  }

  applyFilters();
}

function clearAllFilters(rerender = true) {
  state.searchQuery = '';
  state.filters = {
    tier: 'all',
    niche: 'all',
    social_channel: 'all',
    status: 'all',
    priority: 'all',
    quick: ''
  };
  state.sortField = 'qualification_score';
  state.sortAsc = false;
  state.pagination.page = 1;

  const sInput = document.getElementById('globalSearchInput');
  if (sInput) sInput.value = '';

  const vSelect = document.getElementById('savedViewsSelect');
  if (vSelect) vSelect.value = '';

  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.textContent.includes('All'));
  });

  if (rerender) applyFilters();
}

function applyFilters() {
  let list = [...state.leads];

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(l => {
      const name = (l.name || l.person_name || '').toLowerCase();
      const niche = (l.niche || '').toLowerCase();
      const handle = (l.social_handle || l.instagram || '').toLowerCase();
      const signal = (l.observed_workflow_signal || '').toLowerCase();
      const city = (l.city_country || l.city || '').toLowerCase();
      const soft = (l.coaching_software || '').toLowerCase();
      const notes = (l.general_notes || l.call_notes || '').toLowerCase();
      return name.includes(q) || niche.includes(q) || handle.includes(q) || signal.includes(q) || city.includes(q) || soft.includes(q) || notes.includes(q);
    });
  }

  // Tier filter
  if (state.filters.tier !== 'all') {
    list = list.filter(l => l.qualification_tier === state.filters.tier);
  }

  // Niche filter
  if (state.filters.niche !== 'all') {
    list = list.filter(l => l.niche === state.filters.niche);
  }

  // Channel filter
  if (state.filters.social_channel !== 'all') {
    list = list.filter(l => l.social_channel === state.filters.social_channel);
  }

  // Status filter
  if (state.filters.status !== 'all') {
    list = list.filter(l => l.outreach_status === state.filters.status);
  }

  // Quick views
  if (state.filters.quick === 'all_qualified') {
    list = list.filter(l => ['HOT PROSPECT', 'QUALIFIED'].includes(l.qualification_tier));
  } else if (state.filters.quick === 'has_software') {
    list = list.filter(l => l.coaching_software && !['None', 'Unknown'].includes(l.coaching_software));
  } else if (state.filters.quick === 'workflow_chaos') {
    list = list.filter(l => /sheet|excel|whatsapp|check-in|review|feedback|voice note/i.test(l.observed_workflow_signal || ''));
  }

  // Sorting
  list.sort((a, b) => {
    let valA = a[state.sortField];
    let valB = b[state.sortField];

    if (state.sortField === 'qualification_score') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return state.sortAsc ? -1 : 1;
    if (valA > valB) return state.sortAsc ? 1 : -1;
    return 0;
  });

  state.filteredLeads = list;
  state.pagination.total = list.length;

  renderLeadsList();
  renderPagination();
}

function handleSort(field) {
  if (state.sortField === field) {
    state.sortAsc = !state.sortAsc;
  } else {
    state.sortField = field;
    state.sortAsc = false;
  }
  applyFilters();
}

// ================= TABLE & CARD RENDERING =================
function renderLeadsList() {
  const tbody = document.getElementById('leadsTableBody');
  const cardsGrid = document.getElementById('mobileCardsGrid');
  if (!tbody || !cardsGrid) return;

  tbody.innerHTML = '';
  cardsGrid.innerHTML = '';

  const start = (state.pagination.page - 1) * state.pagination.pageSize;
  const end = Math.min(start + state.pagination.pageSize, state.filteredLeads.length);
  const pageItems = state.filteredLeads.slice(start, end);

  if (pageItems.length === 0) {
    const emptyRow = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-dim);">
          No matching coach prospects found for current filters.
        </td>
      </tr>
    `;
    tbody.innerHTML = emptyRow;
    cardsGrid.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim); width: 100%;">No matching coaches.</div>';
    return;
  }

  pageItems.forEach(lead => {
    tbody.innerHTML += renderLeadTableRow(lead);
    cardsGrid.innerHTML += renderMobileCard(lead);
  });
}

function getTierBadgeHtml(tier, score) {
  if (tier === 'HOT PROSPECT') {
    return `<span class="badge-tier badge-tier-hot">🔥 ${score}/10 HOT</span>`;
  }
  if (tier === 'QUALIFIED') {
    return `<span class="badge-tier badge-tier-qualified">⭐ ${score}/10 QUALIFIED</span>`;
  }
  if (tier === 'POTENTIAL') {
    return `<span class="badge-tier badge-tier-potential">🟡 ${score}/10 REVIEW</span>`;
  }
  return `<span class="badge-tier badge-tier-disqualified">❌ ${score}/10 REJECTED</span>`;
}

function renderLeadTableRow(l) {
  const tierBadge = getTierBadgeHtml(l.qualification_tier, l.qualification_score);
  const channelIcon = l.social_channel === 'Instagram' ? '📸' : (l.social_channel === 'YouTube' ? '▶️' : (l.social_channel === 'LinkedIn' ? '💼' : '🌐'));
  const profileUrl = l.source_url || (l.social_handle?.startsWith('http') ? l.social_handle : `https://instagram.com/${(l.social_handle || '').replace('@', '')}`);
  
  const phone = l.mobile_number || l.mobile;
  const normPhone = normalizeDigits(phone);
  const waUrl = normPhone ? `https://wa.me/91${normPhone}` : '#';

  const statusOptions = state.settings.statuses.map(st => `
    <option value="${escapeHtml(st)}" ${l.outreach_status === st ? 'selected' : ''}>${escapeHtml(st)}</option>
  `).join('');

  return `
    <tr id="lead-row-${l.id}">
      <td>${tierBadge}</td>
      <td>
        <div style="font-weight: 700; color: #fff; cursor: pointer; font-size: 13px;" onclick="openLeadDrawer('${l.id}')">
          ${escapeHtml(l.name || l.person_name || 'Coach')}
        </div>
        <div style="font-size: 11px; color: #60a5fa; margin-top: 2px;">
          <a href="${profileUrl}" target="_blank" style="color: #60a5fa; text-decoration: none;">
            ${channelIcon} ${escapeHtml(l.social_handle || 'View Profile')}
          </a>
        </div>
      </td>
      <td>
        <span class="badge-role" style="font-size: 10px;">${escapeHtml(l.niche || 'Strength & Conditioning')}</span>
      </td>
      <td style="font-size: 11px; color: var(--text-dim);">${escapeHtml(l.city_country || l.city || 'India')}</td>
      <td>
        <div class="signal-snippet" title="${escapeHtml(l.observed_workflow_signal || '—')}">
          ${escapeHtml(l.observed_workflow_signal || '—')}
        </div>
      </td>
      <td style="font-size: 11px; color: #38bdf8;">${escapeHtml(l.coaching_software || '—')}</td>
      <td style="font-size: 11px; color: var(--text-dim);">${escapeHtml(l.application_funnel || '—')}</td>
      <td>
        <select class="tbl-status-select" onchange="handleStatusChange('${l.id}', this.value)">
          ${statusOptions}
        </select>
      </td>
      <td>
        ${normPhone ? `
          <a href="${waUrl}" target="_blank" class="btn-tbl-action btn-tbl-wa" title="Open WhatsApp">
            💬 WA
          </a>
        ` : `
          <a href="${profileUrl}" target="_blank" class="btn-tbl-action btn-tbl-ig" title="Open Profile">
            ${channelIcon} DM
          </a>
        `}
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-tbl-action" onclick="openSmartPitchModal('${l.id}')" title="Generate CoreAthlete Adaptation Pitch">💬 Pitch</button>
        <button class="btn-tbl-action" onclick="openLeadDrawer('${l.id}')" title="360° Coach Dossier">👁️</button>
      </td>
    </tr>
  `;
}

function renderMobileCard(l) {
  const tierBadge = getTierBadgeHtml(l.qualification_tier, l.qualification_score);
  const profileUrl = l.source_url || (l.social_handle?.startsWith('http') ? l.social_handle : `https://instagram.com/${(l.social_handle || '').replace('@', '')}`);
  const phone = l.mobile_number || l.mobile;
  const normPhone = normalizeDigits(phone);
  const waUrl = normPhone ? `https://wa.me/91${normPhone}` : '#';

  return `
    <div class="mobile-lead-card" id="mobile-card-${l.id}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <div style="font-weight: 800; color: #fff; font-size: 14px;" onclick="openLeadDrawer('${l.id}')">
            ${escapeHtml(l.name || l.person_name || 'Coach')}
          </div>
          <div style="font-size: 11px; color: #60a5fa;">
            <a href="${profileUrl}" target="_blank" style="color: #60a5fa; text-decoration: none;">
              ${escapeHtml(l.social_handle || 'Profile')}
            </a>
          </div>
        </div>
        <div>${tierBadge}</div>
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
        <span class="badge-role" style="font-size: 10px;">${escapeHtml(l.niche || 'Strength & Conditioning')}</span>
        <span class="badge-city" style="font-size: 10px;">${escapeHtml(l.city_country || 'India')}</span>
        ${l.coaching_software && l.coaching_software !== 'None' ? `<span style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; font-size: 10px; padding: 2px 6px; border-radius: 4px;">📱 ${escapeHtml(l.coaching_software)}</span>` : ''}
      </div>

      <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px; line-height: 1.4;">
        ${escapeHtml(l.observed_workflow_signal || 'No observed workflow notes')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
        <a href="${profileUrl}" target="_blank" class="btn-tbl-action" style="justify-content: center; padding: 8px;">📸 Profile</a>
        ${normPhone ? `<a href="${waUrl}" target="_blank" class="btn-tbl-action btn-tbl-wa" style="justify-content: center; padding: 8px;">💬 WA</a>` : '<button class="btn-tbl-action" style="opacity: 0.4; justify-content: center;">No WA</button>'}
        <button class="btn-tbl-action" onclick="openLeadDrawer('${l.id}')" style="justify-content: center; padding: 8px;">👁️ Dossier</button>
      </div>
    </div>
  `;
}

function renderPagination() {
  const start = state.filteredLeads.length ? (state.pagination.page - 1) * state.pagination.pageSize + 1 : 0;
  const end = Math.min(state.pagination.page * state.pagination.pageSize, state.filteredLeads.length);

  const startEl = document.getElementById('pageCountStart');
  const endEl = document.getElementById('pageCountEnd');
  const totalEl = document.getElementById('pageCountTotal');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (startEl) startEl.textContent = start;
  if (endEl) endEl.textContent = end;
  if (totalEl) totalEl.textContent = state.filteredLeads.length;

  if (prevBtn) prevBtn.disabled = state.pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = end >= state.filteredLeads.length;
}

function changePage(delta) {
  state.pagination.page += delta;
  renderLeadsList();
  renderPagination();
}

// ================= QUICK ADD / PROSPECT COACH =================
function openQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  if (!modal) return;
  modal.classList.add('active');
  calculateModalLiveScore();
}

function closeQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  if (modal) modal.classList.remove('active');
}

function handleQuickAddSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('quickInputName')?.value.trim();
  const niche = document.getElementById('quickInputNiche')?.value;
  const channel = document.getElementById('quickInputChannel')?.value;
  const handle = document.getElementById('quickInputHandle')?.value.trim();
  const city = document.getElementById('quickInputCity')?.value.trim() || 'India';
  const mobile = document.getElementById('quickInputMobile')?.value.trim() || '';
  const software = document.getElementById('quickInputSoftware')?.value || 'None';
  const funnel = document.getElementById('quickInputFunnel')?.value || 'None';
  const signal = document.getElementById('quickInputSignal')?.value.trim() || '';

  const isGym = document.getElementById('checkGym')?.checked || false;
  const isInfluencer = document.getElementById('checkInfluencer')?.checked || false;
  const hasBrand = document.getElementById('checkBrand')?.checked || true;
  const isOnline = document.getElementById('checkOnline')?.checked || true;
  const hasTestimonials = document.getElementById('checkTestimonials')?.checked || true;
  const hasSoftware = document.getElementById('checkSoftware')?.checked || false;
  const hasModalities = document.getElementById('checkModalities')?.checked || true;
  const hasFunnel = document.getElementById('checkFunnel')?.checked || false;
  const hasChaos = document.getElementById('checkChaos')?.checked || true;

  const leadCandidate = {
    name,
    person_name: name,
    business_name: `${name} Coaching`,
    role: `${niche} Coach`,
    niche,
    social_channel: channel,
    social_handle: handle,
    city_country: city,
    city: city.split(',')[0].trim(),
    mobile,
    mobile_number: mobile,
    coaching_software: software,
    coaching_software_visible: (hasSoftware || software !== 'None') ? 'YES' : 'NO',
    application_funnel: funnel,
    application_funnel_visible: (hasFunnel || funnel !== 'None') ? 'YES' : 'NO',
    observed_workflow_signal: signal,
    is_gym_or_studio: isGym,
    is_generic_influencer: isInfluencer,
    has_personal_brand: hasBrand,
    is_online_coaching: isOnline ? 'YES' : 'NO',
    online_coaching: isOnline,
    has_client_testimonials: hasTestimonials ? 'YES' : 'NO',
    multiple_modalities: hasModalities,
    workflow_chaos_visible: hasChaos,
    outreach_status: '⏳ Not Contacted'
  };

  const qual = calculate10PointScore(leadCandidate);
  const newLead = {
    ...leadCandidate,
    id: Date.now(),
    qualification_score: qual.score,
    lead_score: qual.score,
    qualification_tier: qual.tier,
    priority: qual.score >= 8 ? 'HOT' : (qual.score >= 6 ? 'HIGH' : 'MEDIUM'),
    reason_for_score: qual.reason_for_score,
    score_breakdown: qual.breakdown,
    created_at: new Date().toISOString(),
    timeline: [
      {
        date: new Date().toISOString(),
        action: 'Prospect Added',
        notes: `Evaluated ${qual.score}/10 (${qual.tier}). Signal: ${signal}`
      }
    ]
  };

  state.leads.unshift(newLead);
  persistVaultEdits();
  closeQuickAddModal();
  computeAndRenderDashboard();
  applyFilters();
  showToast(`Coach "${name}" saved! Qualified: ${qual.score}/10 (${qual.tier})`);
}

// ================= LEAD DETAIL DRAWER =================
function openLeadDrawer(leadId) {
  const lead = state.leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;
  state.currentLead = lead;

  const drawer = document.getElementById('leadDetailDrawer');
  if (!drawer) return;

  const nameEl = document.getElementById('drawerPersonName');
  const roleEl = document.getElementById('drawerBizRole');
  const scoreLarge = document.getElementById('drawerScoreLarge');
  const tierText = document.getElementById('drawerTierText');
  const reasonText = document.getElementById('drawerReasonText');

  if (nameEl) nameEl.textContent = lead.name || lead.person_name || 'Coach';
  if (roleEl) roleEl.textContent = `${lead.niche || 'Coach'} • ${lead.social_channel || 'Profile'} • ${lead.city_country || 'India'}`;
  if (scoreLarge) scoreLarge.textContent = `${lead.qualification_score || 0}/10`;
  if (tierText) tierText.textContent = lead.qualification_tier === 'HOT PROSPECT' ? '⭐⭐⭐ HOT PROSPECT' : (lead.qualification_tier === 'QUALIFIED' ? '⭐⭐ QUALIFIED COACH' : (lead.qualification_tier === 'DISQUALIFIED' ? '❌ DISQUALIFIED' : '🟡 POTENTIAL'));
  if (reasonText) reasonText.textContent = lead.reason_for_score || 'Score evaluated against ICP';

  // Social & WA buttons
  const profileUrl = lead.source_url || (lead.social_handle?.startsWith('http') ? lead.social_handle : `https://instagram.com/${(lead.social_handle || '').replace('@', '')}`);
  const socBtn = document.getElementById('drawerSocialBtn');
  if (socBtn) socBtn.href = profileUrl;

  const waBtn = document.getElementById('drawerWaBtn');
  const normPhone = normalizeDigits(lead.mobile || lead.mobile_number);
  if (waBtn) waBtn.href = normPhone ? `https://wa.me/91${normPhone}` : '#';

  // Fill inputs
  const setIn = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setIn('drawerInputName', lead.name || lead.person_name);
  setIn('drawerInputNiche', lead.niche);
  setIn('drawerInputChannel', lead.social_channel);
  setIn('drawerInputHandle', lead.social_handle);
  setIn('drawerInputCity', lead.city_country);
  setIn('drawerInputMobile', lead.mobile || lead.mobile_number);
  setIn('drawerInputSoftware', lead.coaching_software);
  setIn('drawerInputFunnel', lead.application_funnel);
  setIn('drawerInputSignal', lead.observed_workflow_signal);
  setIn('drawerInputCallNotes', lead.call_notes || lead.general_notes);

  // Status select
  const statusSel = document.getElementById('drawerInputStatus');
  if (statusSel) {
    statusSel.innerHTML = state.settings.statuses.map(st => `
      <option value="${escapeHtml(st)}" ${lead.outreach_status === st ? 'selected' : ''}>${escapeHtml(st)}</option>
    `).join('');
  }

  // Populate drawer checklist
  renderDrawerChecklist(lead);
  renderDrawerTimeline(lead);

  drawer.classList.add('active');
}

function renderDrawerChecklist(lead) {
  const container = document.getElementById('drawerChecklistContainer');
  if (!container) return;

  container.innerHTML = `
    <label class="check-item">
      <input type="checkbox" id="dCheckBrand" ${lead.has_personal_brand !== false ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+2</strong> Personal brand / coach identity</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckOnline" ${lead.is_online_coaching === 'YES' || lead.online_coaching ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+2</strong> Online / custom coaching offered</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckTestimonials" ${lead.has_client_testimonials === 'YES' ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+2</strong> Real client testimonials with names</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckSoftware" ${lead.coaching_software && !['None', 'Unknown'].includes(lead.coaching_software) ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+2</strong> Coaching software visible</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckModalities" ${lead.multiple_modalities !== false ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+1</strong> Programming complexity</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckFunnel" ${lead.application_funnel && !['None', 'Unknown'].includes(lead.application_funnel) ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+1</strong> Own application funnel</span>
    </label>
    <label class="check-item">
      <input type="checkbox" id="dCheckChaos" ${lead.workflow_chaos_visible !== false ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong>+2</strong> WhatsApp/Sheets check-in chaos</span>
    </label>
    <label class="check-item check-item-danger">
      <input type="checkbox" id="dCheckGym" ${lead.is_gym_or_studio ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong style="color:#ef4444;">-4</strong> Commercial Gym / Facility</span>
    </label>
    <label class="check-item check-item-danger">
      <input type="checkbox" id="dCheckInfluencer" ${lead.is_generic_influencer ? 'checked' : ''} onchange="updateDrawerLiveScore()">
      <span><strong style="color:#ef4444;">-3</strong> Generic Influencer / Ebook model</span>
    </label>
  `;
}

function updateDrawerLiveScore() {
  if (!state.currentLead) return;
  const isGym = document.getElementById('dCheckGym')?.checked || false;
  const isInfluencer = document.getElementById('dCheckInfluencer')?.checked || false;
  const hasBrand = document.getElementById('dCheckBrand')?.checked || false;
  const isOnline = document.getElementById('dCheckOnline')?.checked || false;
  const hasTestimonials = document.getElementById('dCheckTestimonials')?.checked || false;
  const hasSoftware = document.getElementById('dCheckSoftware')?.checked || false;
  const hasModalities = document.getElementById('dCheckModalities')?.checked || false;
  const hasFunnel = document.getElementById('dCheckFunnel')?.checked || false;
  const hasChaos = document.getElementById('dCheckChaos')?.checked || false;

  let raw = 0;
  if (isGym) raw -= 4;
  if (isInfluencer) raw -= 3;
  if (hasBrand && !isGym) raw += 2;
  if (isOnline) raw += 2;
  if (hasTestimonials) raw += 2;
  if (hasSoftware) raw += 2;
  if (hasModalities) raw += 1;
  if (hasFunnel) raw += 1;
  if (hasChaos) raw += 2;

  const finalScore = Math.max(0, Math.min(10, raw));
  let tier = 'POTENTIAL';
  if (isGym || isInfluencer || finalScore < 4) tier = 'DISQUALIFIED';
  else if (finalScore >= 8) tier = 'HOT PROSPECT';
  else if (finalScore >= 6) tier = 'QUALIFIED';

  const scoreLarge = document.getElementById('drawerScoreLarge');
  const tierText = document.getElementById('drawerTierText');
  if (scoreLarge) scoreLarge.textContent = `${finalScore}/10`;
  if (tierText) tierText.textContent = tier === 'HOT PROSPECT' ? '⭐⭐⭐ HOT PROSPECT' : (tier === 'QUALIFIED' ? '⭐⭐ QUALIFIED' : (tier === 'DISQUALIFIED' ? '❌ DISQUALIFIED' : '🟡 POTENTIAL'));
}

function saveLeadFromDrawer() {
  if (!state.currentLead) return;

  const lead = state.currentLead;
  lead.name = document.getElementById('drawerInputName')?.value.trim() || lead.name;
  lead.person_name = lead.name;
  lead.niche = document.getElementById('drawerInputNiche')?.value || lead.niche;
  lead.social_channel = document.getElementById('drawerInputChannel')?.value || lead.social_channel;
  lead.social_handle = document.getElementById('drawerInputHandle')?.value || lead.social_handle;
  lead.city_country = document.getElementById('drawerInputCity')?.value || lead.city_country;
  lead.mobile = document.getElementById('drawerInputMobile')?.value || lead.mobile;
  lead.mobile_number = lead.mobile;
  lead.coaching_software = document.getElementById('drawerInputSoftware')?.value || lead.coaching_software;
  lead.application_funnel = document.getElementById('drawerInputFunnel')?.value || lead.application_funnel;
  lead.observed_workflow_signal = document.getElementById('drawerInputSignal')?.value || lead.observed_workflow_signal;
  lead.outreach_status = document.getElementById('drawerInputStatus')?.value || lead.outreach_status;
  lead.call_notes = document.getElementById('drawerInputCallNotes')?.value || '';

  lead.is_gym_or_studio = document.getElementById('dCheckGym')?.checked || false;
  lead.is_generic_influencer = document.getElementById('dCheckInfluencer')?.checked || false;
  lead.has_personal_brand = document.getElementById('dCheckBrand')?.checked || true;
  lead.is_online_coaching = document.getElementById('dCheckOnline')?.checked ? 'YES' : 'NO';
  lead.online_coaching = document.getElementById('dCheckOnline')?.checked || false;
  lead.has_client_testimonials = document.getElementById('dCheckTestimonials')?.checked ? 'YES' : 'NO';
  lead.multiple_modalities = document.getElementById('dCheckModalities')?.checked || false;
  lead.workflow_chaos_visible = document.getElementById('dCheckChaos')?.checked || false;

  const qual = calculate10PointScore(lead);
  lead.qualification_score = qual.score;
  lead.lead_score = qual.score;
  lead.qualification_tier = qual.tier;
  lead.reason_for_score = qual.reason_for_score;

  persistVaultEdits();
  closeLeadDrawer();
  computeAndRenderDashboard();
  applyFilters();
  showToast('Coach dossier updated successfully.');
}

function closeLeadDrawer() {
  const drawer = document.getElementById('leadDetailDrawer');
  if (drawer) drawer.classList.remove('active');
  state.currentLead = null;
}

function closeDrawerOnOverlay(e) {
  if (e.target.id === 'leadDetailDrawer') {
    closeLeadDrawer();
  }
}

function closeModalOnOverlay(e, modalId) {
  if (e.target.id === modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }
}

function handleDeleteDrawerLead() {
  if (!state.currentLead) return;
  if (!confirm(`Are you sure you want to delete "${state.currentLead.name}"?`)) return;

  state.leads = state.leads.filter(l => l.id !== state.currentLead.id);
  persistVaultEdits();
  closeLeadDrawer();
  computeAndRenderDashboard();
  applyFilters();
  showToast('Lead deleted from vault.');
}

function handleStatusChange(leadId, newStatus) {
  const lead = state.leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;
  lead.outreach_status = newStatus;
  lead.last_contact_date = new Date().toISOString();
  persistVaultEdits();
  computeAndRenderDashboard();
  applyFilters();
  showToast(`Status updated to "${newStatus}"`);
}

function renderDrawerTimeline(lead) {
  const list = document.getElementById('drawerTimelineList');
  if (!list) return;
  list.innerHTML = '';
  const items = lead.timeline || [];
  if (!items.length) {
    list.innerHTML = '<div style="font-size: 11px; color: var(--text-dim);">No activity logged yet.</div>';
    return;
  }

  items.slice().reverse().forEach(item => {
    list.innerHTML += `
      <div class="timeline-item" style="border-left: 2px solid var(--border); padding-left: 10px; margin-bottom: 8px;">
        <div style="font-size: 10px; color: var(--text-dim);">${new Date(item.date).toLocaleDateString()}</div>
        <div style="font-weight: 700; color: #fff; font-size: 11px;">${escapeHtml(item.action)}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(item.notes || '')}</div>
      </div>
    `;
  });
}

function handleAddTimelineEvent() {
  if (!state.currentLead) return;
  const input = document.getElementById('drawerNewTimelineAction');
  if (!input || !input.value.trim()) return;

  const event = {
    date: new Date().toISOString(),
    action: input.value.trim(),
    notes: 'Logged by founder'
  };

  if (!state.currentLead.timeline) state.currentLead.timeline = [];
  state.currentLead.timeline.push(event);
  input.value = '';
  renderDrawerTimeline(state.currentLead);
  persistVaultEdits();
  showToast('Timeline activity logged.');
}

function copyDrawerPhone() {
  if (!state.currentLead) return;
  const phone = state.currentLead.mobile || state.currentLead.mobile_number;
  if (!phone) {
    showToast('No contact number available.', true);
    return;
  }
  navigator.clipboard.writeText(phone).then(() => {
    showToast(`Copied ${phone}`);
  });
}

// ================= SMART COACH ADAPTATION PITCH MODAL =================
function openSmartPitchModal(leadId) {
  const targetLead = leadId ? state.leads.find(l => String(l.id) === String(leadId)) : (state.currentLead || state.leads[0]);
  if (targetLead) state.currentLead = targetLead;

  const modal = document.getElementById('smartPitchModal');
  if (!modal) return;
  modal.classList.add('active');
  generatePitchText();
}

function closeSmartPitchModal() {
  const modal = document.getElementById('smartPitchModal');
  if (modal) modal.classList.remove('active');
}

function generatePitchText() {
  const templateSelect = document.getElementById('pitchTemplateSelect');
  const textarea = document.getElementById('smartPitchText');
  if (!templateSelect || !textarea) return;

  const lead = state.currentLead || { name: 'Coach', niche: 'Strength & Conditioning', observed_workflow_signal: 'check-in spreadsheets' };
  const coachFirstName = (lead.name || lead.person_name || 'Coach').split(' ')[0];
  const niche = lead.niche || 'strength & conditioning';
  const signal = lead.observed_workflow_signal || 'managing check-ins across WhatsApp';
  const angle = templateSelect.value;

  let pitch = '';

  if (angle === 'adaptation_chaos') {
    pitch = `Hey ${coachFirstName}, came across your profile and really respect your approach to ${niche} programming.\n\nSaw that you handle your check-ins and athlete reviews actively (${signal}). As athlete load grows, wrestling with Google Sheets, WhatsApp audio notes, and fragmented logs becomes an exhausting bottleneck.\n\nWe built COREATHLETE — an Elite Coach OS designed specifically around continuous adaptation: Athlete Brain → Execution Logs → Signals → Coach Review → Instant Program Adaptation.\n\nWe're inviting 10 top independent coaches to our private beta. Would you be open to checking out a 3-minute preview?`;
  } else if (angle === 'sc_athletes') {
    pitch = `Hi ${coachFirstName}, love the programming depth you share for your athletes.\n\nMost coaching platforms (Trainerize/TrueCoach) were built for generic workouts and completely break down when programming dual blocks for serious athletes (combining sport agility, velocity work, and heavy barbell cycles).\n\nWe engineered COREATHLETE specifically for high-level S&C and performance coaches who need true multi-block periodization and automated load adaptation based on athlete feedback.\n\nWould love to show you our private founder preview if you're open to it!`;
  } else if (angle === 'hyrox_endurance') {
    pitch = `Hey ${coachFirstName}, noticed your work coaching HYROX and concurrent endurance athletes!\n\nBalancing running pacing splits with heavy strength circuits is one of the hardest workflows to manage in standard apps or spreadsheets. Coaches usually end up drowning in WhatsApp check-ins just adjusting deloads.\n\nAt COREATHLETE, our Coach OS tracks both aerobic pacing and barbell strength signals to automate program adaptations without losing coach control.\n\nWould you be open to testing our private beta for your HYROX roster?`;
  } else if (angle === 'trainerize_migration') {
    pitch = `Hey ${coachFirstName}, quick question — are you running your athletes primarily on Trainerize or TrueCoach right now?\n\nAlmost every high-tier coach we speak with complains that those platforms feel like rigid 2016 workout builders: slow compliance tracking, zero intelligent adaptation, and constant spreadsheet side-tracking.\n\nWe built COREATHLETE to solve that exact workflow friction for independent coaches managing 15–40 clients.\n\nHappy to send over a private demo link if you're curious!`;
  } else {
    pitch = `Hi ${coachFirstName}, I'm Lucky, founder at COREATHLETE.\n\nWe're developing an elite Coach OS for independent professional coaches in India — replacing chaotic WhatsApp check-ins and Google Sheets with an automated feedback-to-adaptation workflow.\n\nBecause of your reputation in ${niche}, I would love to get your raw feedback on what we've built. Would you be open to a quick 5-min walk-through this week?`;
  }

  textarea.value = pitch.replace(/\\n/g, '\n');
}

function copyPitchFromModal() {
  const textarea = document.getElementById('smartPitchText');
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('Coach pitch copied to clipboard!');
  }).catch(() => {
    showToast('Copy failed.', true);
  });
}

// ================= EXPORT & IMPORT =================
function openExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) modal.classList.add('active');
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) modal.classList.remove('active');
}

function triggerExport(type) {
  let exportData = [];
  if (type === 'hot') {
    exportData = state.leads.filter(l => l.qualification_tier === 'HOT PROSPECT');
  } else if (type === 'qualified') {
    exportData = state.leads.filter(l => ['HOT PROSPECT', 'QUALIFIED'].includes(l.qualification_tier));
  } else if (type === 'filtered') {
    exportData = state.filteredLeads;
  } else {
    exportData = state.leads;
  }

  if (!exportData.length) {
    showToast('No coaches to export for selected view.', true);
    return;
  }

  const headers = [
    'ID', 'Name', 'Social Channel', 'Social Handle', 'City/Country', 'Priority Niche',
    'Online Coaching', 'Custom Programming', 'Coaching Software', 'Application Funnel',
    'Observed Workflow Signal', '10-Pt Score', 'Tier', 'Status', 'Mobile', 'Source URL'
  ];

  const csvRows = [headers.join(',')];

  exportData.forEach(l => {
    const row = [
      l.id,
      `"${(l.name || l.person_name || '').replace(/"/g, '""')}"`,
      `"${(l.social_channel || '').replace(/"/g, '""')}"`,
      `"${(l.social_handle || '').replace(/"/g, '""')}"`,
      `"${(l.city_country || '').replace(/"/g, '""')}"`,
      `"${(l.niche || '').replace(/"/g, '""')}"`,
      `"${l.is_online_coaching || 'Unknown'}"`,
      `"${l.is_custom_programming || 'Unknown'}"`,
      `"${(l.coaching_software || '').replace(/"/g, '""')}"`,
      `"${(l.application_funnel || '').replace(/"/g, '""')}"`,
      `"${(l.observed_workflow_signal || '').replace(/"/g, '""')}"`,
      l.qualification_score || 0,
      `"${l.qualification_tier || 'POTENTIAL'}"`,
      `"${(l.outreach_status || '').replace(/"/g, '""')}"`,
      `"${(l.mobile || l.mobile_number || '').replace(/"/g, '""')}"`,
      `"${(l.source_url || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `coreathlete_coaches_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  closeExportModal();
  showToast(`Exported ${exportData.length} coach records.`);
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.classList.add('active');
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.classList.remove('active');
}

function handleImportPreview() {
  const text = document.getElementById('importCsvText')?.value.trim();
  const preview = document.getElementById('importPreviewSummary');
  if (!text || !preview) return;

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  preview.style.display = 'block';
  preview.textContent = `Found ${lines.length - 1} rows. Ready to parse and run through 10-point qualification engine.`;
}

function handleImportCommit() {
  const text = document.getElementById('importCsvText')?.value.trim();
  if (!text) return;

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    showToast('CSV must have a header row and at least 1 lead row.', true);
    return;
  }

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    const candidate = {
      id: Date.now() + i,
      name: cols[0] || 'Coach',
      person_name: cols[0] || 'Coach',
      niche: cols[1] || 'Strength & Conditioning',
      social_channel: cols[2] || 'Instagram',
      social_handle: cols[3] || 'Unknown',
      city_country: cols[4] || 'India',
      coaching_software: cols[5] || 'None',
      outreach_status: '⏳ Not Contacted'
    };

    const qual = calculate10PointScore(candidate);
    candidate.qualification_score = qual.score;
    candidate.qualification_tier = qual.tier;
    candidate.reason_for_score = qual.reason_for_score;
    state.leads.unshift(candidate);
    imported++;
  }

  persistVaultEdits();
  closeImportModal();
  computeAndRenderDashboard();
  applyFilters();
  showToast(`Imported ${imported} coach candidates.`);
}

// ================= ANALYTICS =================
function renderAnalytics() {
  const scoreBox = document.getElementById('analyticsScoreBreakdown');
  const nicheBox = document.getElementById('analyticsNicheBreakdown');
  const channelBox = document.getElementById('analyticsChannelBreakdown');
  const softwareBox = document.getElementById('analyticsSoftwareBreakdown');

  if (!scoreBox) return;

  const tierCounts = {
    'HOT PROSPECT (8–10)': state.leads.filter(l => l.qualification_tier === 'HOT PROSPECT').length,
    'QUALIFIED (6–7)': state.leads.filter(l => l.qualification_tier === 'QUALIFIED').length,
    'POTENTIAL (4–5)': state.leads.filter(l => l.qualification_tier === 'POTENTIAL').length,
    'DISQUALIFIED (<4)': state.leads.filter(l => l.qualification_tier === 'DISQUALIFIED').length
  };

  scoreBox.innerHTML = Object.entries(tierCounts).map(([tier, count]) => `
    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px;">
      <span>${tier}</span>
      <span style="font-weight: 700; color: var(--lime); font-family: 'JetBrains Mono', monospace;">${count}</span>
    </div>
  `).join('');

  const nicheCounts = {};
  state.leads.forEach(l => {
    const n = l.niche || 'Other';
    nicheCounts[n] = (nicheCounts[n] || 0) + 1;
  });

  if (nicheBox) {
    nicheBox.innerHTML = Object.entries(nicheCounts).map(([n, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px;">
        <span>${escapeHtml(n)}</span>
        <span style="font-weight: 700; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">${count}</span>
      </div>
    `).join('');
  }

  const channelCounts = {};
  state.leads.forEach(l => {
    const c = l.social_channel || 'Unknown';
    channelCounts[c] = (channelCounts[c] || 0) + 1;
  });

  if (channelBox) {
    channelBox.innerHTML = Object.entries(channelCounts).map(([c, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px;">
        <span>${escapeHtml(c)}</span>
        <span style="font-weight: 700; color: #a78bfa; font-family: 'JetBrains Mono', monospace;">${count}</span>
      </div>
    `).join('');
  }

  const softwareCounts = {};
  state.leads.forEach(l => {
    const s = l.coaching_software || 'None';
    softwareCounts[s] = (softwareCounts[s] || 0) + 1;
  });

  if (softwareBox) {
    softwareBox.innerHTML = Object.entries(softwareCounts).map(([s, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px;">
        <span>${escapeHtml(s)}</span>
        <span style="font-weight: 700; color: #34d399; font-family: 'JetBrains Mono', monospace;">${count}</span>
      </div>
    `).join('');
  }
}

// ================= LIFECYCLE EVENT LISTENERS =================
window.addEventListener('DOMContentLoaded', () => {
  checkSessionOnLoad();
});
