// 1. Cloudinary
const CLOUDINARY_CLOUD_NAME = 'v9r5fxec';
const CLOUDINARY_UPLOAD_PRESET = 'vafeed';
const CLOUDINARY_FOLDER = 'vafeed';

// 2. Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxv2-4JR4wrjgWeaBrsNPw7vmxpI82ZHNiTHm5C_sgMFxvddlK-Ays_PxI25M4xhLHp4A/exec';

// 3. Shared secret — MUST MATCH the one in Apps Script
const SHARED_SECRET = 'vafeed-echo-2026';

// 4. Discord Webhooks
const DISCORD_WEBHOOK_URL       = 'https://discord.com/api/webhooks/1558088040214438000/zLdNCps3ebwL_LyfFABymO_pV03A7fzHTJPQHGYVqeHdGTq74F4I-kFLji9md70p0szz';
const DISCORD_WEBHOOK_ADMIN_URL = 'https://discord.com/api/webhooks/1558071870463676506/YDoo4Dbs44PFsgeZ8lq-YverKepVaNBCcdfW0KpD08cyb-bk3CC5ldGD0WgvCoIwzIXC';

// 5. Public links
const VAFeed_UPLOAD_URL = 'https://vafeed-news.vercel.app/upload/upload.html';

// 6. Discord OAuth
const DISCORD_CLIENT_ID    = '1558014458238865509';
const DISCORD_REDIRECT_URI = window.location.origin + window.location.pathname;

// 7. Forbidden airline names (only admins can use these)
const FORBIDDEN_AIRLINE_NAMES = [
  'vafeed',
  'vafeed official',
  'va feed',
  'admin',
  'administrator',
  'moderator',
  'staff',
  'official'
];

// 8. Discord IDs allowed to post as "VAFeed Official"
const OFFICIAL_DISCORD_IDS = [
  '1239406991282278410',
  '891673140554502175'
];

// 9. Categories
const BASE_CATEGORIES = [
  'New Routes',
  'Fleet',
  'Events',
  'Announcement',
  'Incident Report',
  'Partnership',
  'Other'
];

const ADMIN_CATEGORIES = [
  'Alliance Announcements'
];

// 10. Webhook display names
const WEBHOOK_NAME_REGULAR = 'VAFeed';
const WEBHOOK_NAME_ADMIN   = 'Echo United Alliances';

/**
 * Normalize an airline name for comparison.
 */
function normalizeAirlineName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Return true if the name matches (or contains) any forbidden entry.
 */
function isForbiddenAirline(name) {
  const normalized = normalizeAirlineName(name);
  if (!normalized) return false;
  return FORBIDDEN_AIRLINE_NAMES.some(forbidden =>
    normalized === forbidden || normalized.includes(forbidden)
  );
}

/**
 * Return true if the given Discord user is in OFFICIAL_DISCORD_IDS.
 */
function isAdmin(user) {
  if (!user) return false;
  return OFFICIAL_DISCORD_IDS.map(String).includes(String(user.id));
}

/* ---------------------------------------------------------
   ELEMENTS
--------------------------------------------------------- */
const form       = document.getElementById('submit-form');
const submitBtn  = document.getElementById('submit-btn');
const messageEl  = document.getElementById('form-message');
const yearEl     = document.getElementById('year');
const summaryEl  = document.getElementById('summary');
const countEl    = document.getElementById('summary-count');

// Login gate
const loginGate    = document.getElementById('login-gate');
const loginBtn     = document.getElementById('discord-login-btn');
const discordError = document.getElementById('discord-error');

// Account menu (top-right header)
const accountMenu      = document.getElementById('account-menu');
const accountBtn       = document.getElementById('account-btn');
const accountAvatar    = document.getElementById('account-avatar');
const accountDropdown  = document.getElementById('account-dropdown');
const dropdownAvatar   = document.getElementById('dropdown-avatar');
const dropdownName     = document.getElementById('dropdown-name');
const dropdownUsername = document.getElementById('dropdown-username');
const dropdownBadge    = document.getElementById('dropdown-badge');
const accountSignout   = document.getElementById('account-signout');

// Form wrapper (for lock/unlock)
const submitWrap = document.getElementById('submit-wrap');

// Admin section (contains official toggle + admin category)
const adminSection = document.getElementById('admin-section');

