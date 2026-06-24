// ---------- State ----------
let token = localStorage.getItem('ledger_token') || null;
let items = [];
let goalHistory = {};
let currentFilter = 'all';

const GAUGE_CIRCUMFERENCE = 553; // 2 * PI * 88, matches the SVG radius

// ---------- Helpers ----------
function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function currentGoal() {
  const key = monthKey();
  if (goalHistory[key] !== undefined) return goalHistory[key];
  // Carry forward the most recent prior goal if this month has none yet.
  const keys = Object.keys(goalHistory).sort();
  const priorKeys = keys.filter((k) => k <= key);
  if (priorKeys.length > 0) return goalHistory[priorKeys[priorKeys.length - 1]];
  return 1000;
}

function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------- Auth ----------
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const password = document.getElementById('password-input').value;
  try {
    const data = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then((r) => r.json().then((b) => ({ ok: r.ok, body: b })));

    if (!data.ok) {
      loginError.textContent = data.body.error || 'Incorrect password';
      return;
    }
    token = data.body.token;
    localStorage.setItem('ledger_token', token);
    showApp();
  } catch (err) {
    loginError.textContent = 'Something went wrong. Try again.';
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
  token = null;
  localStorage.removeItem('ledger_token');
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

async function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  await loadAll();
}

// ---------- Data loading ----------
async function loadAll() {
  const [itemsRes, goalRes] = await Promise.all([api('/items'), api('/goal')]);
  items = itemsRes.items;
  goalHistory = goalRes.history;
  render();
}

// ---------- Rendering ----------
function render() {
  renderGauge();
  renderList();
}

function renderGauge() {
  const key = monthKey();
  const goal = currentGoal();
  const soldThisMonth = items.filter(
    (it) => it.date_sold && monthKey(new Date(it.date_sold)) === key
  );
  const profit = soldThisMonth.reduce(
    (sum, it) => sum + (Number(it.sold_price) - Number(it.cost)),
    0
  );
  const pct = goal > 0 ? Math.min(profit / goal, 1) : 0;
  const offset = GAUGE_CIRCUMFERENCE - pct * GAUGE_CIRCUMFERENCE;

  const fillEl = document.getElementById('gauge-fill');
  fillEl.style.strokeDashoffset = String(offset);
  fillEl.classList.toggle('complete', profit >= goal && goal > 0);

  document.getElementById('gauge-amount').textContent = fmtMoney(profit);
  document.getElementById('gauge-goal-label').textContent = `of ${fmtMoney(goal)}`;

  document.getElementById('stat-items').textContent = String(soldThisMonth.length);

  const avgMargin = soldThisMonth.length
    ? profit / soldThisMonth.length
    : 0;
  document.getElementById('stat-avg-margin').textContent = fmtMoney(avgMargin);

  const withDays = soldThisMonth.filter((it) => it.date_acquired && it.date_sold);
  const avgDays = withDays.length
    ? Math.round(
        withDays.reduce((s, it) => s + daysBetween(it.date_acquired, it.date_sold), 0) /
          withDays.length
      )
    : null;
  document.getElementById('stat-days').textContent = avgDays === null ? '—' : String(avgDays);
}

function renderList() {
  const listEl = document.getElementById('items-list');
  let filtered = items;
  if (currentFilter === 'unsold') filtered = items.filter((it) => !it.date_sold);
  else if (currentFilter === 'sold') filtered = items.filter((it) => it.date_sold);
  else if (currentFilter !== 'all') filtered = items.filter((it) => it.category === currentFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Nothing here yet.</p>';
    return;
  }

  listEl.innerHTML = '';
  for (const it of filtered) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = it.id;

    const profit = it.sold_price != null ? Number(it.sold_price) - Number(it.cost) : null;
    const profitHtml =
      profit === null
        ? '<span class="item-profit pending">unsold</span>'
        : `<span class="item-profit ${profit >= 0 ? 'positive' : ''}">${fmtMoney(profit)}</span>`;

    const linksHtml = renderLinks(it);

    card.innerHTML = `
      <div class="item-main">
        <span class="item-name">${escapeHtml(it.name)}</span>
        <span class="item-meta">
          <span class="category-tag">${escapeHtml(it.category)}</span>
          <span>${formatDate(it.date_acquired)}${it.date_sold ? ' → ' + formatDate(it.date_sold) : ''}</span>
        </span>
        ${linksHtml}
      </div>
      ${profitHtml}
    `;
    card.addEventListener('click', () => openForm(it));
    // Links inside the card should open in a new tab, not trigger edit mode.
    card.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', (e) => e.stopPropagation());
    });
    listEl.appendChild(card);
  }
}

