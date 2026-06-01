'use strict';

// ── State ─────────────────────────────────────────────────
const TOKEN_KEY = 'cms-token';
let token      = localStorage.getItem(TOKEN_KEY);
let sourceData = null;   // { categories, company } from data.js via server
let cmsData    = null;   // { items, company, draft }
let section    = 'products';
let activeCat  = null;
let editingId  = null;
let mediaCat   = 'images';

// ── Shortcuts ─────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

// ── API ───────────────────────────────────────────────────
async function api(method, url, body, isForm = false) {
  const headers = { 'x-admin-token': token };
  const opts = { method, headers };
  if (body && !isForm) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  else if (body)       { opts.body = body; }
  try {
    const res = await fetch(url, opts);
    if (res.status === 401) { doLogout(); return null; }
    return await res.json();
  } catch {
    return null;
  }
}

// ── Toasts ─────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const t = el('div', `toast toast-${type}`, msg);
  $('toast-wrap').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Confirm dialog ─────────────────────────────────────────
function confirm(msg) {
  return new Promise(resolve => {
    $('confirm-msg').textContent = msg;
    $('confirm-overlay').classList.remove('hidden');
    const ok = $('confirm-ok'), no = $('confirm-no');
    const cleanup = (val) => { $('confirm-overlay').classList.add('hidden'); ok.onclick = no.onclick = null; resolve(val); };
    ok.onclick = () => cleanup(true);
    no.onclick = () => cleanup(false);
  });
}

// ── Auth ──────────────────────────────────────────────────
async function doLogin(pass) {
  const data = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pass }),
  }).then(r => r.json()).catch(() => null);
  if (!data?.token) return false;
  token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  return true;
}

function doLogout() {
  api('POST', '/api/auth/logout');
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  $('admin-shell').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
}

// ── Data loading ───────────────────────────────────────────
async function loadData() {
  const [src, cms] = await Promise.all([
    api('GET', '/api/source-data'),
    api('GET', '/api/cms'),
  ]);
  if (!src || !cms) { toast('Failed to load data', 'error'); return false; }
  sourceData = src;
  cmsData    = cms;
  activeCat  = sourceData.categories[0]?.id;
  syncDraftUI();
  return true;
}

function syncDraftUI() {
  const hasDraft = !!(
    (cmsData.draft?.items   && Object.keys(cmsData.draft.items).length) ||
    (cmsData.draft?.company && Object.keys(cmsData.draft.company).length)
  );
  $('draft-badge').classList.toggle('hidden', !hasDraft);
  $('btn-publish').classList.toggle('hidden', !hasDraft);
  $('btn-discard').classList.toggle('hidden', !hasDraft);
}

// Get effective item = source + published overrides + draft overrides
function effectiveItem(id) {
  let item = null;
  for (const cat of sourceData.categories) {
    const found = cat.items.find(i => i.id === id);
    if (found) { item = JSON.parse(JSON.stringify(found)); break; }
  }

  // Handle items that were created through the admin (not in data.js)
  if (!item) {
    const newItem = cmsData.draft?.items?.[id] || cmsData.items?.[id];
    if (newItem?._isNew) {
      item = JSON.parse(JSON.stringify(newItem));
      item.id = id;
    }
  }
  if (!item) return null;

  const applyOverride = (ov) => {
    if (!ov) return;
    const { c3d, _i18n, specs, ...rest } = ov;
    Object.assign(item, rest);
    if (c3d)   item.c3d   = { ...item.c3d,   ...c3d };
    if (_i18n) item._i18n = { ...item._i18n, ..._i18n };
    if (specs) item.specs = { ...item.specs,  ...specs };
  };
  if (!item._isNew) {
    applyOverride(cmsData.items[id]);
    applyOverride(cmsData.draft?.items?.[id]);
  }
  return item;
}

// ── Navigation ─────────────────────────────────────────────
function navigate(name) {
  // Cleanup when leaving item editor
  if (editingId) {
    window.SceneEditor?.destroy();
    const content = $('admin-content');
    if (content) content.style.cssText = '';
  }
  // Cleanup when leaving scene setup
  if (section === 'scenesetup') {
    window.SceneEditor?.destroy();
    if (window._ssKeyHandler) { window.removeEventListener('keydown', window._ssKeyHandler); delete window._ssKeyHandler; }
    const content = $('admin-content');
    if (content) content.style.cssText = '';
  }
  section   = name;
  editingId = null;
  document.querySelectorAll('.nav-item').forEach(li => li.classList.toggle('active', li.dataset.section === name));
  render();
}

// Which tab to open when entering the item editor (null = default = basic)
let openTab = null;

// ── Environment state (global, shared across products) ──────
let _envObjects = [];   // [{ id, name, url, transform }]

function render() {
  if (editingId)                    return renderItemEditor(editingId);
  if (section === 'products')       return renderProducts();
  if (section === 'media')          return renderMedia();
  if (section === 'company')        return renderCompany();
  if (section === 'c3dsettings')    return renderC3DSettings();
  if (section === 'scenesetup')     return renderSceneSetup();
}

// ── Products section ───────────────────────────────────────
function renderProducts() {
  const cats = sourceData.categories;
  const cat  = cats.find(c => c.id === activeCat) || cats[0];

  const tabsHtml = cats.map(c => `
    <button class="cat-tab${c.id === activeCat ? ' active' : ''}" data-cat="${c.id}">
      ${c.icon || ''} ${c.name}
    </button>`).join('');

  const cardsHtml = (cat?.items || []).map(item => {
    const eff     = effectiveItem(item.id);
    const isDraft = !!cmsData.draft?.items?.[item.id];
    const imgSrc  = `/${eff.image}`;
    return `
    <div class="item-card${isDraft ? ' dirty' : ''}">
      <div class="item-thumb">
        <img src="${imgSrc}" alt="${eff.name}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div style="display:none;align-items:center;justify-content:center;font-size:32px;height:100%">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
      </div>
      <div class="item-info">
        <div class="item-name">${eff.name}</div>
        <div class="item-sku">${eff.sku}</div>
        <div class="item-price">${(eff.price || 0).toLocaleString()} ₴</div>
        ${isDraft ? '<span class="dirty-badge">Draft</span>' : ''}
      </div>
      <button class="btn btn-sm btn-ghost" data-edit="${item.id}">Edit →</button>
    </div>`;
  }).join('');

  // New items created through admin (stored in CMS with _isNew flag)
  const newItemsForCat = Object.entries({ ...cmsData.items, ...(cmsData.draft?.items || {}) })
    .filter(([, v]) => v?._isNew && v._categoryId === activeCat)
    .map(([id, v]) => `
      <div class="item-card dirty">
        <div class="item-thumb">
          <img src="/${v.image || ''}" alt="${v.name}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;align-items:center;justify-content:center;font-size:32px;height:100%">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
        </div>
        <div class="item-info">
          <div class="item-name">${v.name || 'Untitled'}</div>
          <div class="item-sku">${v.sku || ''}</div>
          <div class="item-price">${(v.price || 0).toLocaleString()} ₴</div>
          <span class="dirty-badge">New</span>
        </div>
        <button class="btn btn-sm btn-ghost" data-edit="${id}">Edit →</button>
      </div>`).join('');

  $('admin-content').innerHTML = `
    <div class="section-hd">
      <h2>Products</h2>
      <button id="btn-add-product" class="btn btn-primary btn-sm">+ Add Product</button>
    </div>
    <div class="cat-tabs">${tabsHtml}</div>
    <div class="items-grid">${cardsHtml}${newItemsForCat}</div>`;

  $('admin-content').querySelectorAll('.cat-tab').forEach(btn =>
    btn.addEventListener('click', () => { activeCat = btn.dataset.cat; renderProducts(); }));
  $('admin-content').querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => { editingId = btn.dataset.edit; render(); }));

  $('btn-add-product')?.addEventListener('click', () => showNewProductModal());
}

