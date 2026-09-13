/**
 * COREATHLETE — Founder Outreach CRM & Lead Research OS
 * Client-Side Private OS with AES-256-GCM Vault Decryption
 */

// ================= GLOBAL APPLICATION STATE =================
const state = {
  isUnlocked: false,
  leads: [],
  filteredLeads: [],
  currentLead: null,
  activeTab: 'dashboard',
  searchQuery: '',
  filters: {
    city: 'all',
    role: 'all',
    status: 'all',
    priority: 'all',
    score: 'all',
    source: 'all',
    quick: ''
  },
  sortField: 'lead_score',
  sortAsc: false,
  pagination: {
    page: 1,
    pageSize: 50,
    total: 0
  },
  settings: {
    roles: [
      'Strength & Conditioning Coach',
      'Sports Performance Coach',
      'Online Coach',
      'Personal Trainer',
      'Fitness Coach',
      'Sports Nutritionist',
      'Dietitian',
      'Yoga Teacher',
      'CrossFit Coach',
      'MMA Coach',
      'Boxing Coach'
    ],
    cities: [
      { name: 'Delhi NCR', phase: 1 },
      { name: 'Gurgaon', phase: 1 },
      { name: 'Noida', phase: 1 },
      { name: 'Mumbai', phase: 2 },
      { name: 'Bangalore', phase: 2 }
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
    ]
  },
  stats: null,
  vaultMeta: null,
  activePassword: ''
};

// ================= NOTIFICATIONS & HELPERS =================

function showToast(message) {
  const toast = document.getElementById('toastNotice');
  const text = document.getElementById('toastNoticeText');
  if (!toast || !text) return;
  text.textContent = message;
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
  const bin = window.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function normalizeDigits(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  return clean.length >= 10 ? clean.slice(-10) : clean;
}

function formatPhoneDisplay(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  return phone;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= AES-256-GCM VAULT DECRYPTION =================

async function unlockVaultWithPassword(password) {
  // Check local saved vault in localStorage first (for edits), else fetch vault.json
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

  state.vaultMeta = {
    version: vault.version,
    salt: vault.salt,
    iv: vault.iv,
    iterations: vault.iterations || 100000
  };

  const enc = new TextEncoder();
  const passKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const saltBuf = hexToBuf(vault.salt);
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: vault.iterations || 100000,
      hash: 'SHA-256'
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ivBuf = hexToBuf(vault.iv);
  const cipherBuf = base64ToBuf(vault.ciphertext);
  const tagBuf = hexToBuf(vault.tag);

  // Web Crypto API AES-GCM expects ciphertext and 16-byte tag concatenated
  const combined = new Uint8Array(cipherBuf.length + tagBuf.length);
  combined.set(cipherBuf, 0);
  combined.set(tagBuf, cipherBuf.length);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      derivedKey,
      combined
    );

    const jsonStr = new TextDecoder().decode(decrypted);
    const leads = JSON.parse(jsonStr);

    // Normalize phone and fields
    leads.forEach(l => {
      l.mobile_number = l.mobile || l.mobile_number || '';
      l.instagram_handle = l.instagram || l.instagram_handle || '';
    });

    state.leads = leads;
    state.isUnlocked = true;
    state.activePassword = password;
    sessionStorage.setItem('ca_vault_session', password);

    return leads;
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Incorrect founder password. Access denied.');
  }
}

// ================= AUTH & LOGIN HANDLERS =================

async function handleLogin(e) {
  if (e) e.preventDefault();
  const pwdInput = document.getElementById('passwordInput');
  const errDiv = document.getElementById('authError');
  const btn = document.getElementById('loginBtn');
  const password = pwdInput ? pwdInput.value.trim() : '';

  if (!password) return;
  if (errDiv) errDiv.textContent = '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'UNLOCKING VAULT...';
  }

  try {
    await unlockVaultWithPassword(password);

    document.getElementById('loginView').style.display = 'none';
    document.getElementById('appView').style.display = 'block';
    showToast(`⚡ Welcome, Founder! Decrypted ${state.leads.length} leads.`);
    
    populateDropdowns();
    computeAndRenderDashboard();
    applyFilters();
  } catch (err) {
    if (errDiv) errDiv.textContent = '🔒 ' + err.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'ENTER DASHBOARD';
    }
  }
}

function handleLogout() {
  state.isUnlocked = false;
  state.leads = [];
  state.filteredLeads = [];
  state.currentLead = null;
  state.activePassword = '';
  sessionStorage.removeItem('ca_vault_session');

  const pwdInput = document.getElementById('passwordInput');
  if (pwdInput) pwdInput.value = '';
  const errDiv = document.getElementById('authError');
  if (errDiv) errDiv.textContent = '';

  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  showToast('Logged out & memory cleared.');
}

async function checkSessionOnLoad() {
  const cachedPass = sessionStorage.getItem('ca_vault_session');
  if (cachedPass) {
    try {
      await unlockVaultWithPassword(cachedPass);
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('appView').style.display = 'block';
      populateDropdowns();
      computeAndRenderDashboard();
      applyFilters();
    } catch (e) {
      sessionStorage.removeItem('ca_vault_session');
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('appView').style.display = 'none';
    }
  } else {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
  }
}

// ================= DASHBOARD & FUNNEL METRICS =================