// Official toggle
const isOfficialEl = document.getElementById('isOfficial');
const officialHint = document.getElementById('official-hint');
const airlineEl    = document.getElementById('airline');

// Upload elements
const fileInput         = document.getElementById('imageFile');
const uploadZone        = document.getElementById('upload-zone');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreview     = document.getElementById('upload-preview');
const previewImg        = document.getElementById('preview-img');
const removeBtn         = document.getElementById('upload-remove');

// Category custom dropdown (public)
const categoryInput   = document.getElementById('category');
const categoryTrigger = document.getElementById('category-trigger');
const categoryValue   = document.getElementById('category-value');
const categoryMenu    = document.getElementById('category-menu');
const categoryWrap    = document.getElementById('category-cselect');

// Admin category custom dropdown
const adminCategoryInput   = document.getElementById('admin-category');
const adminCategoryTrigger = document.getElementById('admin-category-trigger');
const adminCategoryValue   = document.getElementById('admin-category-value');
const adminCategoryMenu    = document.getElementById('admin-category-menu');
const adminCategoryWrap    = document.getElementById('admin-category-cselect');

yearEl.textContent = new Date().getFullYear();

/* Summary counter */
summaryEl.addEventListener('input', () => {
  countEl.textContent = summaryEl.value.length;
});

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */
let discordUser  = null;   // { id, username, global_name, avatar }
let selectedFile = null;

/* ---------------------------------------------------------
   SESSION PERSISTENCE (localStorage)
--------------------------------------------------------- */
const SESSION_KEY = 'vafeed_discord_session';

function saveSession(user, accessToken, expiresIn) {
  const session = {
    user,
    accessToken,
    expiresAt: Date.now() + ((expiresIn || 604800) * 1000)
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[Session] Failed to save session:', e);
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.expiresAt || Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

/* ---------------------------------------------------------
   CATEGORY CUSTOM DROPDOWN (public)
--------------------------------------------------------- */
let categoryOpen = false;

function renderCategoryOptions() {
  categoryMenu.innerHTML = '';

  const makeOption = (value, label) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.value = value;
    li.textContent = label;

    if (categoryInput.value === value) {
      li.setAttribute('aria-selected', 'true');
    } else {
      li.setAttribute('aria-selected', 'false');
    }

    li.addEventListener('click', () => {
      setCategory(value, label);
      closeCategoryMenu();
    });

    categoryMenu.appendChild(li);
  };

  BASE_CATEGORIES.forEach(cat => makeOption(cat, cat));
}

function setCategory(value, label) {
  categoryInput.value = value || '';
  categoryValue.textContent = label || 'Select a category…';

  if (value) {
    delete categoryValue.dataset.placeholder;
  } else {
    categoryValue.dataset.placeholder = 'true';
  }

  Array.from(categoryMenu.children).forEach(li => {
    if (!li.dataset.value) return;
    li.setAttribute(
      'aria-selected',
      li.dataset.value === value ? 'true' : 'false'
    );
  });
}

function openCategoryMenu() {
  if (categoryOpen) return;
  categoryOpen = true;
  categoryMenu.hidden = false;
  categoryTrigger.setAttribute('aria-expanded', 'true');
}

function closeCategoryMenu() {
  if (!categoryOpen) return;
  categoryOpen = false;
  categoryMenu.hidden = true;
  categoryTrigger.setAttribute('aria-expanded', 'false');
}

function toggleCategoryMenu() {
  if (categoryOpen) closeCategoryMenu();
  else openCategoryMenu();
}

categoryTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleCategoryMenu();
});

document.addEventListener('click', (e) => {
  if (categoryOpen && !categoryWrap.contains(e.target)) {
    closeCategoryMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && categoryOpen) closeCategoryMenu();
});

renderCategoryOptions();
setCategory('', '');

/* ---------------------------------------------------------
   ADMIN CATEGORY CUSTOM DROPDOWN
--------------------------------------------------------- */
let adminCategoryOpen = false;

function renderAdminCategoryOptions() {
  adminCategoryMenu.innerHTML = '';

  if (!ADMIN_CATEGORIES.length) return;

  ADMIN_CATEGORIES.forEach(cat => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.value = cat;
    li.textContent = cat;

    if (adminCategoryInput.value === cat) {
      li.setAttribute('aria-selected', 'true');
    } else {
      li.setAttribute('aria-selected', 'false');
    }

    li.addEventListener('click', () => {
      setAdminCategory(cat);
      closeAdminCategoryMenu();
    });

    adminCategoryMenu.appendChild(li);
  });
}