function showNewProductModal() {
  const cats = sourceData.categories;
  const overlay = el('div', 'new-product-overlay');
  overlay.innerHTML = `
    <div class="np-card">
      <div class="np-header">
        <h3>Add New Product</h3>
        <button class="icon-btn" id="np-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="np-body">
        <div class="form-group">
          <label class="field-label">Category</label>
          <select id="np-cat" class="input">
            ${cats.map(c => `<option value="${c.id}" ${c.id === activeCat ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="field-label">Name (UA)</label>
            <input type="text" id="np-name" class="input" placeholder="Product name">
          </div>
          <div class="form-group">
            <label class="field-label">SKU</label>
            <input type="text" id="np-sku" class="input" placeholder="BW-001">
          </div>
          <div class="form-group form-wide">
            <label class="field-label">Description</label>
            <textarea id="np-desc" class="input" rows="2" placeholder="Short description"></textarea>
          </div>
          <div class="form-group">
            <label class="field-label">Price (₴)</label>
            <input type="number" id="np-price" class="input" value="0">
          </div>
          <div class="form-group">
            <label class="field-label">Image path</label>
            <input type="text" id="np-img" class="input" placeholder="images/photo.jpg">
          </div>
        </div>
      </div>
      <div class="np-footer">
        <button id="np-save" class="btn btn-primary">Create Product</button>
        <button id="np-cancel" class="btn btn-ghost">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  $('np-close')?.addEventListener('click',  () => overlay.remove());
  $('np-cancel')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  $('np-save')?.addEventListener('click', async () => {
    const name = $('np-name')?.value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const catId = $('np-cat')?.value;
    const id = `__new__${catId}__${Date.now()}`;
    const payload = {
      _isNew: true,
      _categoryId: catId,
      name,
      sku:         $('np-sku')?.value.trim()  || id,
      description: $('np-desc')?.value.trim() || '',
      price:       parseFloat($('np-price')?.value) || 0,
      image:       $('np-img')?.value.trim()  || '',
      c3d: { role: 'addon', shape: 'box', position: [0,0,0], size: [1,0.4,1], color: 0x3b82f6 },
      specs: {},
    };
    const res = await api('POST', `/api/cms/item/${id}`, payload);
    if (res?.ok) {
      cmsData = await api('GET', '/api/cms'); syncDraftUI();
      overlay.remove(); activeCat = catId;
      toast('Product created — edit it to add details', 'success');
      renderProducts();
    } else { toast('Failed to create product', 'error'); }
  });
}

// ── Item editor ────────────────────────────────────────────
function renderItemEditor(id) {
  const item = effectiveItem(id);
  if (!item) return;

  // Make admin-content a flex column that fills height, no padding
  const content = $('admin-content');
  content.style.cssText = 'padding:0;gap:0;overflow:hidden;display:flex;flex-direction:column;height:100%';

  const c3d  = item.c3d || {};
  const pos  = c3d.position || [0, 0, 0];
  const rot  = c3d.rotation || [0, 0, 0];
  const cmsOv = cmsData.draft?.items?.[id] || cmsData.items?.[id];
  const size  = cmsOv?.c3d?.size || [1, 1, 1];

  const specRows = Object.entries(item.specs || {}).map(([k, v]) => specRow(k, v)).join('');

  const langSection = (lang) => {
    const t = item._i18n?.[lang];
    if (!t) return '';
    return `
    <div class="lang-section">
      <h4>${lang === 'ru' ? 'Russian' : 'English'}</h4>
      <div class="form-group">
        <label class="field-label">Name</label>
        <input type="text" class="input" data-i18n="${lang}" data-key="name" value="${t.name || ''}">
      </div>
      <div class="form-group">
        <label class="field-label">Description</label>
        <textarea class="input" rows="3" data-i18n="${lang}" data-key="description">${t.description || ''}</textarea>
      </div>
    </div>`;
  };

  content.innerHTML = `
  <div class="item-editor" id="item-editor-root">

    <!-- Header -->
    <div class="ie-header">
      <button id="back-btn" class="btn btn-ghost btn-sm">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <h2 class="ie-title">${item.name}</h2>
      <span class="sku-badge">${item.sku}</span>
      <div style="flex:1"></div>
      <button id="undo-btn" class="btn btn-ghost btn-sm" disabled title="Undo (Ctrl+Z)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.6-6.4L3 9"/></svg>
        Undo
      </button>
      <button id="redo-btn" class="btn btn-ghost btn-sm" disabled title="Redo (Ctrl+Shift+Z)">
        Redo
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.6-6.4L21 9"/></svg>
      </button>
      <button id="btn-save-draft" class="btn btn-primary btn-sm">Save draft</button>
    </div>

    <!-- Tabs -->
    <div class="ie-tabs">
      <button class="tab-btn active" data-tab="basic">General</button>
      <button class="tab-btn" data-tab="gallery">Gallery</button>
      <button class="tab-btn" data-tab="c3d">3D Settings</button>
      <button class="tab-btn" data-tab="i18n">Translations</button>
    </div>

    <!-- Body -->
    <div class="ie-body">

      <!-- General panel -->
      <div class="tab-panel active" data-panel="basic">
        <div class="form-grid">
          <div class="form-group">
            <label class="field-label">Name (UA)</label>
            <input type="text" id="f-name" class="input" value="${item.name}">
          </div>
          <div class="form-group">
            <label class="field-label">SKU</label>
            <input type="text" id="f-sku" class="input" value="${item.sku}">
          </div>
          <div class="form-group form-wide">
            <label class="field-label">Description (UA)</label>
            <textarea id="f-desc" class="input" rows="3">${item.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="field-label">Price (₴)</label>
            <input type="number" id="f-price" class="input" value="${item.price || 0}">
          </div>
          <div class="form-group form-wide">
            <label class="field-label">Product Image</label>
            <div class="img-upload-zone" id="img-drop-zone">
              <img id="f-img-preview" src="/${item.image}"
                   onerror="this.style.display='none';document.getElementById('img-placeholder').style.display='flex'"
                   onload="this.style.display='block';document.getElementById('img-placeholder').style.display='none'">
              <div id="img-placeholder" class="img-placeholder" style="display:none">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Drag & drop or click to upload</span>
              </div>
              <div class="img-upload-overlay">
                <label class="img-upload-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload image
                  <input type="file" accept="image/*" id="upload-img" hidden>
                </label>
              </div>
            </div>
            <div class="path-display" id="f-img">${item.image}</div>
          </div>
          <div class="form-group form-wide">
            <label class="field-label">Specs</label>
            <div id="specs-list">${specRows}</div>
            <button id="add-spec" class="btn btn-xs btn-ghost" style="align-self:flex-start;margin-top:4px">+ Add row</button>
          </div>
        </div>
      </div>

      <!-- Gallery panel -->
      <div class="tab-panel" data-panel="gallery">
        <div class="form-group">
          <label class="field-label">Product Gallery</label>
          <p style="font-size:12px;color:var(--text-3);margin-bottom:12px">
            Upload multiple images. The first image is the main product photo.
          </p>
          <div id="gallery-grid" class="gallery-grid">
            ${(item.gallery || (item.image ? [item.image] : [])).map((img, i) => `
              <div class="gallery-thumb" data-idx="${i}">
                <img src="/${img}" alt="">
                <button class="gallery-del" data-idx="${i}" title="Remove">✕</button>
                ${i === 0 ? '<div class="gallery-main-badge">Main</div>' : ''}
              </div>`).join('')}
            <label class="gallery-add-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add photo
              <input type="file" id="gallery-upload" accept="image/*" multiple hidden>
            </label>
          </div>
        </div>
      </div>

      <!-- 3D Settings panel — two-column layout -->
      <div class="tab-panel" data-panel="c3d">

        <!-- Left: vertical tabs + properties -->
        <div class="c3d-left">

          <!-- Vertical tab strip -->
          <div class="c3d-vtabs">
            <button class="c3d-vtab active" data-vtab="model" title="Model">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span>Model</span>
            </button>
            <button class="c3d-vtab" data-vtab="position" title="Position">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3M2 12h20M12 2v20"/></svg>
              <span>Pos</span>
            </button>
            <button class="c3d-vtab" data-vtab="rotation" title="Rotation">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>
              <span>Rot</span>
            </button>
            <button class="c3d-vtab" data-vtab="scale" title="Scale">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>Scale</span>
            </button>
            <button class="c3d-vtab" data-vtab="bounds" title="Bounds">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 9h20M9 2v20"/></svg>
              <span>Bounds</span>
            </button>
          </div>

          <!-- Content panes (one per tab) -->
          <div class="c3d-vcontent">

            <!-- Model pane -->
            <div class="c3d-vpanel active" id="vtab-model">
              <div class="tf-section">
                <div class="tf-section-head">
                  <span class="tf-section-label">3D Model file</span>
                </div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:10px;word-break:break-all;line-height:1.5" id="f-model" data-cleared="false">${c3d.model || '—'}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload GLB
                    <input type="file" accept=".glb,.gltf" id="upload-model" hidden>
                  </label>
                  ${c3d.model ? `<a href="/${c3d.model}" target="_blank" class="btn btn-xs btn-ghost">View ↗</a>` : ''}
                  ${c3d.model ? `<button id="btn-remove-model" class="btn btn-xs btn-danger">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    Remove
                  </button>` : ''}
                </div>
              </div>
              <div class="tf-section">
                <a href="/preview" target="_blank" class="btn btn-ghost btn-sm">Open 3D preview ↗</a>
              </div>
            </div>

            <!-- Position pane -->
            <div class="c3d-vpanel" id="vtab-position">
              <div class="tf-section">
                <div class="tf-section-head">
                  <span class="tf-section-label">Position</span>
                  <button class="tf-reset-btn" data-tf-reset="pos">Reset</button>
                </div>
                <div class="tf-xyz-row">
                  ${tfField('pos', 'X', pos[0], -5, 5)}
                  ${tfField('pos', 'Y', pos[1], -5, 5)}
                  ${tfField('pos', 'Z', pos[2], -5, 5)}
                </div>
              </div>
            </div>

            <!-- Rotation pane -->
            <div class="c3d-vpanel" id="vtab-rotation">
              <div class="tf-section">
                <div class="tf-section-head">
                  <span class="tf-section-label">Rotation (radians)</span>
                  <button class="tf-reset-btn" data-tf-reset="rot">Reset</button>
                </div>
                <div class="tf-xyz-row">
                  ${tfField('rot', 'X', rot[0], -3.15, 3.15)}
                  ${tfField('rot', 'Y', rot[1], -3.15, 3.15)}
                  ${tfField('rot', 'Z', rot[2], -3.15, 3.15)}
                </div>
              </div>
            </div>

            <!-- Scale pane -->
            <div class="c3d-vpanel" id="vtab-scale">
              <div class="tf-section">
                <div class="tf-section-head">
                  <span class="tf-section-label">Scale (W × H × D)</span>
                  <button id="f-sz-lock" class="sz-lock-btn" title="Lock proportions">
                    <svg id="sz-lock-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path id="szlk-shackle" d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </button>
                </div>
                <div class="sz-row">
                  <div class="sz-field">
                    <label>W</label>
                    <input type="number" id="f-sz-0" class="tf-num" value="${size[0]}" step="0.001" min="0.001">
                  </div>
                  <div class="sz-field">
                    <label>H</label>
                    <input type="number" id="f-sz-1" class="tf-num" value="${size[1]}" step="0.001" min="0.001">
                  </div>
                  <div class="sz-field">
                    <label>D</label>
                    <input type="number" id="f-sz-2" class="tf-num" value="${size[2]}" step="0.001" min="0.001">
                  </div>
                </div>
              </div>
            </div>

            <!-- Bounds pane -->
            <div class="c3d-vpanel" id="vtab-bounds">
              <div class="tf-section">
                <div class="tf-section-head">
                  <span class="tf-section-label">Bounds (read-only)</span>
                </div>
                <p style="font-size:11px;color:var(--text-4);margin-bottom:10px">Computed from the loaded model geometry.</p>
                <div class="bounds-row">
                  <div><div class="bounds-label">Width</div><div class="bounds-val" id="bound-w">—</div></div>
                  <div><div class="bounds-label">Height</div><div class="bounds-val" id="bound-h">—</div></div>
                  <div><div class="bounds-label">Depth</div><div class="bounds-val" id="bound-d">—</div></div>
                </div>
              </div>
            </div>

          </div><!-- .c3d-vcontent -->
        </div><!-- .c3d-left -->

        <!-- Right: 3D Viewer -->
        <div class="c3d-right">
          <div class="av-toolbar">
            <div class="av-tool-group">
              <button class="av-tool active" data-avmode="translate" title="Move (G)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3M2 12h20M12 2v20"/></svg>
                Move
              </button>
              <button class="av-tool" data-avmode="rotate" title="Rotate (R)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>
                Rotate
              </button>
              <button class="av-tool" data-avmode="scale" title="Scale (S)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                Scale
              </button>
            </div>
            <div class="av-tool-group" style="margin-left:auto">
              <button id="av-focus-model" class="av-tool" title="Focus model (F)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                Focus
              </button>
            </div>
          </div>
          <canvas id="av-canvas"></canvas>
          <div id="av-loading" class="av-loading" style="display:none">
            <span class="av-spin">⟳</span> Loading model…
          </div>
          <div class="av-hint">Drag to orbit · G=Move · R=Rotate · S=Scale · F=Focus</div>
        </div>

      </div>

      <!-- Translations panel -->
      <div class="tab-panel" data-panel="i18n">
        ${langSection('ru')}
        ${langSection('en')}
        ${!item._i18n ? '<p style="color:var(--text-4);font-size:13px">No translations defined for this item.</p>' : ''}
      </div>

    </div>

    <!-- Footer (hidden when c3d is active) -->
    <div class="ie-footer">
      <button id="btn-cancel" class="btn btn-ghost">Cancel</button>
    </div>

  </div>`;

  // Auto-open tab if set by caller (e.g. from 3D Settings nav section)
  if (openTab) {
    const targetBtn = content.querySelector(`[data-tab="${openTab}"]`);
    if (targetBtn) {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      targetBtn.classList.add('active');
      content.querySelector(`[data-panel="${openTab}"]`)?.classList.add('active');
      if (openTab === 'c3d') {
        $('item-editor-root')?.classList.add('c3d-active');
        setTimeout(() => { if (editingId === id && document.getElementById("av-canvas")) { initAdminViewer(id); wireAdminViewerControls(id); } }, 30);
      }
    }
    openTab = null;  // consume it
  }

  // Tab switching
  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      content.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add('active');
      const isCd = btn.dataset.tab === 'c3d';
      $('item-editor-root')?.classList.toggle('c3d-active', isCd);
      if (isCd) {
        setTimeout(() => { if (editingId === id && document.getElementById("av-canvas")) { initAdminViewer(id); wireAdminViewerControls(id); } }, 30);
      } else {
        // Before destroying SceneEditor, convert sliders from visual space
        // (fitOffset + c3d.position) back to pure c3d.position space.
        // This prevents saveDraft from baking fitOffset into the saved position
        // when the user saves from a non-3D tab.
        const SE = window.SceneEditor;
        if (SE) {
          const entry = SE.getModelEntry(editingId);
          const off = entry?.mesh?.userData?.fitOffset || { x:0, y:0, z:0 };
          if (off.x !== 0 || off.y !== 0 || off.z !== 0) {
            ['x','y','z'].forEach(a => {
              const np = $(`ni-pos-${a}`), rp = $(`sl-pos-${a}`);
              if (np) {
                const pure = parseFloat(((parseFloat(np.value) || 0) - (off[a] || 0)).toFixed(4));
                np.value = pure;
                if (rp) rp.value = pure;
              }
            });
          }
        }
        window.SceneEditor?.destroy();
      }
    });
  });

  // Vertical tab switching (inside 3D settings panel)
  content.querySelectorAll('.c3d-vtab').forEach(vtab => {
    vtab.addEventListener('click', () => {
      content.querySelectorAll('.c3d-vtab').forEach(t => t.classList.remove('active'));
      content.querySelectorAll('.c3d-vpanel').forEach(p => p.classList.remove('active'));
      vtab.classList.add('active');
      const panelId = 'vtab-' + vtab.dataset.vtab;
      document.getElementById(panelId)?.classList.add('active');
    });
  });


  // Transform reset buttons
  content.querySelectorAll('[data-tf-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.tfReset;
      ['x','y','z'].forEach(a => {
        const ni = $(`ni-${prefix}-${a}`), sl = $(`sl-${prefix}-${a}`);
        if (ni) ni.value = 0; if (sl) sl.value = 0;
      });
      syncAdminViewer();
    });
  });

  // Sync sliders ↔ number inputs + live viewer update
  content.querySelectorAll('.tf-slider').forEach(range => {
    range.addEventListener('input', () => {
      const num = range.id.replace('sl-', 'ni-');
      const n = $(num); if (n) n.value = range.value;
      syncAdminViewer();
    });
  });
  ['pos', 'rot'].forEach(prefix => {
    ['x', 'y', 'z'].forEach(axis => {
      const num = $(`ni-${prefix}-${axis}`);
      if (num) num.addEventListener('input', () => {
        const r = $(`sl-${prefix}-${axis}`); if (r) r.value = num.value;
        syncAdminViewer();
      });
    });
  });

  // Size inputs — reference-based proportional lock + live viewer sync
  let sizeLocked = false;
  let szRef = [1, 1, 1];

  const getSzValues = () => [0, 1, 2].map(i => parseFloat($(`f-sz-${i}`)?.value) || 1);

  $('f-sz-lock').addEventListener('click', () => {
    sizeLocked = !sizeLocked;
    if (sizeLocked) szRef = getSzValues();
    $('f-sz-lock').classList.toggle('locked', sizeLocked);
    $('szlk-shackle').setAttribute('d',
      sizeLocked ? 'M7 11V7a5 5 0 0 1 10 0' : 'M7 11V7a5 5 0 0 1 10 0v4');
  });

  [0, 1, 2].forEach(i => {
    const inp = $(`f-sz-${i}`);
    if (!inp) return;
    inp.addEventListener('input', () => {
      const cur = parseFloat(inp.value);
      if (sizeLocked && szRef[i] > 0 && cur > 0) {
        const factor = cur / szRef[i];
        [0, 1, 2].forEach(j => {
          if (j === i) return;
          const other = $(`f-sz-${j}`);
          if (other) other.value = (szRef[j] * factor).toFixed(4);
        });
      }
      syncAdminViewer();
    });
  });

  // Specs
  content.querySelectorAll('.btn-remove').forEach(wireRemoveSpec);
  $('add-spec').addEventListener('click', () => {
    const row = el('div', 'spec-row', specRow('', ''));
    $('specs-list').appendChild(row);
    wireRemoveSpec(row.querySelector('.btn-remove'));
  });

  // Image upload
  $('upload-img').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const filename = `${id}.${file.name.split('.').pop()}`;
    const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
    const res = await api('POST', '/api/upload/image', fd, true);
    if (res?.ok) {
      $('f-img').textContent = res.url;
      $('f-img-preview').src = '/' + res.url;
      $('f-img-preview').style.display = 'block';
      $('img-placeholder').style.display = 'none';
      toast('Image uploaded', 'success');
    } else { toast('Upload failed', 'error'); }
  });

  // Drag-and-drop for image
  const dropZone = $('img-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', async e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0]; if (!file || !file.type.startsWith('image/')) return;
      const filename = `${id}.${file.name.split('.').pop()}`;
      const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
      const res = await api('POST', '/api/upload/image', fd, true);
      if (res?.ok) {
        $('f-img').textContent = res.url;
        $('f-img-preview').src = '/' + res.url;
        $('f-img-preview').style.display = 'block';
        $('img-placeholder').style.display = 'none';
        toast('Image uploaded', 'success');
      }
    });
    dropZone.addEventListener('click', e => {
      if (!e.target.closest('label')) $('upload-img').click();
    });
  }

  // Model upload
  $('upload-model').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
    const res = await api('POST', '/api/upload/model', fd, true);
    if (res?.ok) {
      const fModel = $('f-model');
      fModel.textContent = res.url;
      fModel.dataset.cleared = 'false';
      toast('Model uploaded', 'success');
      const SE = window.SceneEditor;
      if (SE) {
        const dispSz = [0,1,2].map(i => parseFloat($(`f-sz-${i}`)?.value) || 1);
        SE.loadModel(id, res.url, {
          name:      effectiveItem(id)?.name || id,
          productId: id,
          visible:   true,
          transform: {
            position: { x: readSliderVec3('pos')[0], y: readSliderVec3('pos')[1], z: readSliderVec3('pos')[2] },
            rotation: { x: readSliderVec3('rot')[0], y: readSliderVec3('rot')[1], z: readSliderVec3('rot')[2] },
            scale:    { x: dispSz[0], y: dispSz[1], z: dispSz[2] },
          },
        }).then(() => { SE.selectModel(id); });
      }
    } else { toast('Upload failed', 'error'); }
  });

  // Remove 3D model
  $('btn-remove-model')?.addEventListener('click', async () => {
    const ok = await confirm('Remove the 3D model from this product?');
    if (!ok) return;
    const fModel = $('f-model');
    fModel.textContent = '—';
    fModel.dataset.cleared = 'true';
    window.SceneEditor?.destroy();
    toast('Model removed — save draft to apply', 'info');
  });

  // ── Gallery management ────────────────────────────────────
  let galleryImages = (effectiveItem(id)?.gallery || (effectiveItem(id)?.image ? [effectiveItem(id).image] : [])).slice();

  function renderGalleryGrid() {
    const grid = $('gallery-grid');
    if (!grid) return;
    const thumbs = galleryImages.map((img, i) => `
      <div class="gallery-thumb" data-idx="${i}">
        <img src="/${img}" alt="">
        <button class="gallery-del" data-del="${i}" title="Remove">✕</button>
        ${i === 0 ? '<div class="gallery-main-badge">Main</div>' : ''}
      </div>`).join('');
    const addBtn = `<label class="gallery-add-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add photo<input type="file" id="gallery-upload" accept="image/*" multiple hidden>
    </label>`;
    grid.innerHTML = thumbs + addBtn;
    bindGalleryEvents();
  }

  function bindGalleryEvents() {
    $('gallery-grid')?.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        galleryImages.splice(parseInt(btn.dataset.del), 1);
        renderGalleryGrid();
      });
    });
    $('gallery-upload')?.addEventListener('change', async e => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        const filename = `${id}-gallery-${Date.now()}.${file.name.split('.').pop()}`;
        const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
        const res = await api('POST', '/api/upload/image', fd, true);
        if (res?.ok) galleryImages.push(res.url);
      }
      renderGalleryGrid();
      toast(`${files.length} photo(s) added`, 'success');
    });
  }
  bindGalleryEvents();

  const cleanupUndo = setupUndoRedo();

  $('back-btn').addEventListener('click', () => {
    cleanupUndo();
    window.SceneEditor?.destroy();
    editingId = null;
    $('admin-content').style.cssText = '';
    render();
  });
  $('btn-cancel').addEventListener('click', () => {
    cleanupUndo();
    window.SceneEditor?.destroy();
    editingId = null;
    $('admin-content').style.cssText = '';
    render();
  });
  $('btn-save-draft').addEventListener('click', () => {
    const item = effectiveItem(id);
    if (item && galleryImages.length) {
      item.gallery = galleryImages.slice();
    }
    saveDraft(id, galleryImages.length ? galleryImages : undefined);
  });
}

