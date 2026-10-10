/* =========================================================
   VAFeed — Script
   Sumber data: Google Sheets via OpenSheet (opensheet.elk.sh)
   Kolom: id | isFeatured | title | category | date | image
          | summary | content | imageUrl | submittedBy
   ========================================================= */

/* ---------------------------------------------------------
   KONFIGURASI
--------------------------------------------------------- */
const SHEET_ID   = '1f1ggP7M0_CiM4xbDrgk5KogHHCXIskzJmO2OTxjFalA';
const SHEET_NAME = 'Sheet1';           // nama tab, atau ganti pakai gid (mis. '0')

const PER_PAGE = 6;                    // jumlah artikel per halaman

const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

/* ---------------------------------------------------------
   ELEMEN
--------------------------------------------------------- */
const featuredCard  = document.getElementById('featured-card');
const newsGrid      = document.getElementById('news-grid');
const loadingEl     = document.getElementById('loading');
const paginationEl  = document.getElementById('pagination');
const yearEl        = document.getElementById('year');

yearEl.textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */
let allArticles = [];       // semua artikel (setelah sort, exclude featured)
let currentPage = 1;

/* ---------------------------------------------------------
   UTIL
--------------------------------------------------------- */
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function isTruthy(val) {
  if (val === undefined || val === null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1' || v === 'y' || v === 'ya';
}

function cleanText(str) {
  if (!str) return '';
  return String(str)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------------------------------------------------------
   FETCH via OpenSheet
--------------------------------------------------------- */
async function fetchSheet() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Failed to fetch sheet: ' + res.status);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid response from OpenSheet');

  return data.map(row => {
    const obj = {};
    Object.keys(row).forEach(k => {
      obj[k.trim().toLowerCase()] = row[k];
    });
    return obj;
  });
}

/* ---------------------------------------------------------
   NORMALISASI
--------------------------------------------------------- */
function getImage(item) {
  // Baca semua varian kapitalisasi field
  return (
    item.imageurl ||
    item.imageUrl ||
    item.imageURL ||
    item.image_url ||
    item.image ||
    ''
  ).trim();
}

function normalizeItem(raw) {
  return {
    id:          raw.id || '',
    isFeatured:  isTruthy(raw.isfeatured),
    title:       raw.title || 'Untitled',
    category:    raw.category || 'News',
    date:        raw.date || '',
    image:       getImage(raw),
    summary:     raw.summary || '',
    content:     raw.content || ''
  };
}

/* ---------------------------------------------------------
   RENDER: FEATURED
--------------------------------------------------------- */
function renderFeatured(item) {
  if (!item) { featuredCard.style.display = 'none'; return; }

  const hasImage = !!item.image;

  if (hasImage) {
    featuredCard.classList.remove('no-image');
    featuredCard.innerHTML = `
      <div class="featured-inner">
        <div class="featured-media" style="background-image:url('${escapeHTML(item.image)}')"></div>
        <div class="featured-body">
          <span class="featured-tag">${escapeHTML(item.category)}</span>
          <h3 class="featured-title">${escapeHTML(item.title)}</h3>
          <p class="featured-excerpt">${escapeHTML(cleanText(item.summary))}</p>
          <div class="featured-meta">
            <span>${formatDate(item.date)}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    featuredCard.classList.add('no-image');
    featuredCard.innerHTML = `
      <div class="featured-body featured-body-full">
        <span class="featured-tag">${escapeHTML(item.category)}</span>
        <h3 class="featured-title">${escapeHTML(item.title)}</h3>
        <p class="featured-excerpt">${escapeHTML(cleanText(item.summary))}</p>
        <div class="featured-meta">
          <span>${formatDate(item.date)}</span>
        </div>
      </div>
    `;
  }

  featuredCard.style.display = '';
  featuredCard.onclick = () => openArticle(item);
}

/* ---------------------------------------------------------
   RENDER: GRID
--------------------------------------------------------- */
function buildCard(item, globalIndex) {
  const hasImage = !!item.image;
  const media = hasImage
    ? `<div class="card-media" style="background-image:url('${escapeHTML(item.image)}')"></div>`
    : '';

  return `
    <article class="card ${hasImage ? '' : 'no-image'}" data-index="${globalIndex}">
      ${media}
      <div class="card-body">
        <span class="card-tag">${escapeHTML(item.category)}</span>
        <h3 class="card-title">${escapeHTML(item.title)}</h3>
        <p class="card-excerpt">${escapeHTML(cleanText(item.summary))}</p>
        <div class="card-meta">
          <span>${formatDate(item.date)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderPage() {
  const totalPages = Math.max(1, Math.ceil(allArticles.length / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PER_PAGE;
  const visible = allArticles.slice(start, start + PER_PAGE);

  if (!visible.length) {
    newsGrid.innerHTML = `<p style="color:var(--text-mute)">No news yet.</p>`;
    paginationEl.innerHTML = '';
    return;
  }

  newsGrid.innerHTML = visible
    .map((item, i) => buildCard(item, start + i))
    .join('');

  newsGrid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index, 10);
      openArticle(allArticles[idx]);
    });
  });

  renderPagination(totalPages);
}