function computeAndRenderDashboard() {
  const leads = state.leads;
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
  let followUpsDueToday = 0;
  let overdueCount = 0;

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

    if (l.priority === 'HOT' || (l.lead_score && l.lead_score >= 4)) hotLeads++;

    const fDate = l.next_follow_up_date ? String(l.next_follow_up_date).slice(0, 10) : '';
    if (fDate && fDate === today && !['💰 Won / Paid', '🚫 Not Interested'].includes(s)) {
      followUpsDueToday++;
    }
    if (fDate && fDate < today && !['💰 Won / Paid', '🚫 Not Interested'].includes(s)) {
      overdueCount++;
    }

    const c = l.city || 'Other';
    cityMap[c] = (cityMap[c] || 0) + 1;

    const r = l.role || 'Other';
    roleMap[r] = (roleMap[r] || 0) + 1;

    const camp = l.campaign || 'Delhi NCR Founder Outreach';
    campaignMap[camp] = (campaignMap[camp] || 0) + 1;

    const src = l.source || 'Google Maps';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  });

  const funnel = {
    leads: total,
    contacted,
    replied,
    interested,
    demoSent,
    trial,
    won,
    rates: {
      contactedRate: total ? Math.round((contacted / total) * 100) + '%' : '0%',
      repliedRate: contacted ? Math.round((replied / contacted) * 100) + '%' : '0%',
      interestedRate: replied ? Math.round((interested / replied) * 100) + '%' : '0%',
      demoRate: interested ? Math.round((demoSent / interested) * 100) + '%' : '0%',
      trialRate: demoSent ? Math.round((trial / demoSent) * 100) + '%' : '0%',
      wonRate: trial ? Math.round((won / trial) * 100) + '%' : '0%'
    }
  };

  state.stats = {
    totalLeads: total,
    funnel,
    todayWork: {
      followupsToday: followUpsDueToday,
      overdue: overdueCount,
      hotLeads: hotLeads,
      notContacted: notContacted,
      replied: replied
    },
    countsByCity: cityMap,
    countsByRole: roleMap,
    countsByCampaign: campaignMap,
    countsBySource: sourceMap
  };

  // Update DOM elements
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Top action strip
  setEl('todayFollowUpsCount', followUpsDueToday);
  setEl('todayOverdueCount', overdueCount);
  setEl('todayHotCount', hotLeads);
  setEl('todayNewCount', notContacted);
  setEl('todayRepliedCount', replied);
  setEl('tabCountLeads', total);
  setEl('tabCountToday', followUpsDueToday + overdueCount);

  // Top metrics grid
  setEl('metric-total', total);
  setEl('metric-not-contacted', notContacted);
  setEl('metric-contacted', contacted);
  setEl('metric-replied', replied);
  setEl('metric-interested', interested);
  setEl('metric-demo', demoSent);
  setEl('metric-followup', followUp);
  setEl('metric-trial', trial);
  setEl('metric-won', won);
  setEl('metric-not-interested', notInterested);

  // Pipeline funnel
  setEl('funnel-leads', funnel.leads);
  setEl('funnel-contacted', funnel.contacted);
  setEl('funnel-replied', funnel.replied);
  setEl('funnel-interested', funnel.interested);
  setEl('funnel-demo', funnel.demoSent);
  setEl('funnel-trial', funnel.trial);
  setEl('funnel-paid', funnel.won);

  setEl('rate-contacted', funnel.rates.contactedRate);
  setEl('rate-replied', funnel.rates.repliedRate);
  setEl('rate-interested', funnel.rates.interestedRate);
  setEl('rate-demo', funnel.rates.demoRate);
  setEl('rate-trial', funnel.rates.trialRate);
  setEl('rate-paid', funnel.rates.wonRate);
}

function populateDropdowns() {
  const roleSelects = [
    document.getElementById('drawerInputRole'),
    document.getElementById('quickInputRole')
  ];

  roleSelects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    state.settings.roles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role;
      opt.textContent = role;
      sel.appendChild(opt);
    });
  });

  const statusSelect = document.getElementById('drawerInputStatus');
  if (statusSelect) {
    statusSelect.innerHTML = '';
    state.settings.statuses.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      statusSelect.appendChild(opt);
    });
  }

  renderSettingsLists();
}

function renderSettingsLists() {
  const rolesList = document.getElementById('settingsRolesList');
  if (rolesList) {
    rolesList.innerHTML = state.settings.roles.map(r => `
      <span class="badge-role">${escapeHtml(r)}</span>
    `).join('');
  }

  const citiesList = document.getElementById('settingsCitiesList');
  if (citiesList) {
    citiesList.innerHTML = state.settings.cities.map(c => `
      <span class="badge-city">${escapeHtml(c.name || c)} (P${c.phase || 1})</span>
    `).join('');
  }
}

// ================= NAVIGATION & TABS =================

function switchMainTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const dashPanel = document.getElementById('tabView-dashboard');
  const analyticsPanel = document.getElementById('tabView-analytics');
  const settingsPanel = document.getElementById('tabView-settings');
  const leadsWrapper = document.getElementById('leadsSectionWrapper');

  if (tabId === 'dashboard') {
    if (dashPanel) dashPanel.style.display = 'block';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    state.filters.quick = '';
    applyFilters();
  } else if (tabId === 'leads') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    state.filters.quick = '';
    applyFilters();
  } else if (tabId === 'today') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    quickFilter('followupsToday');
  } else if (tabId === 'top') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'block';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    quickFilter('top20');
  } else if (tabId === 'analytics') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'block';
    if (settingsPanel) settingsPanel.style.display = 'none';
    renderAnalytics();
  } else if (tabId === 'settings') {
    if (dashPanel) dashPanel.style.display = 'none';
    if (leadsWrapper) leadsWrapper.style.display = 'none';
    if (analyticsPanel) analyticsPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'block';
    renderSettingsLists();
  }
}

// ================= FILTERING & SEARCH =================

function handleSearchInput() {
  const input = document.getElementById('globalSearchInput');
  state.searchQuery = input ? input.value.trim().toLowerCase() : '';
  applyFilters();
}