// ── Transform field HTML generator ────────────────────────
function tfField(prefix, axis, value, min, max) {
  const a = axis.toLowerCase();
  return `<div class="tf-field">
    <div class="tf-axis ${a}">${axis}</div>
    <input type="number" id="ni-${prefix}-${a}"
           class="tf-num" value="${(+value).toFixed(3)}"
           step="0.001" min="${min}" max="${max}">
    <input type="range" id="sl-${prefix}-${a}"
           class="tf-slider sl-range" value="${value}"
           min="${min}" max="${max}" step="0.001">
  </div>`;
}

// ── Undo / Redo ────────────────────────────────────────────
function setupUndoRedo() {
  const MAX = 60;
  const undoStack = [];
  const redoStack = [];

  function snap() {
    return {
      pos: readSliderVec3('pos'),
      rot: readSliderVec3('rot'),
      sz:  [0,1,2].map(i => parseFloat($(`f-sz-${i}`)?.value) || 1),
    };
  }

  function push(s) {
    undoStack.push(s ?? snap());
    if (undoStack.length > MAX) undoStack.shift();
    redoStack.length = 0;
    refresh();
  }

  function applySnap(s) {
    ['x','y','z'].forEach((a, i) => {
      const r = $(`sl-pos-${a}`), n = $(`ni-pos-${a}`);
      if (r) r.value = s.pos[i]; if (n) n.value = s.pos[i];
    });
    ['x','y','z'].forEach((a, i) => {
      const r = $(`sl-rot-${a}`), n = $(`ni-rot-${a}`);
      if (r) r.value = s.rot[i]; if (n) n.value = s.rot[i];
    });
    s.sz.forEach((v, i) => { const el = $(`f-sz-${i}`); if (el) el.value = v; });
    syncAdminViewer();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snap());
    applySnap(undoStack.pop());
    refresh();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snap());
    applySnap(redoStack.pop());
    refresh();
  }

  function refresh() {
    const SE = window.SceneEditor;
    const canUndo = (SE?.canUndo) || undoStack.length > 0;
    const canRedo = (SE?.canRedo) || redoStack.length > 0;
    const u = $('undo-btn'), r = $('redo-btn');
    if (u) { u.disabled = !canUndo; u.title = `Undo (Ctrl+Z)`; }
    if (r) { r.disabled = !canRedo; r.title = `Redo (Ctrl+Shift+Z)`; }
  }

  // Capture state AFTER each range-slider drag ends
  $('admin-content').querySelectorAll('.sl-range').forEach(r => {
    r.addEventListener('change', () => push());
  });
  // Capture after number-input blur/Enter
  ['pos','rot'].forEach(prefix => ['x','y','z'].forEach(a => {
    $(`ni-${prefix}-${a}`)?.addEventListener('change', () => push());
  }));
  [0,1,2].forEach(i => $(`f-sz-${i}`)?.addEventListener('change', () => push()));

  // Capture after in-viewer gizmo drag ends
  if (window.SceneEditor) {
    window.SceneEditor.onTransformEnd = () => push();
  }

  // Keyboard shortcuts
  const onKey = e => {
    if (!editingId) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const SE = window.SceneEditor;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      // Prefer SceneEditor undo (gizmo/3D transforms) over slider-only undo
      if (SE?.canUndo) { SE.undo(); refresh(); }
      else undo();
    }
    if (e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      if (SE?.canRedo) { SE.redo(); refresh(); }
      else redo();
    }
    if (e.key === 'y') {
      e.preventDefault();
      if (SE?.canRedo) { SE.redo(); refresh(); }
      else redo();
    }
  };
  window.addEventListener('keydown', onKey);

  $('undo-btn')?.addEventListener('click', () => {
    const SE = window.SceneEditor;
    if (SE?.canUndo) { SE.undo(); refresh(); } else undo();
  });
  $('redo-btn')?.addEventListener('click', () => {
    const SE = window.SceneEditor;
    if (SE?.canRedo) { SE.redo(); refresh(); } else redo();
  });

  refresh();
  return () => window.removeEventListener('keydown', onKey);
}