/* ---------------------------------------------------------
   RENDER: PAGINATION
--------------------------------------------------------- */
function renderPagination(totalPages) {
  if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

  const items = [];

  // Prev
  items.push(`
    <button class="page-btn nav" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
      ← Prev
    </button>
  `);

  // Page numbers dengan ellipsis
  const pages = buildPageList(currentPage, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      items.push(`<span class="page-ellipsis">…</span>`);
    } else {
      items.push(`
        <button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `);
    }
  });

  // Next
  items.push(`
    <button class="page-btn nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
      Next →
    </button>
  `);

  paginationEl.innerHTML = items.join('');

  paginationEl.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      if (isNaN(page) || page < 1 || page > totalPages || page === currentPage) return;

      currentPage = page;
      renderPage();
      scrollToGrid();
    });
  });
}

/* Bikin list halaman dengan ellipsis: 1 … 4 5 6 … 20 */
function buildPageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  pages.push(1);
  if (left > 2) pages.push('...');

  for (let i = left; i <= right; i++) pages.push(i);

  if (right < total - 1) pages.push('...');
  pages.push(total);

  return pages;
}

function scrollToGrid() {
  const sectionHead = document.querySelector('.section-head');
  if (!sectionHead) return;
  const y = sectionHead.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   MODAL
--------------------------------------------------------- */
function openArticle(item) {
  if (!item) return;

  let modal = document.getElementById('va-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'va-modal';
    modal.className = 'va-modal';
    modal.innerHTML = `
      <div class="va-modal-backdrop"></div>
      <div class="va-modal-panel">
        <button class="va-modal-close" aria-label="Close">×</button>
        <div class="va-modal-content"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.va-modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.va-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  const content = modal.querySelector('.va-modal-content');

  const heroHtml = item.image
    ? `<div class="va-modal-hero" style="background-image:url('${escapeHTML(item.image)}')"></div>`
    : '';

  content.innerHTML = `
    ${heroHtml}
    <div class="va-modal-body">
      <span class="va-modal-tag">${escapeHTML(item.category)}</span>
      <h2 class="va-modal-title">${escapeHTML(item.title)}</h2>
      <div class="va-modal-meta">
        <span>${formatDate(item.date)}</span>
      </div>
      <div class="va-modal-text">
        ${formatContent(item.content || item.summary)}
      </div>
    </div>
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('va-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function formatContent(text) {
  if (!text) return '';

  const cleaned = String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n');

  return cleaned
    .split(/\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHTML(cleanText(p))}</p>`)
    .join('');
}

/* ---------------------------------------------------------
   LOAD
--------------------------------------------------------- */
async function loadNews() {
  try {
    const rawItems = await fetchSheet();
    let items = rawItems.map(normalizeItem);

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    let featured = items.find(i => i.isFeatured);
    let rest = items.filter(i => i !== featured);

    if (!featured && items.length) {
      featured = items[0];
      rest = items.slice(1);
    }

    renderFeatured(featured);

    allArticles = rest;
    currentPage = 1;

    renderPage();

  } catch (err) {
    console.error(err);
    featuredCard.style.display = 'none';
    newsGrid.innerHTML = `<p style="color:var(--text-mute)">Unable to load feed. Please try again later.</p>`;
    paginationEl.innerHTML = '';
  } finally {
    loadingEl.classList.add('hidden');
  }
}

loadNews();