function setAdminCategory(value) {
  adminCategoryInput.value = value || '';
  adminCategoryValue.textContent = value || 'Select admin category (optional)…';

  if (value) {
    delete adminCategoryValue.dataset.placeholder;
  } else {
    adminCategoryValue.dataset.placeholder = 'true';
  }

  Array.from(adminCategoryMenu.children).forEach(li => {
    if (!li.dataset.value) return;
    li.setAttribute(
      'aria-selected',
      li.dataset.value === value ? 'true' : 'false'
    );
  });
}

function openAdminCategoryMenu() {
  if (adminCategoryOpen) return;
  adminCategoryOpen = true;
  adminCategoryMenu.hidden = false;
  adminCategoryTrigger.setAttribute('aria-expanded', 'true');
}

function closeAdminCategoryMenu() {
  if (!adminCategoryOpen) return;
  adminCategoryOpen = false;
  adminCategoryMenu.hidden = true;
  adminCategoryTrigger.setAttribute('aria-expanded', 'false');
}

adminCategoryTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  if (adminCategoryOpen) closeAdminCategoryMenu();
  else openAdminCategoryMenu();
});

document.addEventListener('click', (e) => {
  if (adminCategoryOpen && !adminCategoryWrap.contains(e.target)) {
    closeAdminCategoryMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && adminCategoryOpen) closeAdminCategoryMenu();
});

renderAdminCategoryOptions();
setAdminCategory('');

/* ---------------------------------------------------------
   ADMIN SECTION VISIBILITY
--------------------------------------------------------- */
function setAdminSectionVisible(visible) {
  if (!adminSection) return;
  adminSection.hidden = !visible;
}

/* ---------------------------------------------------------
   ADMIN BADGE VISIBILITY (account dropdown)
--------------------------------------------------------- */
function setAdminBadgeVisible(visible) {
  if (!dropdownBadge) return;
  dropdownBadge.hidden = !visible;
}

/* ---------------------------------------------------------
   UPLOAD ZONE LOGIC
--------------------------------------------------------- */
uploadZone.addEventListener('click', (e) => {
  if (e.target.closest('.upload-remove')) return;
  fileInput.click();
});

['dragenter', 'dragover'].forEach(evt => {
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
  });
});

uploadZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files?.[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showMessage('error', '❌ File must be an image (JPG/PNG/WebP).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showMessage('error', '❌ Maximum image size is 5MB.');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadPlaceholder.hidden = true;
    uploadPreview.hidden = false;
    uploadZone.classList.add('has-file');
  };
  reader.readAsDataURL(file);

  clearMessage();
}

removeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = '';
  previewImg.src = '';
  uploadPreview.hidden = true;
  uploadPlaceholder.hidden = false;
  uploadZone.classList.remove('has-file');
});

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function showMessage(type, text) {
  messageEl.className = 'form-message ' + type;
  messageEl.textContent = text;
  messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessage() {
  messageEl.className = 'form-message';
  messageEl.textContent = '';
}

function setLoading(on) {
  submitBtn.classList.toggle('loading', on);
  submitBtn.disabled = on;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function showDiscordError(msg) {
  discordError.textContent = '❌ ' + msg;
  discordError.hidden = false;
}

function clearDiscordError() {
  discordError.hidden = true;
  discordError.textContent = '';
}

/* ---------------------------------------------------------
   LOGIN GATE (Discord OAuth)
--------------------------------------------------------- */
function setFormLocked(locked) {
  if (locked) {
    submitWrap.classList.add('locked');
    submitWrap.classList.remove('unlocked');
  } else {
    submitWrap.classList.remove('locked');
    submitWrap.classList.add('unlocked');
  }
}

setFormLocked(true);
setAdminSectionVisible(false);
setAdminBadgeVisible(false);

loginBtn.addEventListener('click', () => {
  clearDiscordError();

  if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID.includes('PASTE_')) {
    showDiscordError('Discord Client ID is not set in u_script.js');
    return;
  }

  const state = crypto.randomUUID();
  window.name = 'oauth_state=' + state;

  console.log('[OAuth] Starting login. Saved state:', state);

  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         'identify',
    state:         state
  });

  window.location.href = 'https://discord.com/oauth2/authorize?' + params;
});