function setFilter(category, val) {
  state.filters[category] = val;

  let rowId = '';
  if (category === 'city') rowId = 'regionFiltersRow';
  if (category === 'priority') rowId = 'priorityFiltersRow';
  if (category === 'role') rowId = 'roleFiltersRow';

  const row = document.getElementById(rowId);
  if (row) {
    row.querySelectorAll('.filter-pill').forEach(pill => {
      const onclickAttr = pill.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${val}'`)) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  applyFilters();
}

function filterByStatus(status) {
  state.filters.status = status;
  switchMainTab('leads');
  applyFilters();
}

function quickFilter(type) {
  state.filters.quick = type;
  const todayStr = new Date().toISOString().slice(0, 10);

  if (type === 'followupsToday') {
    state.filters.status = 'all';
    state.filteredLeads = state.leads.filter(l => {
      const fDate = l.next_follow_up_date ? String(l.next_follow_up_date).slice(0, 10) : '';
      return fDate === todayStr || (fDate && fDate < todayStr);
    });
  } else if (type === 'overdue') {
    state.filteredLeads = state.leads.filter(l => {
      const fDate = l.next_follow_up_date ? String(l.next_follow_up_date).slice(0, 10) : '';
      return fDate && fDate < todayStr && !['💰 Won / Paid', '❌ Lost', '🛑 Do Not Contact'].includes(l.outreach_status);
    });
  } else if (type === 'hotLeads') {
    state.filteredLeads = state.leads.filter(l => l.priority === 'HOT' || l.lead_score >= 4);
  } else if (type === 'notContacted') {
    state.filteredLeads = state.leads.filter(l => (l.outreach_status || '').includes('Not Contacted'));
  } else if (type === 'replied') {
    state.filteredLeads = state.leads.filter(l => (l.outreach_status || '').includes('Replied'));
  } else if (type === 'top20') {
    state.filteredLeads = [...state.leads]
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, 20);
  } else if (type === 'newOutreach') {
    state.filteredLeads = state.leads.filter(l => (l.outreach_status || '').includes('Not Contacted') && (l.lead_score >= 3 || l.priority === 'HOT'));
  }

  state.pagination.page = 1;
  renderLeadsList();
}

function applySavedView(preset) {
  clearAllFilters(false);
  const sel = document.getElementById('savedViewsSelect');
  if (sel) sel.value = preset;

  if (preset === 'hot_not_contacted') {
    setFilter('priority', 'HOT');
    state.filters.status = '⏳ Not Contacted';
  } else if (preset === 'delhi_sc') {
    setFilter('city', 'Delhi NCR');
    setFilter('role', 'Strength & Conditioning Coach');
  } else if (preset === 'ncr_online') {
    setFilter('city', 'Delhi NCR');
    setFilter('role', 'Online Coach');
  } else if (preset === 'followups_today') {
    quickFilter('followupsToday');
    return;
  } else if (preset === 'sports_nutritionists') {
    setFilter('role', 'Sports Nutritionist');
  } else if (preset === 'high_score') {
    state.filters.score = '4+';
  } else if (preset === 'demo_sent') {
    state.filters.status = '🎥 Demo Sent';
  } else if (preset === 'interested') {
    state.filters.status = '⭐ Interested';
  }

  applyFilters();
}

function clearAllFilters(reRender = true) {
  state.searchQuery = '';
  state.filters = {
    city: 'all',
    role: 'all',
    status: 'all',
    priority: 'all',
    score: 'all',
    source: 'all',
    quick: ''
  };

  const sInput = document.getElementById('globalSearchInput');
  if (sInput) sInput.value = '';

  const sView = document.getElementById('savedViewsSelect');
  if (sView) sView.value = '';

  document.querySelectorAll('.filter-pills-row').forEach(row => {
    row.querySelectorAll('.filter-pill').forEach((pill, idx) => {
      if (idx === 0) pill.classList.add('active');
      else pill.classList.remove('active');
    });
  });

  if (reRender) applyFilters();
}

function applyFilters() {
  if (state.filters.quick) {
    quickFilter(state.filters.quick);
    return;
  }

  let result = [...state.leads];

  if (state.searchQuery) {
    const q = state.searchQuery;
    result = result.filter(l => {
      return (l.person_name && l.person_name.toLowerCase().includes(q)) ||
        (l.business_name && l.business_name.toLowerCase().includes(q)) ||
        (l.mobile_number && l.mobile_number.includes(q)) ||
        (l.mobile && l.mobile.includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.role && l.role.toLowerCase().includes(q)) ||
        (l.instagram_handle && l.instagram_handle.toLowerCase().includes(q)) ||
        (l.website && l.website.toLowerCase().includes(q)) ||
        (l.call_notes && l.call_notes.toLowerCase().includes(q));
    });
  }

  if (state.filters.city !== 'all') {
    result = result.filter(l => (l.city || '').toLowerCase().includes(state.filters.city.toLowerCase()));
  }

  if (state.filters.priority !== 'all') {
    result = result.filter(l => l.priority === state.filters.priority);
  }

  if (state.filters.role !== 'all') {
    result = result.filter(l => (l.role || '').toLowerCase().includes(state.filters.role.toLowerCase()));
  }

  if (state.filters.status !== 'all') {
    result = result.filter(l => l.outreach_status === state.filters.status);
  }

  if (state.filters.score === '4+') {
    result = result.filter(l => (l.lead_score || 0) >= 4);
  }

  // Sorting
  result.sort((a, b) => {
    let va = a[state.sortField];
    let vb = b[state.sortField];

    if (state.sortField === 'lead_score') {
      va = va || 0;
      vb = vb || 0;
    } else {
      va = (va || '').toString().toLowerCase();
      vb = (vb || '').toString().toLowerCase();
    }

    if (va < vb) return state.sortAsc ? -1 : 1;
    if (va > vb) return state.sortAsc ? 1 : -1;
    return 0;
  });

  state.filteredLeads = result;
  state.pagination.page = 1;
  renderLeadsList();
}

function handleSort(field) {
  if (state.sortField === field) {
    state.sortAsc = !state.sortAsc;
  } else {
    state.sortField = field;
    state.sortAsc = field === 'person_name' || field === 'city';
  }
  applyFilters();
}

function changePage(delta) {
  const maxPages = Math.ceil(state.filteredLeads.length / state.pagination.pageSize) || 1;
  const newPage = state.pagination.page + delta;
  if (newPage >= 1 && newPage <= maxPages) {
    state.pagination.page = newPage;
    renderLeadsList();
  }
}

// ================= RENDERING (DESKTOP & MOBILE) =================

function renderLeadsList() {
  const total = state.filteredLeads.length;
  state.pagination.total = total;
  const startIdx = (state.pagination.page - 1) * state.pagination.pageSize;
  const endIdx = Math.min(startIdx + state.pagination.pageSize, total);
  const pageLeads = state.filteredLeads.slice(startIdx, endIdx);

  const pStart = document.getElementById('pageCountStart');
  const pEnd = document.getElementById('pageCountEnd');
  const pTotal = document.getElementById('pageCountTotal');
  if (pStart) pStart.textContent = total > 0 ? startIdx + 1 : 0;
  if (pEnd) pEnd.textContent = endIdx;
  if (pTotal) pTotal.textContent = total;

  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  if (prevBtn) prevBtn.disabled = state.pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = endIdx >= total;

  // Desktop table
  const tbody = document.getElementById('leadsTableBody');
  if (tbody) {
    if (pageLeads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="17" style="text-align: center; padding: 40px; color: var(--text-dim);">No leads match the current filters.</td></tr>`;
    } else {
      tbody.innerHTML = pageLeads.map(l => renderLeadTableRow(l)).join('');
    }
  }

  // Mobile touch cards
  const mobileContainer = document.getElementById('mobileCardsGrid');
  if (mobileContainer) {
    if (pageLeads.length === 0) {
      mobileContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-dim);">No leads match the current filters.</div>`;
    } else {
      mobileContainer.innerHTML = pageLeads.map(l => renderMobileCard(l)).join('');
    }
  }
}

function renderLeadTableRow(l) {
  const phone = l.mobile_number || l.mobile;
  const normPhone = normalizeDigits(phone);
  const waUrl = normPhone ? `https://wa.me/91${normPhone}` : '#';
  const callUrl = phone ? `tel:${phone}` : '#';
  const ig = l.instagram_handle || l.instagram;
  const igUrl = ig ? `https://instagram.com/${ig.replace('@', '')}` : '#';

  const priorityClass = `badge-priority-${(l.priority || 'LOW').toLowerCase()}`;
  const scoreBadge = getScoreBadge(l.lead_score);

  const statusOptions = state.settings.statuses.map(st => `
    <option value="${escapeHtml(st)}" ${l.outreach_status === st ? 'selected' : ''}>${escapeHtml(st)}</option>
  `).join('');

  const nextDateFormatted = l.next_follow_up_date ? String(l.next_follow_up_date).slice(0, 10) : '—';
  const lastContactFormatted = l.last_contact_date ? String(l.last_contact_date).slice(0, 10) : '—';

  return `
    <tr id="lead-row-${l.id}">
      <td><span class="badge-priority ${priorityClass}">${escapeHtml(l.priority || 'LOW')}</span></td>
      <td>${scoreBadge}</td>
      <td>
        <div style="font-weight: 700; color: #fff; cursor: pointer;" onclick="openLeadDrawer('${l.id}')">
          ${escapeHtml(l.person_name || 'Unknown')}
        </div>
      </td>
      <td>
        <span style="color: var(--text-secondary); font-size: 11px;">
          ${escapeHtml(l.business_name || '—')}
        </span>
      </td>
      <td><span class="badge-role">${escapeHtml(l.role || 'Fitness Coach')}</span></td>
      <td><span class="badge-city">${escapeHtml(l.city || 'Delhi NCR')}</span></td>
      <td style="color: var(--text-dim); font-size: 11px;">${escapeHtml(l.state || 'Delhi')}</td>
      <td>
        <span class="phone-link" onclick="copyPhone('${escapeHtml(phone || '')}')" title="Click to copy">
          ${formatPhoneDisplay(phone)}
        </span>
      </td>
      <td>
        ${normPhone ? `
          <a href="${waUrl}" target="_blank" class="btn-tbl-action btn-tbl-wa" onclick="trackLeadAction('${l.id}', 'WhatsApp Click')">
            💬 WA
          </a>
        ` : '—'}
      </td>
      <td>
        ${ig ? `
          <a href="${igUrl}" target="_blank" class="btn-tbl-action btn-tbl-ig">
            📷 ${escapeHtml(ig)}
          </a>
        ` : '—'}
      </td>
      <td>
        ${l.website ? `
          <a href="${escapeHtml(l.website)}" target="_blank" style="color: #60a5fa; font-size: 11px; text-decoration: none;">
            🌐 Web
          </a>
        ` : '—'}
      </td>
      <td style="font-size: 11px; color: var(--text-dim);">${escapeHtml(l.current_system || '—')}</td>
      <td style="font-size: 11px; color: var(--text-dim);">${escapeHtml(l.client_count || '—')}</td>
      <td>
        <select class="tbl-status-select" onchange="handleStatusChange('${l.id}', this.value)">
          ${statusOptions}
        </select>
      </td>
      <td style="font-size: 11px; color: var(--text-dim);">${lastContactFormatted}</td>
      <td style="font-size: 11px; color: ${isDateOverdue(nextDateFormatted) ? '#ef4444; font-weight: 700;' : 'var(--text-dim)'};">${nextDateFormatted}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-tbl-action" onclick="openSmartPitchModal('${l.id}')" title="Smart Pitch">💬</button>
        <button class="btn-tbl-action" onclick="openLeadDrawer('${l.id}')" title="View Full Details">👁️</button>
      </td>
    </tr>
  `;
}

function renderMobileCard(l) {
  const phone = l.mobile_number || l.mobile;
  const normPhone = normalizeDigits(phone);
  const waUrl = normPhone ? `https://wa.me/91${normPhone}` : '#';
  const callUrl = phone ? `tel:${phone}` : '#';
  const ig = l.instagram_handle || l.instagram;
  const igUrl = ig ? `https://instagram.com/${ig.replace('@', '')}` : '#';

  const priorityClass = `badge-priority-${(l.priority || 'LOW').toLowerCase()}`;
  const scoreBadge = getScoreBadge(l.lead_score);

  const statusOptions = state.settings.statuses.map(st => `
    <option value="${escapeHtml(st)}" ${l.outreach_status === st ? 'selected' : ''}>${escapeHtml(st)}</option>
  `).join('');

  return `
    <div class="mobile-lead-card" id="mobile-card-${l.id}">
      <div class="card-top-row">
        <div>
          <div class="card-person-name" onclick="openLeadDrawer('${l.id}')">${escapeHtml(l.person_name || 'Unknown')}</div>
          <div class="card-biz-name">${escapeHtml(l.business_name || 'Independent Coach')}</div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${scoreBadge}
          <span class="badge-priority ${priorityClass}">${escapeHtml(l.priority || 'LOW')}</span>
        </div>
      </div>

      <div class="card-info-grid">
        <div><span class="card-field-label">Role:</span> ${escapeHtml(l.role || 'Coach')}</div>
        <div><span class="card-field-label">City:</span> ${escapeHtml(l.city || 'Delhi NCR')}</div>
        <div><span class="card-field-label">System:</span> ${escapeHtml(l.current_system || '—')}</div>
        <div><span class="card-field-label">Clients:</span> ${escapeHtml(l.client_count || '—')}</div>
      </div>

      <div class="card-actions-row">
        <a href="${callUrl}" class="btn-card-action">📞 Call</a>
        <a href="${waUrl}" target="_blank" class="btn-card-action btn-card-wa" onclick="trackLeadAction('${l.id}', 'Mobile WA')">💬 WhatsApp</a>
        ${ig ? `<a href="${igUrl}" target="_blank" class="btn-card-action">📷 IG</a>` : ''}
        <button class="btn-card-action btn-card-view" onclick="openLeadDrawer('${l.id}')">👁️ View</button>
      </div>

      <div style="margin-top: 10px;">
        <select class="tbl-status-select" style="width: 100%;" onchange="handleStatusChange('${l.id}', this.value)">
          ${statusOptions}
        </select>
      </div>
    </div>
  `;
}

function getScoreBadge(score) {
  const s = parseInt(score, 10) || 0;
  if (s >= 5) return `<span class="score-pill score-5">⭐ 5/5</span>`;
  if (s === 4) return `<span class="score-pill score-4">⭐ 4/5</span>`;
  if (s === 3) return `<span class="score-pill score-3">⭐ 3/5</span>`;
  return `<span class="score-pill score-low">${s}/5</span>`;
}

function isDateOverdue(dateStr) {
  if (!dateStr || dateStr === '—') return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

// ================= LEAD DETAIL DRAWER =================

function openLeadDrawer(leadId) {
  const lead = state.leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;
  state.currentLead = lead;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : '';
  };

  setText('drawerPersonName', lead.person_name || 'Coach Details');
  setText('drawerBizRole', `${lead.role || 'Fitness Coach'} • ${lead.city || 'Delhi NCR'} ${lead.business_name ? '(' + lead.business_name + ')' : ''}`);

  const phone = lead.mobile_number || lead.mobile;
  const normPhone = normalizeDigits(phone);
  const waBtn = document.getElementById('drawerWaBtn');
  const callBtn = document.getElementById('drawerCallBtn');
  if (waBtn) waBtn.href = normPhone ? `https://wa.me/91${normPhone}` : '#';
  if (callBtn) callBtn.href = phone ? `tel:${phone}` : '#';

  setVal('drawerInputName', lead.person_name);
  setVal('drawerInputBiz', lead.business_name);
  setVal('drawerInputRole', lead.role);
  setVal('drawerInputCity', lead.city);
  setVal('drawerInputMobile', phone);
  setVal('drawerInputEmail', lead.email);

  setVal('drawerInputIg', lead.instagram_handle || lead.instagram);
  setVal('drawerInputWeb', lead.website);
  setVal('drawerInputMaps', lead.maps_url);

  setVal('drawerInputOnline', lead.online_coaching === true ? 'true' : 'false');
  setVal('drawerInputClients', lead.client_count || 'Unknown');
  setVal('drawerInputSystem', lead.current_system || 'WhatsApp');

  setVal('drawerInputScore', lead.lead_score !== undefined ? String(lead.lead_score) : '3');
  setVal('drawerInputPriority', lead.priority || 'MEDIUM');
  setVal('drawerInputWhyGood', lead.why_good || '');
  setVal('drawerInputQualNotes', lead.qualification_notes || '');

  setVal('drawerInputStatus', lead.outreach_status || '⏳ Not Contacted');
  setVal('drawerInputNextFollowUp', lead.next_follow_up_date ? String(lead.next_follow_up_date).slice(0, 10) : '');
  setVal('drawerInputCallOutcome', lead.call_outcome || '');
  setText('drawerLastContactDisplay', lead.last_contact_date ? String(lead.last_contact_date).slice(0, 10) : 'Never');
  setVal('drawerInputCallNotes', lead.call_notes || '');

  renderDrawerTimeline(lead.timeline || []);

  const drawer = document.getElementById('leadDetailDrawer');
  if (drawer) drawer.classList.add('open');
}

function closeLeadDrawer() {
  const drawer = document.getElementById('leadDetailDrawer');
  if (drawer) drawer.classList.remove('open');
  state.currentLead = null;
}

function closeDrawerOnOverlay(e) {
  if (e.target.id === 'leadDetailDrawer') {
    closeLeadDrawer();
  }
}

function renderDrawerTimeline(events) {
  const list = document.getElementById('drawerTimelineList');
  if (!list) return;

  if (!events || events.length === 0) {
    list.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); padding: 8px 0;">No activities logged yet.</div>`;
    return;
  }

  list.innerHTML = events.slice().reverse().map(ev => `
    <div class="timeline-item">
      <div class="timeline-date">${escapeHtml(ev.timestamp || ev.date ? String(ev.timestamp || ev.date).slice(0, 16).replace('T', ' ') : '')}</div>
      <div class="timeline-content">
        <strong>${escapeHtml(ev.action || 'Activity')}</strong>
        ${ev.notes ? ` — ${escapeHtml(ev.notes)}` : ''}
      </div>
    </div>
  `).join('');
}

function handleAddTimelineEvent() {
  if (!state.currentLead) return;
  const input = document.getElementById('drawerNewTimelineAction');
  const actionText = input ? input.value.trim() : '';
  if (!actionText) return;

  const newEvent = {
    action: actionText,
    timestamp: new Date().toISOString()
  };

  const updatedTimeline = [...(state.currentLead.timeline || []), newEvent];
  state.currentLead.timeline = updatedTimeline;
  state.currentLead.last_contact_date = new Date().toISOString();

  renderDrawerTimeline(state.currentLead.timeline);
  input.value = '';
  showToast('Activity logged');
  saveVaultLocally();
}

function saveLeadFromDrawer() {
  if (!state.currentLead) return;

  const getVal = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const phone = getVal('drawerInputMobile');
  state.currentLead.person_name = getVal('drawerInputName');
  state.currentLead.business_name = getVal('drawerInputBiz');
  state.currentLead.role = getVal('drawerInputRole');
  state.currentLead.city = getVal('drawerInputCity');
  state.currentLead.mobile = phone;
  state.currentLead.mobile_number = phone;
  state.currentLead.email = getVal('drawerInputEmail');
  state.currentLead.instagram = getVal('drawerInputIg');
  state.currentLead.instagram_handle = getVal('drawerInputIg');
  state.currentLead.website = getVal('drawerInputWeb');
  state.currentLead.maps_url = getVal('drawerInputMaps');
  state.currentLead.online_coaching = getVal('drawerInputOnline') === 'true';
  state.currentLead.client_count = getVal('drawerInputClients');
  state.currentLead.current_system = getVal('drawerInputSystem');
  state.currentLead.lead_score = parseInt(getVal('drawerInputScore'), 10) || 0;
  state.currentLead.priority = getVal('drawerInputPriority');
  state.currentLead.why_good = getVal('drawerInputWhyGood');
  state.currentLead.qualification_notes = getVal('drawerInputQualNotes');
  state.currentLead.outreach_status = getVal('drawerInputStatus');
  state.currentLead.next_follow_up_date = getVal('drawerInputNextFollowUp') || null;
  state.currentLead.call_outcome = getVal('drawerInputCallOutcome');
  state.currentLead.call_notes = getVal('drawerInputCallNotes');
  state.currentLead.updated_at = new Date().toISOString();

  closeLeadDrawer();
  saveVaultLocally();
  showToast('✅ Lead details updated');
  computeAndRenderDashboard();
  applyFilters();
}

function handleDeleteDrawerLead() {
  if (!state.currentLead) return;
  const ok = confirm(`Are you sure you want to permanently delete lead "${state.currentLead.person_name}"?`);
  if (!ok) return;

  state.leads = state.leads.filter(l => String(l.id) !== String(state.currentLead.id));
  closeLeadDrawer();
  saveVaultLocally();
  showToast('Lead deleted');
  computeAndRenderDashboard();
  applyFilters();
}

// ================= INLINE STATUS & ACTIONS =================

function handleStatusChange(leadId, newStatus) {
  const lead = state.leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;

  lead.outreach_status = newStatus;
  lead.last_contact_date = new Date().toISOString();
  lead.timeline = [...(lead.timeline || []), {
    action: `Status changed to "${newStatus}"`,
    timestamp: new Date().toISOString()
  }];

  saveVaultLocally();
  showToast(`Status updated: ${newStatus}`);
  computeAndRenderDashboard();
  applyFilters();
}

function trackLeadAction(leadId, actionName) {
  const lead = state.leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;

  lead.last_contact_date = new Date().toISOString();
  lead.timeline = [...(lead.timeline || []), {
    action: actionName,
    timestamp: new Date().toISOString()
  }];

  if (lead.outreach_status === '⏳ Not Contacted') {
    lead.outreach_status = '📤 Sent';
  }

  saveVaultLocally();
  computeAndRenderDashboard();
}

// ================= QUICK ADD MODAL & DUPLICATE CHECK =================

function openQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  const alertBox = document.getElementById('quickAddDupAlert');
  if (alertBox) alertBox.style.display = 'none';
  if (modal) modal.style.display = 'flex';

  const mobileInput = document.getElementById('quickInputMobile');
  if (mobileInput && !mobileInput.dataset.listenerBound) {
    mobileInput.dataset.listenerBound = 'true';
    mobileInput.addEventListener('input', checkQuickAddDuplicate);
  }

  const igInput = document.getElementById('quickInputIg');
  if (igInput && !igInput.dataset.listenerBound) {
    igInput.dataset.listenerBound = 'true';
    igInput.addEventListener('input', checkQuickAddDuplicate);
  }
}