// ── Environment helpers ────────────────────────────────────
async function loadEnvObjects(productModelId) {
  const data = await api('GET', '/api/env');
  _envObjects = data?.objects || [];
  const SE = window.SceneEditor;
  if (!SE) return;

  for (const obj of _envObjects) {
    const savedT = obj.transform;
    // Check if scale looks like a raw un-fitted value (scale > 10 = likely natural GLB units)
    // In that case re-fit to 2 units to avoid swamping the product model
    const rawScale = savedT?.scale;
    const needsFit = rawScale && Math.max(rawScale.x, rawScale.y, rawScale.z) > 10;
    await SE.loadModel(`__env__${obj.id}`, obj.url, {
      name:    obj.name,
      isEnv:   true,
      ...(needsFit
        ? { fitToSize: [2, 2, 2], transform: { position: savedT.position, rotation: savedT.rotation } }
        : { transform: savedT || { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} } }
      ),
    });
  }

  // Keep focus on the product model — don't let env loads hijack the camera
  if (productModelId && SE.getModelEntry(productModelId)) {
    SE.selectModel(productModelId);
    // Don't refocus camera — user already sees the product model
  }

  renderEnvList();
}

function renderEnvList() {
  const list = $('env-obj-list');
  if (!list) return;
  const SE = window.SceneEditor;
  if (!_envObjects.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-4);padding:4px 0">No objects yet. Add a GLB file.</div>';
    return;
  }
  list.innerHTML = _envObjects.map(obj => `
    <div class="env-obj-item" data-env-id="${obj.id}">
      <div class="env-obj-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      </div>
      <span class="env-obj-name">${obj.name}</span>
      <div class="env-obj-actions">
        <button class="tf-reset-btn env-select-btn" data-env-id="${obj.id}" title="Select in viewer">↗</button>
        <button class="env-del-btn" data-env-id="${obj.id}" title="Remove">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.env-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!SE) return;
      const envId = `__env__${btn.dataset.envId}`;
      SE.selectModel(envId);
      SE.focusSelected();
      // Switch to position tab so user can see & edit transform
      const posTabs = document.querySelectorAll('.c3d-vtab');
      posTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.c3d-vpanel').forEach(p => p.classList.remove('active'));
      const posTab = document.querySelector('[data-vtab="position"]');
      if (posTab) { posTab.classList.add('active'); $('vtab-position')?.classList.add('active'); }
    });
  });

  list.querySelectorAll('.env-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const envId = btn.dataset.envId;
      if (!await confirm(`Remove this object from the scene?`)) return;
      const SE = window.SceneEditor;
      SE?.removeModel(`__env__${envId}`);
      _envObjects = _envObjects.filter(o => o.id !== envId);
      renderEnvList();
    });
  });
}

async function saveEnvObjects() {
  const SE = window.SceneEditor;
  // Snapshot current 3D positions for each env object
  const objects = _envObjects.map(obj => {
    const t = SE?.getTransform(`__env__${obj.id}`);
    return { ...obj, transform: t || obj.transform };
  });
  try {
    const res = await api('POST', '/api/env', { objects });
    if (res?.ok) {
      _envObjects = objects;
      toast('Environment saved', 'success');
    } else {
      toast('Save failed — try reloading the admin panel', 'error');
    }
  } catch (err) {
    toast('Save error: ' + (err?.message || 'unknown'), 'error');
  }
}

// ── Admin 3D viewer helpers ────────────────────────────────
function initAdminViewer(id) {
  const canvas = document.getElementById('av-canvas');
  if (!canvas || typeof THREE === 'undefined') return;
  const SE = window.SceneEditor;
  if (!SE) return;

  const c3d    = effectiveItem(id)?.c3d || {};
  const cmsOv  = cmsData.draft?.items?.[id] || cmsData.items?.[id];
  // dispSz = target box dimensions used by fitModelToBox, same as viewer.js
  const dispSz = cmsOv?.c3d?.size || [1, 1, 1];
  const pos    = c3d.position || [0, 0, 0];
  const rot    = c3d.rotation || [0, 0, 0];

  SE.init(canvas);

  // Use fitToSize so scale semantics match viewer.js fitModelToBox() exactly
  SE.loadModel(id, c3d.model || null, {
    name:      effectiveItem(id)?.name || id,
    productId: id,
    visible:   true,
    fitToSize: c3d.model ? dispSz : null,
    transform: {
      position: { x: pos[0] ?? 0, y: pos[1] ?? 0, z: pos[2] ?? 0 },
      rotation: { x: rot[0] ?? 0, y: rot[1] ?? 0, z: rot[2] ?? 0 },
    },
  }).then(() => {
    // Guard: user may have clicked Back while the model was loading.
    // If editingId changed or the canvas is gone, don't touch the UI.
    if (editingId !== id || !document.getElementById('av-canvas')) return;

    SE.selectModel(id);
    SE.focusSelected();

    // After load, sync ALL sliders to match the actual loaded mesh state.
    const entry = SE.getModelEntry(id);
    if (entry?.mesh) {
      const m   = entry.mesh;
      const nat = m.userData.naturalBox;
      const v4  = v => parseFloat(v).toFixed(4);

      // Position (visual = fitOffset + c3d.pos)
      ['x', 'y', 'z'].forEach(a => {
        const val = v4(m.position[a] || 0);
        const rp = $(`sl-pos-${a}`), np = $(`ni-pos-${a}`);
        if (rp) rp.value = val;
        if (np) np.value = val;
      });

      // Scale → target-box dimensions (mesh.scale × naturalSize)
      if (nat) {
        const dims = [
          (m.scale.x || 1) * (nat.size.x || 1),
          (m.scale.y || 1) * (nat.size.y || 1),
          (m.scale.z || 1) * (nat.size.z || 1),
        ];
        [0, 1, 2].forEach(i => {
          const el = $(`f-sz-${i}`);
          if (el) el.value = parseFloat(dims[i].toFixed(4));
        });
      }
    }

    const bounds = SE.getBounds(id);
    if (bounds) {
      const bs = $('bounds-section');
      if (bs) bs.style.display = '';
      const bw = $('bound-w'), bh = $('bound-h'), bd = $('bound-d');
      if (bw) bw.textContent = bounds.x.toFixed(3);
      if (bh) bh.textContent = bounds.y.toFixed(3);
      if (bd) bd.textContent = bounds.z.toFixed(3);
    }

    // Load global environment objects — pass product id to keep camera on it
    loadEnvObjects(id);
  });

  // When user drags gizmo → show VISUAL position in sliders (mesh.position = world position).
  // When gizmo moves/rotates/scales → sync all inputs.
  // Position: store as visual (fitOffset + c3d.pos); saveDraft subtracts fitOffset.
  // Scale: convert mesh.scale → target box dimensions = scale × naturalSize, so the
  //        public viewer's fitModelToBox(model, c3d.size) reproduces the exact same result.
  SE.onTransform = (_, t) => {
    if (!t) return;
    const v4 = v => parseFloat(v).toFixed(4);

    // Position + rotation
    ['x','y','z'].forEach(a => {
      const rp = $(`sl-pos-${a}`), np = $(`ni-pos-${a}`);
      if (rp) rp.value = v4(t.position[a] || 0);
      if (np) np.value = v4(t.position[a] || 0);
      const rr = $(`sl-rot-${a}`), nr = $(`ni-rot-${a}`);
      if (rr) rr.value = v4(t.rotation[a] || 0);
      if (nr) nr.value = v4(t.rotation[a] || 0);
    });

    // Scale: gizmo directly sets mesh.scale — convert to target-box dimensions
    // so that fitModelToBox(model, saved_size) gives the same visual scale.
    // formula: target_dim = mesh_scale * natural_size
    const entry = SE.getModelEntry(SE.selectedId);
    const nat = entry?.mesh?.userData?.naturalBox;
    if (nat && t.scale) {
      const dims = [
        (t.scale.x || 1) * (nat.size.x || 1),
        (t.scale.y || 1) * (nat.size.y || 1),
        (t.scale.z || 1) * (nat.size.z || 1),
      ];
      [0, 1, 2].forEach(i => {
        const el = $(`f-sz-${i}`);
        if (el) el.value = parseFloat(dims[i].toFixed(4));
      });
    }
  };
}

function wireAdminViewerControls(id) {
  const SE = window.SceneEditor;
  if (!SE) return;

  document.querySelectorAll('[data-avmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-avmode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      SE.setMode(btn.dataset.avmode);
    });
  });

  const translateBtn = document.querySelector('[data-avmode="translate"]');
  if (translateBtn) { translateBtn.classList.add('active'); SE.setMode('translate'); }

  document.getElementById('av-focus-model')?.addEventListener('click', () => SE.focusSelected());
}

function syncAdminViewer() {
  const SE = window.SceneEditor;
  if (!SE) return;
  const selId = SE.selectedId;
  if (!selId) return;
  const visualPos = readSliderVec3('pos');  // sliders are in visual/world space
  const rot = readSliderVec3('rot');
  const sz  = [0,1,2].map(i => parseFloat(document.getElementById(`f-sz-${i}`)?.value) || 1);
  const entry = SE.getModelEntry(selId);
  if (entry?.hasGLB) {
    // Convert visual position → c3d position (subtract fitOffset) for reFitModel
    const off = entry.mesh.userData.fitOffset || { x: 0, y: 0, z: 0 };
    SE.reFitModel(selId, sz, {
      position: { x: visualPos[0] - off.x, y: visualPos[1] - off.y, z: visualPos[2] - off.z },
      rotation: { x: rot[0], y: rot[1], z: rot[2] },
    });
  } else {
    SE.applyTransform(selId, {
      position: { x: visualPos[0], y: visualPos[1], z: visualPos[2] },
      rotation: { x: rot[0], y: rot[1], z: rot[2] },
      scale:    { x: sz[0],  y: sz[1],  z: sz[2]  },
    });
  }
}

function specRow(k, v) {
  return `<div class="spec-row">
    <input class="input spec-key" value="${k}" placeholder="Key">
    <input class="input spec-val" value="${v}" placeholder="Value">
    <button class="btn-remove" title="Remove">✕</button>
  </div>`;
}
function wireRemoveSpec(btn) {
  btn.addEventListener('click', () => btn.closest('.spec-row').remove());
}

function readSliderVec3(prefix) {
  return ['x', 'y', 'z'].map(a => parseFloat($(`ni-${prefix}-${a}`)?.value || 0));
}

function readSpecs() {
  const specs = {};
  $('admin-content').querySelectorAll('.spec-row').forEach(row => {
    const k = row.querySelector('.spec-key')?.value.trim();
    const v = row.querySelector('.spec-val')?.value.trim();
    if (k) specs[k] = v;
  });
  return specs;
}

function readI18n() {
  const out = {};
  $('admin-content').querySelectorAll('[data-i18n]').forEach(el => {
    const lang = el.dataset.i18n, key = el.dataset.key;
    if (!out[lang]) out[lang] = {};
    out[lang][key] = el.value;
  });
  return Object.keys(out).length ? out : undefined;
}

async function saveDraft(id, gallery) {
  const item    = effectiveItem(id);
  const c3dRole = item.c3d?.role || 'model';
  const modelEl = $('f-model');
  const model   = modelEl?.textContent.trim();
  const modelCleared = modelEl?.dataset.cleared === 'true';
  // If user explicitly removed the model, save null (no fallback to item.c3d.model)
  const resolvedModel = modelCleared ? null : (model && model !== '—' ? model : item.c3d?.model);

  const payload = {
    name:        $('f-name')?.value  || item.name,
    sku:         $('f-sku')?.value   || item.sku,
    description: $('f-desc')?.value  || item.description,
    price:       parseFloat($('f-price')?.value) || item.price,
    image:       $('f-img')?.textContent.trim() || item.image,
    specs:       readSpecs(),
    c3d: (() => {
      // Sliders are in visual/world space. Subtract fitOffset to get pure c3d.position
      // (the wrapper position used by the public viewer's fitModelToBox).
      const SE = window.SceneEditor;
      const modelEntry = SE?.getModelEntry(id);
      const off = modelEntry?.mesh?.userData?.fitOffset || { x: 0, y: 0, z: 0 };
      const visualPos = readSliderVec3('pos');
      return {
        role:     c3dRole,
        model:    resolvedModel,
        position: [visualPos[0] - off.x, visualPos[1] - off.y, visualPos[2] - off.z],
        size:     [0, 1, 2].map(i => parseFloat($(`f-sz-${i}`)?.value) || 1),
        rotation: readSliderVec3('rot'),
      };
    })(),
  };
  if (!payload.c3d.model) delete payload.c3d.model;

  const i18n = readI18n();
  if (i18n) payload._i18n = i18n;
  if (gallery && gallery.length) payload.gallery = gallery;
  if (item._isNew) { payload._isNew = true; payload._categoryId = item._categoryId || activeCat; }

  const res = await api('POST', `/api/cms/item/${id}`, payload);
  if (res?.ok) {
    cmsData = await api('GET', '/api/cms');
    syncDraftUI();
    toast('Saved to draft', 'success');
  } else {
    toast('Save failed', 'error');
  }
}

// ── 3D Space Setup section ─────────────────────────────────
const SS_EYE_ON  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const SS_EYE_OFF = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
let _ssUniform = false;

function renderSceneSetup() {
  const content = $('admin-content');
  content.style.cssText = 'padding:0;gap:0;overflow:hidden;display:flex;flex-direction:column;height:100%';

  content.innerHTML = `
  <div class="scene-setup" id="ss-root">

    <!-- Header -->
    <div class="ss-header">
      <h2>3D Space</h2>
      <span class="ss-subtitle">Configure the scene where products will be displayed</span>
      <div class="ss-spacer"></div>
      <a href="/preview" target="_blank" class="ss-tool" style="text-decoration:none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Preview ↗
      </a>
      <button id="ss-save" class="ss-tool active" style="margin-left:4px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save Scene
      </button>
    </div>

    <!-- Toolbar -->
    <div class="ss-toolbar">
      <button class="ss-tool active" data-mode="translate" title="Move (G)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3M2 12h20M12 2v20"/></svg>
        Move <span class="ss-kbd">G</span>
      </button>
      <button class="ss-tool" data-mode="rotate" title="Rotate (R)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>
        Rotate <span class="ss-kbd">R</span>
      </button>
      <button class="ss-tool" data-mode="scale" title="Scale (S)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        Scale <span class="ss-kbd">S</span>
      </button>
      <div class="ss-sep"></div>
      <button class="ss-tool" id="ss-focus-tool" title="Focus selected (F)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Focus <span class="ss-kbd">F</span>
      </button>
      <label class="ss-grid-label" title="Toggle grid">
        <input type="checkbox" id="ss-grid" checked>
        Grid
      </label>
      <label class="ss-grid-label" title="Toggle axes">
        <input type="checkbox" id="ss-axes" checked>
        Axes
      </label>
      <div class="ss-spacer"></div>
      <button class="ss-tool" id="ss-undo" disabled title="Undo (Ctrl+Z)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.6-6.4L3 9"/></svg>
        Undo
      </button>
      <button class="ss-tool" id="ss-redo" disabled title="Redo (Ctrl+Shift+Z)">
        Redo
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.6-6.4L21 9"/></svg>
      </button>
    </div>

    <!-- Body: left + viewport + right -->
    <div class="ss-body">

      <!-- Left: object list -->
      <div class="ss-panel ss-panel-left">
        <div class="ss-panel-title">Scene Objects</div>
        <div id="ss-obj-list" class="ss-obj-list">
          <div class="ss-empty-list">No objects. Add a GLB model to start.</div>
        </div>
        <label class="ss-add-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add GLB Object
          <input type="file" id="ss-add-file" accept=".glb,.gltf" hidden>
        </label>
      </div>

      <!-- Center: 3D viewport -->
      <div class="ss-viewport" id="ss-viewport">
        <canvas id="ss-canvas"></canvas>
        <div class="ss-mode-badge" id="ss-mode-badge">MOVE</div>
        <div class="ss-viewport-hint">Drag: Orbit · Scroll: Zoom · Right-drag: Pan · G/R/S: Mode · F: Focus</div>
      </div>

      <!-- Right: inspector -->
      <div class="ss-panel ss-panel-right">
        <div class="ss-panel-title">Inspector</div>
        <div id="ss-inspector-empty" class="ss-empty">Select an object<br>to edit its properties</div>
        <div id="ss-inspector-body" style="display:none" class="ss-inspector-scroll">

          <div class="ss-obj-name-row">
            <div class="ss-obj-title" id="ss-sel-name">—</div>
            <div class="ss-obj-url"  id="ss-sel-url">—</div>
          </div>

          <!-- Position -->
          <div class="ss-prop-section">
            <div class="ss-prop-section-head">
              <span class="ss-prop-section-title">Position</span>
              <button class="ss-prop-reset" data-reset="position">Reset</button>
            </div>
            <div class="ss-xyz">
              <div class="ss-xyz-field"><div class="ss-axis ss-x">X</div><input type="number" id="ss-px" class="ss-num" step="0.01"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-y">Y</div><input type="number" id="ss-py" class="ss-num" step="0.01"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-z">Z</div><input type="number" id="ss-pz" class="ss-num" step="0.01"></div>
            </div>
          </div>

          <!-- Rotation -->
          <div class="ss-prop-section">
            <div class="ss-prop-section-head">
              <span class="ss-prop-section-title">Rotation (rad)</span>
              <button class="ss-prop-reset" data-reset="rotation">Reset</button>
            </div>
            <div class="ss-xyz">
              <div class="ss-xyz-field"><div class="ss-axis ss-x">X</div><input type="number" id="ss-rx" class="ss-num" step="0.01"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-y">Y</div><input type="number" id="ss-ry" class="ss-num" step="0.01"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-z">Z</div><input type="number" id="ss-rz" class="ss-num" step="0.01"></div>
            </div>
          </div>

          <!-- Scale -->
          <div class="ss-prop-section">
            <div class="ss-prop-section-head">
              <span class="ss-prop-section-title">Scale</span>
              <button class="ss-prop-reset" data-reset="scale">Reset</button>
            </div>
            <div class="ss-xyz">
              <div class="ss-xyz-field"><div class="ss-axis ss-x">X</div><input type="number" id="ss-sx" class="ss-num" step="0.01" min="0.001"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-y">Y</div><input type="number" id="ss-sy" class="ss-num" step="0.01" min="0.001"></div>
              <div class="ss-xyz-field"><div class="ss-axis ss-z">Z</div><input type="number" id="ss-sz" class="ss-num" step="0.01" min="0.001"></div>
            </div>
            <label class="ss-uniform-row">
              <input type="checkbox" id="ss-uniform"> Uniform scale
            </label>
          </div>

          <!-- Actions -->
          <div class="ss-action-row">
            <button class="ss-btn" id="ss-focus-sel">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Focus
            </button>
            <button class="ss-btn ss-btn-danger" id="ss-delete-sel">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Delete
            </button>
          </div>

        </div>
      </div>

    </div><!-- .ss-body -->

    <!-- Status bar -->
    <div class="ss-statusbar">
      <span>Objects: <b id="ss-count">0</b></span>
      <span id="ss-sel-status">Selected: <b>none</b></span>
      <span>Mode: <b id="ss-mode-label">Move</b></span>
    </div>

  </div>`;

  setTimeout(() => _initSceneSetup(), 40);
}

async function _initSceneSetup() {
  if (section !== 'scenesetup') return;
  const SE = window.SceneEditor;
  if (!SE || typeof THREE === 'undefined') return;
  const canvas = $('ss-canvas');
  if (!canvas) return;

  SE.init(canvas);

  // ── Load saved scene objects ────────────────────────────
  const data = await api('GET', '/api/env');
  const objects = data?.objects || [];
  for (const obj of objects) {
    const savedT = obj.transform;
    const rawScale = savedT?.scale;
    const needsFit = rawScale && Math.max(rawScale.x, rawScale.y, rawScale.z) > 10;
    await SE.loadModel(obj.id, obj.url, {
      name: obj.name, isEnv: true,
      ...(needsFit
        ? { fitToSize:[2,2,2], transform: { position: savedT.position, rotation: savedT.rotation } }
        : { transform: savedT || { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} } }
      ),
    });
  }
  _ssRefreshList();
  _ssRefreshUndo();

  // ── Callbacks ───────────────────────────────────────────
  SE.onSelect = (id, transform, name) => {
    $('ss-inspector-empty').style.display = 'none';
    $('ss-inspector-body').style.display  = '';
    $('ss-sel-name').textContent  = name || id;
    $('ss-sel-url').textContent   = SE.getModelEntry(id)?.url || '';
    const selStatus = $('ss-sel-status');
    if (selStatus) selStatus.innerHTML = `Selected: <b>${name || id}</b>`;
    _ssSyncInspector(transform);
    _ssRefreshList();
  };
  SE.onDeselect = () => {
    $('ss-inspector-empty').style.display = '';
    $('ss-inspector-body').style.display  = 'none';
    const selStatus = $('ss-sel-status');
    if (selStatus) selStatus.innerHTML = `Selected: <b>none</b>`;
    _ssRefreshList();
  };
  SE.onTransform = (_, t) => {
    _ssSyncInspector(t);
    _ssRefreshUndo();
  };

  // ── Canvas click ────────────────────────────────────────
  let _ssClickStart = null;
  canvas.addEventListener('mousedown', e => { _ssClickStart = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  canvas.addEventListener('mouseup', e => {
    if (_ssClickStart) {
      const dx = Math.abs(e.clientX - _ssClickStart.x), dy = Math.abs(e.clientY - _ssClickStart.y);
      if (dx < 5 && dy < 5 && Date.now() - _ssClickStart.t < 350) SE.handleClick(e);
    }
    _ssClickStart = null;
  });
  canvas.addEventListener('dblclick', e => SE.handleDblClick(e));

  // ── Toolbar ─────────────────────────────────────────────
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      SE.setMode(btn.dataset.mode);
      const labels = { translate:'Move', rotate:'Rotate', scale:'Scale' };
      const lbl = labels[btn.dataset.mode] || btn.dataset.mode;
      if ($('ss-mode-label')) $('ss-mode-label').textContent = lbl;
      const badge = $('ss-mode-badge');
      if (badge) { badge.textContent = lbl.toUpperCase(); badge.classList.add('show'); setTimeout(() => badge.classList.remove('show'), 1000); }
    });
  });
  $('ss-focus-tool')?.addEventListener('click', () => SE.focusSelected());
  $('ss-grid')?.addEventListener('change', e => SE.toggleGrid(e.target.checked));
  $('ss-axes')?.addEventListener('change', e => SE.toggleAxes(e.target.checked));
  $('ss-undo')?.addEventListener('click', () => { SE.undo(); _ssRefreshUndo(); });
  $('ss-redo')?.addEventListener('click', () => { SE.redo(); _ssRefreshUndo(); });

  // ── Inspector inputs ─────────────────────────────────────
  ['ss-px','ss-py','ss-pz','ss-rx','ss-ry','ss-rz','ss-sx','ss-sy','ss-sz'].forEach(inputId => {
    $(inputId)?.addEventListener('input', () => {
      const id = SE.selectedId; if (!id) return;
      SE.pushUndoState();
      SE.applyTransform(id, _ssReadInspector());
      _ssRefreshUndo();
    });
  });

  $('ss-uniform')?.addEventListener('change', e => { _ssUniform = e.target.checked; });
  ['ss-sx','ss-sy','ss-sz'].forEach(fid => {
    $(fid)?.addEventListener('input', () => {
      if (!_ssUniform) return;
      const v = parseFloat($(fid)?.value) || 1;
      ['ss-sx','ss-sy','ss-sz'].forEach(oid => { if (oid !== fid && $(oid)) $(oid).value = v.toFixed(4); });
    });
  });

  // ── Reset buttons ────────────────────────────────────────
  document.querySelectorAll('.ss-prop-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = SE.selectedId; if (!id) return;
      SE.resetTransform(id, btn.dataset.reset);
      _ssRefreshUndo();
    });
  });

  // ── Actions ──────────────────────────────────────────────
  $('ss-focus-sel')?.addEventListener('click', () => SE.focusSelected());
  $('ss-delete-sel')?.addEventListener('click', async () => {
    const id = SE.selectedId; if (!id) return;
    const name = SE.getModelEntry(id)?.name || id;
    if (!await confirm(`Remove "${name}" from scene?`)) return;
    SE.removeModel(id);
    _ssRefreshList();
    _ssRefreshUndo();
  });

  // ── Add object ───────────────────────────────────────────
  $('ss-add-file')?.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
    toast('Uploading…', 'info');
    const res = await api('POST', '/api/upload/model', fd, true);
    if (!res?.ok) { toast('Upload failed', 'error'); return; }
    const id = name.replace(/\s+/g,'-') + '_' + Date.now();
    await SE.loadModel(id, res.url, { name, isEnv: true, fitToSize:[2,2,2], transform:{position:{x:0,y:0,z:0}} });
    SE.selectModel(id);
    _ssRefreshList();
    toast(`"${name}" added — use gizmo to position it`, 'success');
  });

  // ── Save scene ───────────────────────────────────────────
  $('ss-save')?.addEventListener('click', async () => {
    const ids = SE.getModelIds();
    const objects = ids.map(id => {
      const entry = SE.getModelEntry(id);
      const t = SE.getTransform(id);
      return { id, name: entry?.name || id, url: entry?.url || '', transform: t };
    });
    try {
      const res = await api('POST', '/api/env', { objects });
      if (res?.ok) toast('Scene saved', 'success');
      else toast('Save failed', 'error');
    } catch { toast('Save error', 'error'); }
  });

  // ── Keyboard shortcuts ────────────────────────────────────
  const ssKey = e => {
    if (section !== 'scenesetup') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); SE.undo(); _ssRefreshUndo(); }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); SE.redo(); _ssRefreshUndo(); }
    if (!mod) {
      if (e.key === 'g' || e.key === 'G') document.querySelector('[data-mode="translate"]')?.click();
      if (e.key === 'r' || e.key === 'R') document.querySelector('[data-mode="rotate"]')?.click();
      if (e.key === 's' || e.key === 'S') document.querySelector('[data-mode="scale"]')?.click();
      if (e.key === 'f' || e.key === 'F') SE.focusSelected();
      if (e.key === 'Delete' || e.key === 'Backspace') $('ss-delete-sel')?.click();
    }
  };
  window.addEventListener('keydown', ssKey);
  window._ssKeyHandler = ssKey;
}

// ── Scene setup helpers ────────────────────────────────────
function _ssSyncInspector(t) {
  if (!t) return;
  const set = (id, v) => { const el = $(id); if (el) el.value = parseFloat(v || 0).toFixed(4); };
  set('ss-px', t.position?.x); set('ss-py', t.position?.y); set('ss-pz', t.position?.z);
  set('ss-rx', t.rotation?.x); set('ss-ry', t.rotation?.y); set('ss-rz', t.rotation?.z);
  set('ss-sx', t.scale?.x);    set('ss-sy', t.scale?.y);    set('ss-sz', t.scale?.z);
}

function _ssReadInspector() {
  const n = id => parseFloat($(id)?.value) || 0;
  const s = id => Math.max(0.001, parseFloat($(id)?.value) || 1);
  return {
    position: { x: n('ss-px'), y: n('ss-py'), z: n('ss-pz') },
    rotation: { x: n('ss-rx'), y: n('ss-ry'), z: n('ss-rz') },
    scale:    { x: s('ss-sx'), y: s('ss-sy'), z: s('ss-sz') },
  };
}

function _ssRefreshList() {
  const SE = window.SceneEditor;
  const list = $('ss-obj-list');
  if (!list || !SE) return;
  const ids = SE.getModelIds();
  if ($('ss-count')) $('ss-count').textContent = ids.length;
  if (!ids.length) {
    list.innerHTML = '<div class="ss-empty-list">No objects yet.<br>Click "+ Add GLB Object" to start.</div>';
    return;
  }
  list.innerHTML = ids.map(id => {
    const entry = SE.getModelEntry(id);
    const isActive = SE.selectedId === id;
    const vis = SE.getVisible(id);
    return `
      <div class="ss-obj-item${isActive ? ' active' : ''}${!vis ? ' ss-hidden' : ''}" data-id="${id}">
        <button class="ss-eye${vis ? '' : ' off'}" data-eye="${id}">${vis ? SS_EYE_ON : SS_EYE_OFF}</button>
        <span class="ss-obj-label">${entry?.name || id}</span>
        <button class="ss-obj-del" data-del="${id}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-eye]') || e.target.closest('[data-del]')) return;
      const id = el.dataset.id;
      if (!SE.getVisible(id)) SE.setVisible(id, true);
      SE.selectModel(id);
      SE.focusSelected();
      _ssRefreshList();
    });
  });
  list.querySelectorAll('[data-eye]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      SE.setVisible(btn.dataset.eye, !SE.getVisible(btn.dataset.eye));
      _ssRefreshList();
    });
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const name = SE.getModelEntry(btn.dataset.del)?.name || btn.dataset.del;
      if (!await confirm(`Remove "${name}"?`)) return;
      SE.removeModel(btn.dataset.del);
      _ssRefreshList();
    });
  });
}