/* ---------------------------------------------------------
   ACCOUNT MENU (dropdown)
--------------------------------------------------------- */
function openAccountDropdown() {
  accountDropdown.hidden = false;
  accountBtn.setAttribute('aria-expanded', 'true');
}

function closeAccountDropdown() {
  accountDropdown.hidden = true;
  accountBtn.setAttribute('aria-expanded', 'false');
}

function toggleAccountDropdown() {
  if (accountDropdown.hidden) openAccountDropdown();
  else closeAccountDropdown();
}

accountBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAccountDropdown();
});

document.addEventListener('click', (e) => {
  if (!accountDropdown.hidden && !accountMenu.contains(e.target)) {
    closeAccountDropdown();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !accountDropdown.hidden) {
    closeAccountDropdown();
  }
});

accountSignout.addEventListener('click', () => {
  closeAccountDropdown();

  discordUser = null;
  clearSession();

  accountMenu.hidden = true;
  loginGate.hidden = false;

  isOfficialEl.checked = false;
  officialHint.hidden = true;
  airlineEl.readOnly = false;
  airlineEl.value = '';

  setAdminSectionVisible(false);
  setAdminBadgeVisible(false);
  setAdminCategory('');
  closeAdminCategoryMenu();

  setCategory('', '');
  closeCategoryMenu();

  setFormLocked(true);
  clearMessage();
  clearDiscordError();
});

/* ---------------------------------------------------------
   APPLY DISCORD USER TO UI (reusable)
--------------------------------------------------------- */
function applyDiscordUser(user) {
  discordUser = user;

  accountAvatar.src = user.avatar;
  dropdownAvatar.src = user.avatar;
  dropdownName.textContent = user.global_name;
  dropdownUsername.textContent = '@' + user.username;

  loginGate.hidden = true;
  accountMenu.hidden = false;

  if (!airlineEl.value.trim()) {
    airlineEl.value = user.global_name;
  }

  const admin = isAdmin(user);

  // Admin section (official toggle + admin category)
  if (admin) {
    setAdminSectionVisible(true);
    renderAdminCategoryOptions();
  } else {
    setAdminSectionVisible(false);
    isOfficialEl.checked = false;
    officialHint.hidden = true;
    airlineEl.readOnly = false;
    setAdminCategory('');
  }

  // Admin badge in account dropdown
  setAdminBadgeVisible(admin);

  // Public category dropdown
  const previousValue = categoryInput.value;
  renderCategoryOptions();

  if (previousValue && BASE_CATEGORIES.includes(previousValue)) {
    setCategory(previousValue, previousValue);
  } else {
    setCategory('', '');
  }

  setFormLocked(false);
  clearDiscordError();
}