function closeQuickAddModal() {
  const modal = document.getElementById('quickAddModal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('quickAddForm');
  if (form) form.reset();
}

function checkQuickAddDuplicate() {
  const phone = normalizeDigits(document.getElementById('quickInputMobile')?.value || '');
  const ig = (document.getElementById('quickInputIg')?.value || '').toLowerCase().replace(/[@\s]/g, '');
  const alertBox = document.getElementById('quickAddDupAlert');

  if (!phone && !ig) {
    if (alertBox) alertBox.style.display = 'none';
    return;
  }

  const dup = state.leads.find(l => {
    const lPhone = normalizeDigits(l.mobile_number || l.mobile);
    const lIg = (l.instagram_handle || l.instagram || '').toLowerCase().replace(/[@\s]/g, '');
    return (phone && lPhone && lPhone === phone) || (ig && lIg && lIg === ig);
  });

  if (dup) {
    if (alertBox) {
      alertBox.innerHTML = `⚠️ <strong>Duplicate Warning:</strong> "${escapeHtml(dup.person_name)}" (${escapeHtml(dup.city)}) already exists in CRM (${escapeHtml(dup.outreach_status)}).`;
      alertBox.style.display = 'block';
    }
  } else {
    if (alertBox) alertBox.style.display = 'none';
  }
}

function handleQuickAddSubmit(e) {
  if (e) e.preventDefault();
  const getVal = id => document.getElementById(id)?.value.trim() || '';

  const phone = getVal('quickInputMobile');
  const normPhone = normalizeDigits(phone);
  const ig = getVal('quickInputIg');

  // Compute lead score
  let score = 3;
  if (document.getElementById('checkAthlete')?.checked) score += 1;
  if (document.getElementById('checkOnline')?.checked) score += 1;
  score = Math.min(5, score);

  const newLead = {
    id: Date.now(),
    person_name: getVal('quickInputName'),
    business_name: getVal('quickInputBiz') || getVal('quickInputName'),
    role: getVal('quickInputRole'),
    city: getVal('quickInputCity') || 'Delhi NCR',
    state: getVal('quickInputState') || 'Delhi',
    mobile: phone,
    mobile_number: phone,
    phone_normalized: normPhone,
    whatsapp_link: `https://wa.me/91${normPhone}`,
    instagram: ig,
    instagram_handle: ig,
    website: getVal('quickInputWeb'),
    maps_url: getVal('quickInputMaps'),
    online_coaching: document.getElementById('checkOnline')?.checked || false,
    athlete_types: document.getElementById('checkAthlete')?.checked ? ['Athletes / Sports'] : ['General Fitness'],
    current_system: document.getElementById('checkCustom')?.checked ? 'Custom Program' : 'WhatsApp',
    client_count: document.getElementById('checkMultiple')?.checked ? '4-10' : '1-3',
    lead_score: score,
    priority: score >= 4 ? 'HOT' : 'HIGH',
    outreach_status: '⏳ Not Contacted',
    source: 'Google Maps',
    campaign: 'Delhi NCR Founder Outreach',
    timeline: [
      {
        action: 'Lead Captured (Google Maps)',
        timestamp: new Date().toISOString()
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.leads.unshift(newLead);
  saveVaultLocally();
  closeQuickAddModal();
  showToast(`⚡ Added "${newLead.person_name}" to CRM!`);
  computeAndRenderDashboard();
  applyFilters();
}

// ================= SMART OUTREACH PITCH GENERATOR =================

const pitchTemplates = {
  sc: {
    name: 'Strength & Conditioning Coach',
    text: `Hi {{name}}, loved seeing your work with athletes in {{city}}!

I’m building COREATHLETE specifically for high-performance S&C coaches who program custom strength, power, and conditioning blocks.

Unlike generic fitness apps made for casual gym-goers, COREATHLETE gives you:
- Athlete readiness & load monitoring
- 1-click workout programming built for strength progressions
- Clean athlete compliance tracking without messy spreadsheets

Would love to send over a quick 90-second video walkthrough if you’re open to exploring it?`
  },
  online: {
    name: 'Online Fitness Coach',
    text: `Hey {{name}}, came across your coaching page on Instagram!

Quick question: are you currently managing your online clients through Google Sheets and WhatsApp, or using an app like Trainerize?

We built COREATHLETE to help online coaches deliver higher-touch athlete programming in 70% less time — with direct video form checks, automated progression logs, and zero app bloat.

Are you taking on new clients right now? Happy to share a 2-min preview.`
  },
  strength: {
    name: 'Strength / Powerlifting Coach',
    text: `Hi {{name}}, noticed your focus on heavy strength training and powerlifting athletes in {{city}}.

Most strength coaches tell us they hate generic fitness apps because they can’t handle RPE-based periodization, percentage-based loading, or barbell progression curves properly.

We designed COREATHLETE specifically to solve this for serious strength practitioners.

Would you be open to checking out a quick demo?`
  },
  combat: {
    name: 'Combat Sports Coach (MMA/Boxing)',
    text: `Hey {{name}}, huge respect for your combat athletes' conditioning work in {{city}}!

We’ve been collaborating with combat sports & MMA coaches to build a dedicated athlete management tool that tracks fight camp volume, conditioning intervals, and athlete recovery without the clutter of bodybuilding apps.

Would love to get your thoughts on a 2-minute video walkthrough if you have a moment!`
  },
  endurance: {
    name: 'Endurance / Running Coach',
    text: `Hi {{name}}, saw your endurance & running coaching programs in {{city}}!

Managing athlete weekly mileage, cadence zones, and supplementary strength work in one place is usually a nightmare across Excel and Strava.

COREATHLETE combines strength programming with endurance metric tracking so your runners peak safely.

Let me know if you’d like to see how other coaches are using it!`
  },
  nutritionist: {
    name: 'Sports Dietitian / Nutritionist',
    text: `Hi {{name}}, came across your sports nutrition & performance dietetics work in {{city}}!

We’re onboarding sports dietitians onto COREATHLETE to help them coordinate directly with their athletes' training loads and macro adherence in real time.

Would love to share a quick preview of how it streamlines athlete check-ins!`
  }
};

function openSmartPitchModal(leadId) {
  const lead = leadId ? state.leads.find(l => String(l.id) === String(leadId)) : state.currentLead;
  state.currentPitchLead = lead || null;

  const select = document.getElementById('pitchTemplateSelect');
  if (lead && select) {
    const roleLower = (lead.role || '').toLowerCase();
    if (roleLower.includes('s&c') || roleLower.includes('strength & conditioning') || roleLower.includes('performance')) {
      select.value = 'sc';
    } else if (roleLower.includes('online')) {
      select.value = 'online';
    } else if (roleLower.includes('combat') || roleLower.includes('mma') || roleLower.includes('boxing')) {
      select.value = 'combat';
    } else if (roleLower.includes('running') || roleLower.includes('endurance')) {
      select.value = 'endurance';
    } else if (roleLower.includes('nutrition') || roleLower.includes('diet')) {
      select.value = 'nutritionist';
    } else {
      select.value = 'sc';
    }
  }

  generatePitchText();
  const modal = document.getElementById('smartPitchModal');
  if (modal) modal.style.display = 'flex';
}

function closeSmartPitchModal() {
  const modal = document.getElementById('smartPitchModal');
  if (modal) modal.style.display = 'none';
}

function generatePitchText() {
  const templateKey = document.getElementById('pitchTemplateSelect')?.value || 'sc';
  const tpl = pitchTemplates[templateKey] || pitchTemplates.sc;
  const lead = state.currentPitchLead || {};

  const firstName = lead.person_name ? lead.person_name.split(' ')[0] : 'Coach';
  const city = lead.city || 'Delhi NCR';
  const business = lead.business_name || 'your coaching brand';

  let text = tpl.text
    .replace(/\{\{name\}\}/g, firstName)
    .replace(/\{\{city\}\}/g, city)
    .replace(/\{\{business\}\}/g, business);

  const txtArea = document.getElementById('smartPitchText');
  if (txtArea) txtArea.value = text;
}

function copyPitchFromModal() {
  const txtArea = document.getElementById('smartPitchText');
  if (!txtArea) return;
  navigator.clipboard.writeText(txtArea.value).then(() => {
    showToast('📋 Pitch copied to clipboard!');
    if (state.currentPitchLead) {
      trackLeadAction(state.currentPitchLead.id, 'Copied Smart Pitch');
    }
  }).catch(() => {
    txtArea.select();
    document.execCommand('copy');
    showToast('📋 Pitch copied!');
  });
}

// ================= LOCAL VAULT ENCRYPTION & SAVE =================

async function saveVaultLocally() {
  if (!state.isUnlocked || !state.activePassword) return;

  try {
    const enc = new TextEncoder();
    const passKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(state.activePassword),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const plaintext = JSON.stringify(state.leads);
    const encryptedBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      enc.encode(plaintext)
    );

    // In Web Crypto API AES-GCM, the last 16 bytes are the auth tag
    const totalBytes = new Uint8Array(encryptedBuf);
    const cipherBytes = totalBytes.slice(0, totalBytes.length - 16);
    const tagBytes = totalBytes.slice(totalBytes.length - 16);

    const bufToHex = b => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    const bufToBase64 = b => window.btoa(String.fromCharCode(...b));

    const newVault = {
      version: 1,
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2',
      iterations: 100000,
      hash: 'SHA-256',
      salt: bufToHex(salt),
      iv: bufToHex(iv),
      tag: bufToHex(tagBytes),
      ciphertext: bufToBase64(cipherBytes)
    };

    localStorage.setItem('ca_encrypted_vault', JSON.stringify(newVault));
  } catch (e) {
    console.error('Failed to save vault locally:', e);
  }
}

// ================= EXPORT & IMPORT =================

function openExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) modal.style.display = 'flex';
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) modal.style.display = 'none';
}