function _ssRefreshUndo() {
  const SE = window.SceneEditor;
  const u = $('ss-undo'), r = $('ss-redo');
  if (u) u.disabled = !SE?.canUndo;
  if (r) r.disabled = !SE?.canRedo;
}

// ── 3D Settings section ────────────────────────────────────
// Collects ALL products: source data + admin-created (_isNew) items
function _getAllProductsForC3D() {
  const cats = sourceData.categories;
  // Merge admin-created items into their categories
  const cmsItems = { ...cmsData.items, ...(cmsData.draft?.items || {}) };

  return cats.map(cat => {
    // Source items (all roles except finish — those have no 3D model to position)
    const srcItems = (cat.items || []).filter(item => item.c3d?.role !== 'finish');

    // Admin-created items for this category
    const newItems = Object.entries(cmsItems)
      .filter(([, v]) => v?._isNew && v._categoryId === cat.id)
      .map(([id, v]) => ({
        id, name: v.name || id, sku: v.sku || id,
        c3d: v.c3d || null, image: v.image || '',
        _isNew: true,
      }));

    const allItems = [...srcItems, ...newItems];
    return { cat, items: allItems };
  }).filter(({ items }) => items.length > 0);
}

let _c3dActiveCat = null;  // currently selected category filter

function renderC3DSettings() {
  const groups = _getAllProductsForC3D();
  if (!_c3dActiveCat && groups.length) _c3dActiveCat = groups[0].cat.id;

  // Category filter tabs
  const tabsHtml = groups.map(({ cat }) => `
    <button class="cat-tab${cat.id === _c3dActiveCat ? ' active' : ''}" data-c3dcat="${cat.id}">
      ${cat.icon || ''} ${cat.name}
    </button>`).join('');

  // Product rows for active category
  const activeGroup = groups.find(g => g.cat.id === _c3dActiveCat) || groups[0];
  const rowsHtml = (activeGroup?.items || []).map(item => {
    const eff      = effectiveItem(item.id);
    const hasGlb   = !!(eff?.c3d?.model);
    const isDraft  = !!cmsData.draft?.items?.[item.id];
    const isNew    = !!item._isNew;
    const imgSrc   = eff?.image || item.image;
    return `
    <div class="c3d-product-row">
      <div class="c3d-product-thumb">
        ${imgSrc
          ? `<img src="/${imgSrc}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="c3d-thumb-ph" style="display:none">📦</div>`
          : `<div class="c3d-thumb-ph">📦</div>`}
      </div>
      <div class="c3d-product-info">
        <span class="c3d-product-name">${eff?.name || item.name}</span>
        <span class="c3d-product-sku">${item.sku || eff?.sku || ''}</span>
      </div>
      <div class="c3d-product-badges">
        ${hasGlb  ? '<span class="c3d-badge-glb">GLB</span>'   : '<span class="c3d-badge-box">Box</span>'}
        ${isDraft ? '<span class="c3d-badge-draft">Draft</span>' : ''}
        ${isNew   ? '<span class="c3d-badge-draft">New</span>'   : ''}
      </div>
      <button class="btn btn-sm btn-ghost c3d-edit-btn" data-edit="${item.id}">
        Edit 3D →
      </button>
    </div>`;
  }).join('');

  const totalAll = groups.reduce((s, g) => s + g.items.length, 0);

  $('admin-content').innerHTML = `
    <div class="section-hd">
      <h2>3D Settings</h2>
      <span style="font-size:12px;color:var(--text-3)">${totalAll} product${totalAll !== 1 ? 's' : ''} · click a product to configure its 3D model</span>
    </div>
    <div class="cat-tabs" style="margin-bottom:4px">${tabsHtml}</div>
    <div class="c3d-settings-list">
      <div class="c3d-cat-group">
        <div class="c3d-product-list">${rowsHtml || '<div style="color:var(--text-4);font-size:13px;padding:20px">No products in this category.</div>'}</div>
      </div>
    </div>`;

  // Category tab switching
  $('admin-content').querySelectorAll('[data-c3dcat]').forEach(btn => {
    btn.addEventListener('click', () => {
      _c3dActiveCat = btn.dataset.c3dcat;
      renderC3DSettings();
    });
  });

  // Edit 3D button
  $('admin-content').querySelectorAll('.c3d-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openTab = 'c3d';
      editingId = btn.dataset.edit;
      render();
    });
  });
}

// ── Media section ──────────────────────────────────────────
async function renderMedia() {
  $('admin-content').innerHTML = `
    <div class="section-hd"><h2>Media</h2></div>
    <div class="media-tabs">
      <button class="cat-tab${mediaCat === 'images' ? ' active' : ''}" data-mcat="images">Images</button>
      <button class="cat-tab${mediaCat === 'models' ? ' active' : ''}" data-mcat="models">3D Models</button>
    </div>
    <div id="media-upload-zone" class="upload-zone">
      <div class="uz-icon">${mediaCat === 'images' ? '🖼' : '📐'}</div>
      <p>Click or drag & drop to upload</p>
      <span>${mediaCat === 'images' ? 'JPG, PNG, WebP (max 20 MB)' : 'GLB, GLTF (max 100 MB)'}</span>
      <input type="file" id="media-upload-input" hidden
             accept="${mediaCat === 'images' ? 'image/*' : '.glb,.gltf'}">
    </div>
    <div id="media-grid" class="media-grid"><div class="loading-spinner">Loading files…</div></div>`;

  $('admin-content').querySelectorAll('[data-mcat]').forEach(btn =>
    btn.addEventListener('click', () => { mediaCat = btn.dataset.mcat; renderMedia(); }));

  $('media-upload-zone').addEventListener('click', () => $('media-upload-input').click());

  $('media-upload-zone').addEventListener('dragover', e => {
    e.preventDefault(); $('media-upload-zone').style.borderColor = 'var(--accent)';
  });
  $('media-upload-zone').addEventListener('dragleave', () => {
    $('media-upload-zone').style.borderColor = '';
  });
  $('media-upload-zone').addEventListener('drop', e => {
    e.preventDefault(); $('media-upload-zone').style.borderColor = '';
    const file = e.dataTransfer.files[0]; if (file) handleMediaUpload(file);
  });

  $('media-upload-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (file) handleMediaUpload(file);
  });

  const files = await api('GET', `/api/files/${mediaCat}`);
  const grid  = $('media-grid');
  if (!files?.length) { grid.innerHTML = `<p style="color:var(--text-4);font-size:13px">No files yet.</p>`; return; }

  const isImg = mediaCat === 'images';
  grid.innerHTML = files.map(f => {
    const thumbHtml = isImg
      ? `<img src="/${f.url}" alt="${f.name}" loading="lazy">`
      : `<div class="media-model-icon">📐</div>`;
    return `
    <div class="media-card">
      <div class="media-thumb">${thumbHtml}</div>
      <div class="media-info">
        <div class="media-name">${f.name}</div>
        <div class="media-size">${formatSize(f.size)}</div>
      </div>
      <button class="media-del-btn" data-url="${f.url}" data-name="${f.name}" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');

  // Bind delete events
  grid.querySelectorAll('.media-del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const urlParts = btn.dataset.url.split('/');
      const type = urlParts[0];
      const filename = urlParts.slice(1).join('/');
      const ok = await confirm(`Delete "${btn.dataset.name}"?`);
      if (!ok) return;
      const res = await api('DELETE', `/api/files/${type}/${filename}`);
      if (res?.ok) { toast('File deleted', 'success'); renderMedia(); }
      else toast('Delete failed', 'error');
    });
  });
}