function renderLinks(it) {
  const links = [];
  if (it.source_url) {
    links.push(`<a href="${escapeAttr(it.source_url)}" target="_blank" rel="noopener noreferrer" class="item-link">source ↗</a>`);
  }
  if (it.listing_url) {
    links.push(`<a href="${escapeAttr(it.listing_url)}" target="_blank" rel="noopener noreferrer" class="item-link">your listing ↗</a>`);
  }
  if (links.length === 0) return '';
  return `<span class="item-links">${links.join('<span class="link-sep">·</span>')}</span>`;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

document.getElementById('filter-select').addEventListener('change', (e) => {
  currentFilter = e.target.value;
  renderList();
});

// ---------- Item form ----------
const formCard = document.getElementById('item-form-card');
const itemForm = document.getElementById('item-form');
const showFormBtn = document.getElementById('show-form-btn');
const cancelFormBtn = document.getElementById('cancel-form-btn');
const formTitle = document.getElementById('form-title');

showFormBtn.addEventListener('click', () => openForm());
cancelFormBtn.addEventListener('click', closeForm);

function openForm(item = null) {
  itemForm.reset();
  document.getElementById('item-id').value = item ? item.id : '';
  formTitle.textContent = item ? 'Edit item' : 'Log an item';

  if (item) {
    document.getElementById('f-name').value = item.name;
    document.getElementById('f-category').value = item.category;
    document.getElementById('f-cost').value = item.cost;
    document.getElementById('f-sold-price').value = item.sold_price ?? '';
    document.getElementById('f-date-acquired').value = item.date_acquired;
    document.getElementById('f-date-sold').value = item.date_sold ?? '';
    document.getElementById('f-notes').value = item.notes ?? '';
    document.getElementById('f-source-url').value = item.source_url ?? '';
    document.getElementById('f-listing-url').value = item.listing_url ?? '';
    addDeleteButton(item.id);
  } else {
    document.getElementById('f-date-acquired').value = new Date().toISOString().slice(0, 10);
    removeDeleteButton();
  }

  formCard.classList.remove('hidden');
  formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  formCard.classList.add('hidden');
  itemForm.reset();
}

function addDeleteButton(id) {
  removeDeleteButton();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'delete-item-btn';
  btn.className = 'ghost-btn';
  btn.textContent = 'Delete';
  btn.style.marginRight = 'auto';
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    await api(`/items/${id}`, { method: 'DELETE' });
    closeForm();
    await loadAll();
  });
  document.querySelector('.form-actions').prepend(btn);
}

function removeDeleteButton() {
  const existing = document.getElementById('delete-item-btn');
  if (existing) existing.remove();
}

itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('item-id').value;
  const payload = {
    name: document.getElementById('f-name').value.trim(),
    category: document.getElementById('f-category').value,
    cost: parseFloat(document.getElementById('f-cost').value) || 0,
    sold_price: document.getElementById('f-sold-price').value
      ? parseFloat(document.getElementById('f-sold-price').value)
      : null,
    date_acquired: document.getElementById('f-date-acquired').value,
    date_sold: document.getElementById('f-date-sold').value || null,
    notes: document.getElementById('f-notes').value.trim() || null,
    source_url: document.getElementById('f-source-url').value.trim() || null,
    listing_url: document.getElementById('f-listing-url').value.trim() || null,
  };

  if (id) {
    await api(`/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/items', { method: 'POST', body: JSON.stringify(payload) });
  }

  closeForm();
  await loadAll();
});

// ---------- Goal modal ----------
const goalModal = document.getElementById('goal-modal');
document.getElementById('edit-goal-btn').addEventListener('click', () => {
  const key = monthKey();
  document.getElementById('goal-month-label').textContent = monthLabel(key);
  document.getElementById('goal-input').value = currentGoal();
  goalModal.classList.remove('hidden');
});

document.getElementById('goal-cancel-btn').addEventListener('click', () => {
  goalModal.classList.add('hidden');
});

document.getElementById('goal-save-btn').addEventListener('click', async () => {
  const key = monthKey();
  const goal = parseFloat(document.getElementById('goal-input').value) || 0;
  await api('/goal', { method: 'POST', body: JSON.stringify({ monthKey: key, goal }) });
  goalHistory[key] = goal;
  goalModal.classList.add('hidden');
  render();
});

// ---------- Init ----------
if (token) {
  showApp().catch(() => logout());
} else {
  loginScreen.classList.remove('hidden');
}