function triggerExport(type) {
  let exportData = [];

  if (type === 'all') {
    exportData = state.leads;
  } else if (type === 'filtered') {
    exportData = state.filteredLeads;
  } else if (type === 'hot') {
    exportData = state.leads.filter(l => l.priority === 'HOT' || l.lead_score >= 4);
  } else if (type === 'followups') {
    const today = new Date().toISOString().slice(0, 10);
    exportData = state.leads.filter(l => l.next_follow_up_date && String(l.next_follow_up_date).slice(0, 10) <= today);
  } else if (type === 'interested') {
    exportData = state.leads.filter(l => l.outreach_status === '⭐ Interested');
  }

  if (exportData.length === 0) {
    alert('No leads found for selected export criteria.');
    return;
  }

  downloadCsv(exportData, `coreathlete_leads_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
  closeExportModal();
  showToast(`Exported ${exportData.length} leads to CSV`);
}

function downloadCsv(leads, filename) {
  const headers = [
    'Person Name', 'Business', 'Role', 'City', 'State', 'Mobile',
    'WhatsApp', 'Instagram', 'Website', 'Lead Score', 'Priority',
    'Outreach Status', 'Current System', 'Client Count', 'Next Follow Up',
    'Last Contact', 'Call Notes'
  ];

  const escapeCsv = val => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map(l => [
    escapeCsv(l.person_name),
    escapeCsv(l.business_name),
    escapeCsv(l.role),
    escapeCsv(l.city),
    escapeCsv(l.state),
    escapeCsv(l.mobile_number || l.mobile),
    escapeCsv(l.whatsapp_number || l.mobile_number || l.mobile),
    escapeCsv(l.instagram_handle || l.instagram),
    escapeCsv(l.website),
    escapeCsv(l.lead_score),
    escapeCsv(l.priority),
    escapeCsv(l.outreach_status),
    escapeCsv(l.current_system),
    escapeCsv(l.client_count),
    escapeCsv(l.next_follow_up_date),
    escapeCsv(l.last_contact_date),
    escapeCsv(l.call_notes)
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  const summary = document.getElementById('importPreviewSummary');
  if (summary) summary.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.style.display = 'none';
}

function parsePastedCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const matches = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const obj = {};
    headers.forEach((h, idx) => {
      let val = matches[idx] ? matches[idx].trim().replace(/^["']|["']$/g, '') : '';
      if (h.includes('name')) obj.person_name = val;
      else if (h.includes('biz') || h.includes('business') || h.includes('gym')) obj.business_name = val;
      else if (h.includes('role')) obj.role = val;
      else if (h.includes('city')) obj.city = val;
      else if (h.includes('mobile') || h.includes('phone')) obj.mobile_number = val;
      else if (h.includes('insta')) obj.instagram_handle = val;
      else if (h.includes('web')) obj.website = val;
    });
    if (obj.person_name && (obj.mobile_number || obj.instagram_handle)) {
      rows.push(obj);
    }
  }
  return rows;
}

function handleImportPreview() {
  const text = document.getElementById('importCsvText')?.value || '';
  const rows = parsePastedCsv(text);
  const summary = document.getElementById('importPreviewSummary');
  if (!summary) return;

  if (rows.length === 0) {
    summary.innerHTML = '<span style="color: #ef4444;">No valid lead rows detected in pasted CSV.</span>';
    summary.style.display = 'block';
    return;
  }

  let dupCount = 0;
  let validCount = 0;

  rows.forEach(r => {
    const phone = normalizeDigits(r.mobile_number);
    const ig = (r.instagram_handle || '').toLowerCase().replace(/[@\s]/g, '');
    const isDup = state.leads.some(l => {
      const lPhone = normalizeDigits(l.mobile_number || l.mobile);
      const lIg = (l.instagram_handle || l.instagram || '').toLowerCase().replace(/[@\s]/g, '');
      return (phone && lPhone && lPhone === phone) || (ig && lIg && lIg === ig);
    });

    if (isDup) dupCount++;
    else validCount++;
  });

  summary.innerHTML = `
    <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">CSV Parse Result:</div>
    <div>Total rows found: <strong>${rows.length}</strong></div>
    <div>Valid new leads: <strong style="color: var(--lime);">${validCount}</strong></div>
    <div>Duplicates detected: <strong style="color: #f59e0b;">${dupCount}</strong></div>
  `;
  summary.style.display = 'block';
}

function handleImportCommit() {
  const text = document.getElementById('importCsvText')?.value || '';
  const rows = parsePastedCsv(text);
  if (rows.length === 0) {
    alert('Please enter valid CSV data first.');
    return;
  }

  let importedCount = 0;
  rows.forEach(r => {
    const phone = normalizeDigits(r.mobile_number);
    const ig = (r.instagram_handle || '').toLowerCase().replace(/[@\s]/g, '');
    const isDup = state.leads.some(l => {
      const lPhone = normalizeDigits(l.mobile_number || l.mobile);
      const lIg = (l.instagram_handle || l.instagram || '').toLowerCase().replace(/[@\s]/g, '');
      return (phone && lPhone && lPhone === phone) || (ig && lIg && lIg === ig);
    });

    if (!isDup) {
      state.leads.unshift({
        id: Date.now() + Math.random(),
        person_name: r.person_name,
        business_name: r.business_name || r.person_name,
        role: r.role || 'Fitness Coach',
        city: r.city || 'Delhi NCR',
        mobile: r.mobile_number,
        mobile_number: r.mobile_number,
        phone_normalized: phone,
        instagram: r.instagram_handle,
        instagram_handle: r.instagram_handle,
        website: r.website || '',
        lead_score: 3,
        priority: 'MEDIUM',
        outreach_status: '⏳ Not Contacted',
        created_at: new Date().toISOString(),
        timeline: [{ action: 'Imported via CSV', timestamp: new Date().toISOString() }]
      });
      importedCount++;
    }
  });

  closeImportModal();
  saveVaultLocally();
  showToast(`✅ Successfully imported ${importedCount} new leads!`);
  computeAndRenderDashboard();
  applyFilters();
}

// ================= ANALYTICS =================

function renderAnalytics() {
  if (!state.stats) return;

  const renderBreakdown = (containerId, dataObj) => {
    const el = document.getElementById(containerId);
    if (!el || !dataObj) return;

    const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      el.innerHTML = '<div style="color: var(--text-dim); font-size: 11px;">No data recorded yet.</div>';
      return;
    }

    el.innerHTML = entries.map(([key, count]) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px;">
        <span style="color: var(--text-primary);">${escapeHtml(key)}</span>
        <span style="font-weight: 700; color: var(--lime);">${count}</span>
      </div>
    `).join('');
  };

  renderBreakdown('analyticsCityBreakdown', state.stats.countsByCity);
  renderBreakdown('analyticsRoleBreakdown', state.stats.countsByRole);
  renderBreakdown('analyticsCampaignBreakdown', state.stats.countsByCampaign);
  renderBreakdown('analyticsSourceBreakdown', state.stats.countsBySource);
}

// ================= MODAL & COPY HELPERS =================

function closeModalOnOverlay(e, modalId) {
  if (e.target.id === modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  }
}

function copyPhone(phone) {
  if (!phone) return;
  navigator.clipboard.writeText(phone).then(() => {
    showToast(`📋 Copied: ${phone}`);
  }).catch(() => {
    showToast(`Phone: ${phone}`);
  });
}

function copyDrawerPhone() {
  if (!state.currentLead) return;
  copyPhone(state.currentLead.mobile_number || state.currentLead.mobile);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  checkSessionOnLoad();
});