/* ---------------------------------------------------------
   DISCORD CALLBACK HANDLER
--------------------------------------------------------- */
async function handleDiscordCallback() {
  const url = new URL(window.location.href);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err   = url.searchParams.get('error');

  if (err) {
    showDiscordError('Login was cancelled or failed.');
    cleanUrl();
    return;
  }
  if (!code) return;

  const match = /(?:^|;)oauth_state=([^;]+)/.exec(window.name || '');
  const savedState = match ? match[1] : null;

  console.log('[OAuth] Callback received.');
  console.log('[OAuth] savedState:', savedState);
  console.log('[OAuth] returned state:', state);

  if (!savedState || state !== savedState) {
    showDiscordError(
      'Invalid OAuth state. (saved=' + savedState + ', got=' + state + ')'
    );
    cleanUrl();
    return;
  }

  window.name = '';

  try {
    const tokenRes = await fetch(
      APPS_SCRIPT_URL + '?action=discord_token'
      + '&code=' + encodeURIComponent(code)
      + '&redirect_uri=' + encodeURIComponent(DISCORD_REDIRECT_URI)
    );
    const tokenJson = await tokenRes.json();
    if (!tokenJson.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error || 'Failed to exchange code for token');
    }

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenJson.access_token }
    });
    if (!meRes.ok) throw new Error('Failed to fetch Discord user info');

    const me = await meRes.json();

    const user = {
      id:          me.id,
      username:    me.username,
      global_name: me.global_name || me.username,
      avatar: me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(me.id) >> 22) % 6}.png`
    };

    console.log('[OAuth] Logged in as:', user);

    saveSession(user, tokenJson.access_token, tokenJson.expires_in);
    applyDiscordUser(user);

  } catch (e) {
    console.error(e);
    showDiscordError(e.message);
  } finally {
    cleanUrl();
  }
}

function cleanUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

/* ---------------------------------------------------------
   OFFICIAL TOGGLE
--------------------------------------------------------- */
isOfficialEl.addEventListener('change', () => {
  const on = isOfficialEl.checked;

  officialHint.hidden = !on;

  if (on) {
    airlineEl.value = 'VAFeed Official';
    airlineEl.readOnly = true;
    airlineEl.style.borderColor = '';
    airlineEl.title = '';
  } else {
    airlineEl.readOnly = false;
    if (!airlineEl.value.trim() && discordUser) {
      airlineEl.value = discordUser.global_name;
    }
  }
});

/* ---------------------------------------------------------
   AIRLINE NAME VALIDATION (real-time)
--------------------------------------------------------- */
airlineEl.addEventListener('input', () => {
  if (isOfficialEl.checked) return;

  const val = airlineEl.value.trim();

  if (val && isForbiddenAirline(val)) {
    airlineEl.style.borderColor = '#ff6b6b';
    airlineEl.title = 'This name is reserved.';
  } else {
    airlineEl.style.borderColor = '';
    airlineEl.title = '';
  }
});

/* ---------------------------------------------------------
   CLOUDINARY UPLOAD
--------------------------------------------------------- */
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (CLOUDINARY_FOLDER) {
    formData.append('folder', CLOUDINARY_FOLDER);
  }

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Cloudinary upload failed: ' + res.status + ' — ' + errText);
  }

  const json = await res.json();
  if (!json.secure_url) throw new Error('Cloudinary: no secure_url returned');

  const optimizedUrl = json.secure_url.replace(
    '/image/upload/',
    '/image/upload/q_auto,f_auto,w_1200,c_limit/'
  );

  return optimizedUrl;
}

/* ---------------------------------------------------------
   APPS SCRIPT SUBMIT
--------------------------------------------------------- */
async function submitToSheet(payload) {
  const body = JSON.stringify({ ...payload, secret: SHARED_SECRET });

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });

    if (res.ok) {
      const json = await res.json();
      if (json.ok === false) {
        throw new Error(json.error || 'Server rejected submission');
      }
      return json;
    }

    if (res.status === 404) {
      console.warn('Apps Script returned 404 (redirect), assuming success.');
      return { ok: true };
    }

    throw new Error('Submit failed: ' + res.status);

  } catch (err) {
    if (err instanceof TypeError) {
      console.warn('CORS/network error — assuming submission succeeded.');
      return { ok: true };
    }
    throw err;
  }
}

/* ---------------------------------------------------------
   DISCORD WEBHOOK
--------------------------------------------------------- */
async function sendToDiscord(payload) {
  const isAdminCategory = ADMIN_CATEGORIES.includes(payload.category);
  const isOfficial      = payload.isOfficial === 'true';

  let webhookUrl = isAdminCategory
    ? DISCORD_WEBHOOK_ADMIN_URL
    : DISCORD_WEBHOOK_URL;

  if (
    isAdminCategory &&
    (!DISCORD_WEBHOOK_ADMIN_URL || DISCORD_WEBHOOK_ADMIN_URL.includes('PASTE_'))
  ) {
    console.warn(
      'Admin webhook URL not set — falling back to regular webhook.'
    );
    webhookUrl = DISCORD_WEBHOOK_URL;
  }

  if (!webhookUrl || webhookUrl.includes('PASTE_')) {
    console.warn('Discord webhook URL not set, skipping notification.');
    return;
  }

  const webhookName = isAdminCategory
    ? WEBHOOK_NAME_ADMIN
    : WEBHOOK_NAME_REGULAR;

  let fields = [];

  if (isAdminCategory) {
    fields = [];
  } else {
    fields = [
      { name: 'Date',     value: payload.date || '-',         inline: true },
      { name: 'Airline',  value: payload.submittedBy || '-',  inline: true },
      { name: 'Category', value: payload.category || '-',     inline: true }
    ];

    if (payload.discordId) {
      fields.push({
        name: 'Submitted by',
        value: `<@${payload.discordId}> (@${payload.discordUsername || 'unknown'})`,
        inline: false
      });
    }

    fields.push({
      name: '📝 Want to add your news?',
      value: `[**Click here to submit your news on VAFeed**](${VAFeed_UPLOAD_URL})`,
      inline: false
    });
  }

  const embed = {
    title: (isOfficial ? '🛡️ [OFFICIAL] ' : '') + payload.title,
    description: truncate(payload.content, 4000),
    color: isOfficial ? 0x57F287 : 0x5865F2,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: webhookName }
  };

  if (payload.imageUrl) {
    embed.image = { url: payload.imageUrl };
  }

  const body = {
    username: webhookName,
    embeds: [embed]
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.warn('Discord webhook failed: ' + res.status);
    }
  } catch (err) {
    console.warn('Discord webhook error:', err);
  }
}

function truncate(str, max) {
  if (!str) return '';
  str = String(str);
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

/* ---------------------------------------------------------
   SUBMIT HANDLER
--------------------------------------------------------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();

  if (!discordUser) {
    showMessage('error', '❌ Please sign in with Discord before submitting.');
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const baseCategory  = categoryInput.value.trim();
  const adminCategory = adminCategoryInput.value.trim();
  const finalCategory = adminCategory || baseCategory;
  const adminOnly     = ADMIN_CATEGORIES.includes(finalCategory);

  if (!finalCategory) {
    showMessage('error', '❌ Please select a category.');
    categoryTrigger.focus();
    return;
  }

  if (adminOnly && !isAdmin(discordUser)) {
    showMessage(
      'error',
      '❌ That category is restricted to admins.'
    );
    return;
  }

  const isOfficialChecked = isOfficialEl.checked;
  const airlineName = form.airline.value.trim();

  if (!isOfficialChecked && isForbiddenAirline(airlineName)) {
    showMessage(
      'error',
      '❌ That Virtual Airline name is reserved. Please use a different name.'
    );
    airlineEl.focus();
    return;
  }

  if (isOfficialChecked && !isAdmin(discordUser)) {
    showMessage(
      'error',
      '❌ You are not authorized to post as VAFeed Official.'
    );
    return;
  }

  setLoading(true);

  try {
    let imageUrl = '';
    if (selectedFile) {
      showMessage('success', '⏳ Uploading image…');
      imageUrl = await uploadToCloudinary(selectedFile);
      clearMessage();
    }

    const isOfficial = isOfficialEl.checked;

    const payload = {
      id:              'va-' + Date.now(),
      isFeatured:      'false',
      title:           form.title.value.trim(),
      category:        finalCategory,
      date:            getToday(),
      image:           '',
      summary:         form.summary.value.trim(),
      content:         form.content.value.trim(),
      imageUrl:        imageUrl,
      submittedBy:     isOfficial ? 'VAFeed Official' : form.airline.value.trim(),
      isOfficial:      isOfficial ? 'true' : 'false',
      discordId:       discordUser.id,
      discordUsername: discordUser.username
    };

    await submitToSheet(payload);
    await sendToDiscord(payload);

    showMessage('success', '✅ Thanks! Your submission has been published.');

    form.reset();
    countEl.textContent = '0';
    selectedFile = null;
    previewImg.src = '';
    uploadPreview.hidden = true;
    uploadPlaceholder.hidden = false;
    uploadZone.classList.remove('has-file');

    isOfficialEl.checked = false;
    officialHint.hidden = true;
    airlineEl.readOnly = false;
    airlineEl.value = discordUser.global_name;
    airlineEl.style.borderColor = '';
    airlineEl.title = '';

    setAdminCategory('');
    closeAdminCategoryMenu();

    setCategory('', '');
    closeCategoryMenu();

  } catch (err) {
    console.error(err);
    showMessage('error', '❌ ' + err.message);
  } finally {
    setLoading(false);
  }
});

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
(function init() {
  const url = new URL(window.location.href);
  const hasOAuthCode = url.searchParams.has('code') || url.searchParams.has('error');

  if (hasOAuthCode) {
    console.log('[Init] OAuth callback detected.');
    handleDiscordCallback();
    return;
  }

  const savedSession = loadSession();
  if (savedSession && savedSession.user) {
    console.log('[Init] Session restored from localStorage:', savedSession.user);
    applyDiscordUser(savedSession.user);
  } else {
    console.log('[Init] No active session. Showing login gate.');
    setFormLocked(true);
  }
})();