async function handleMediaUpload(file) {
  const endpoint = mediaCat === 'models' ? '/api/upload/model' : '/api/upload/image';
  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
  toast('Uploading…', 'info');
  const res = await api('POST', endpoint, fd, true);
  if (res?.ok) { toast('Uploaded: ' + res.url, 'success'); renderMedia(); }
  else         { toast('Upload failed', 'error'); }
}

function formatSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

// ── Company section ────────────────────────────────────────
function renderCompany() {
  const src = sourceData.company || {};
  const ov  = { ...cmsData.company, ...(cmsData.draft?.company || {}) };
  const co  = { ...src, ...ov };

  const field = (id, label, val) => `
    <div class="form-group">
      <label class="field-label">${label}</label>
      <input type="text" id="co-${id}" class="input" value="${val || ''}">
    </div>`;

  $('admin-content').innerHTML = `
    <div class="section-hd"><h2>Company Info</h2></div>
    <div class="company-card">
      ${field('name',         'Company name',  co.name)}
      ${field('phone',        'Phone',         co.phone)}
      ${field('email',        'Email',         co.email)}
      ${field('website',      'Website',       co.website)}
      ${field('currency',     'Currency symbol', co.currency)}
      ${field('currencyName', 'Currency name',   co.currencyName)}
      <div class="editor-footer">
        <button id="btn-save-company" class="btn btn-primary">Save to draft</button>
      </div>
    </div>`;

  $('btn-save-company').addEventListener('click', async () => {
    const payload = {
      name:         $('co-name')?.value,
      phone:        $('co-phone')?.value,
      email:        $('co-email')?.value,
      website:      $('co-website')?.value,
      currency:     $('co-currency')?.value,
      currencyName: $('co-currencyName')?.value,
    };
    const res = await api('POST', '/api/cms/company', payload);
    if (res?.ok) {
      cmsData = await api('GET', '/api/cms');
      syncDraftUI();
      toast('Company saved to draft', 'success');
    } else { toast('Save failed', 'error'); }
  });
}

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await doLogin($('login-pass').value);
    if (!ok) { $('login-error').classList.remove('hidden'); return; }
    $('login-error').classList.add('hidden');
    await startAdmin();
  });

  if (token) {
    const ok = await startAdmin();
    if (!ok) token = null;
  }
}

async function startAdmin() {
  $('admin-shell').classList.remove('hidden');
  $('login-screen').classList.add('hidden');
  const ok = await loadData();
  if (!ok) { doLogout(); return false; }
  render();
  bindShellEvents();
  return true;
}

function bindShellEvents() {
  document.querySelectorAll('.nav-item').forEach(li =>
    li.addEventListener('click', () => navigate(li.dataset.section)));

  $('sidebar-toggle').addEventListener('click', () =>
    $('admin-sidebar').classList.toggle('collapsed'));

  $('btn-publish').addEventListener('click', async () => {
    const ok = await confirm('Publish all draft changes? This will update the live website immediately.');
    if (!ok) return;
    const res = await api('POST', '/api/cms/publish');
    if (res?.ok) {
      cmsData = await api('GET', '/api/cms');
      syncDraftUI();
      toast('Published successfully!', 'success');
      render();
    } else { toast('Publish failed', 'error'); }
  });

  $('btn-discard').addEventListener('click', async () => {
    const ok = await confirm('Discard all unpublished draft changes?');
    if (!ok) return;
    const res = await api('POST', '/api/cms/discard');
    if (res?.ok) {
      cmsData = await api('GET', '/api/cms');
      syncDraftUI();
      toast('Draft discarded', 'info');
      editingId = null;
      render();
    } else { toast('Failed to discard', 'error'); }
  });

  $('btn-preview').addEventListener('click', () => window.open('/preview', '_blank'));
  $('btn-logout').addEventListener('click', () => doLogout());
}

// ── Start ─────────────────────────────────────────────────
boot();
