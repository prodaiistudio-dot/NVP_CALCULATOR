'use strict';

// ── Phase 1: Asset Library ─────────────────────────────────
window.AssetLibrary = (function () {

  const CATEGORIES = ['sink', 'faucet', 'drain', 'accessory', 'finish', 'other'];
  let _assets = {};
  let _filter = { category: '', query: '' };
  let _onSelect = null;
  let _onAdd    = null;

  // ── API ──────────────────────────────────────────────────
  async function _req(method, url, body, isForm = false) {
    const token = localStorage.getItem('cms-token') || '';
    const opts  = { method, headers: { 'x-admin-token': token } };
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    else if (body) opts.body = body;
    const res = await fetch(url, opts);
    return res.json().catch(() => ({}));
  }

  async function load() {
    const d = await _req('GET', '/api/assets');
    _assets = d.assets || {};
  }

  async function createAsset(data) {
    const res = await _req('POST', '/api/assets', data);
    if (res.ok && res.asset) { _assets[res.asset.id] = res.asset; }
    return res;
  }

  async function updateAsset(id, data) {
    const res = await _req('PUT', `/api/assets/${id}`, data);
    if (res.ok) _assets[id] = { ..._assets[id], ...data };
    return res;
  }

  async function deleteAsset(id) {
    const res = await _req('DELETE', `/api/assets/${id}`);
    if (res.ok) delete _assets[id];
    return res;
  }

  async function uploadModel(assetId, file) {
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fd = new FormData(); fd.append('file', file); fd.append('filename', filename);
    const res = await _req('POST', '/api/upload/model', fd, true);
    if (res.ok && assetId) await updateAsset(assetId, { modelUrl: res.url });
    return res;
  }

  async function uploadThumbnail(assetId, file) {
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fd = new FormData(); fd.append('file', file); fd.append('filename', `thumbs/${filename}`);
    const res = await _req('POST', '/api/upload/image', fd, true);
    if (res.ok && assetId) await updateAsset(assetId, { thumbnail: res.url });
    return res;
  }

  // ── Filtered list ────────────────────────────────────────
  function filtered() {
    return Object.values(_assets).filter(a => {
      if (_filter.category && a.category !== _filter.category) return false;
      if (_filter.query) {
        const q = _filter.query.toLowerCase();
        return (a.name || '').toLowerCase().includes(q) || (a.id || '').toLowerCase().includes(q);
      }
      return true;
    });
  }

  // ── Render: full-page library ────────────────────────────
  function renderPage(container) {
    container.innerHTML = `
      <div class="al-page">
        <div class="al-toolbar">
          <div class="al-search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="al-search" class="al-search" placeholder="Search assets…" value="${_filter.query}">
          </div>
          <div class="al-cats">
            <button class="al-cat-btn${!_filter.category ? ' active' : ''}" data-cat="">All</button>
            ${CATEGORIES.map(c => `<button class="al-cat-btn${_filter.category === c ? ' active' : ''}" data-cat="${c}">${_catLabel(c)}</button>`).join('')}
          </div>
          <button class="al-upload-btn" id="al-add-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Asset
          </button>
        </div>
        <div class="al-grid" id="al-grid">
          ${_renderGrid()}
        </div>
      </div>`;
    _bindPageEvents(container);
  }

  function _renderGrid() {
    const list = filtered();
    if (!list.length) return `<div class="al-empty">No assets found.<br>Upload your first 3D model to get started.</div>`;
    return list.map(a => `
      <div class="al-card" data-id="${a.id}">
        <div class="al-thumb">
          ${a.thumbnail
            ? `<img src="/${a.thumbnail}" alt="${a.name}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="al-thumb-ph" ${a.thumbnail ? 'style="display:none"' : ''}>
            ${_catIcon(a.category)}
          </div>
          <div class="al-card-overlay">
            <button class="al-card-btn" data-action="preview" data-id="${a.id}" title="Preview">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </button>
            <button class="al-card-btn" data-action="edit" data-id="${a.id}" title="Edit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="al-card-btn danger" data-action="delete" data-id="${a.id}" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
        <div class="al-card-body">
          <div class="al-card-name">${a.name || a.id}</div>
          <div class="al-card-meta">
            <span class="al-cat-tag">${_catLabel(a.category)}</span>
            ${a.modelUrl ? `<span class="al-has-model" title="Has 3D model">3D</span>` : ''}
          </div>
        </div>
      </div>`).join('');
  }

  function _bindPageEvents(container) {
    container.querySelector('#al-search')?.addEventListener('input', e => {
      _filter.query = e.target.value;
      const grid = container.querySelector('#al-grid');
      if (grid) grid.innerHTML = _renderGrid();
      _bindCardEvents(container);
    });
    container.querySelectorAll('.al-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter.category = btn.dataset.cat;
        container.querySelectorAll('.al-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === _filter.category));
        const grid = container.querySelector('#al-grid');
        if (grid) grid.innerHTML = _renderGrid();
        _bindCardEvents(container);
      });
    });
    container.querySelector('#al-add-btn')?.addEventListener('click', () => showCreateDialog(container));
    _bindCardEvents(container);
  }

  function _bindCardEvents(container) {
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.action === 'delete') _confirmDelete(id, container);
        if (btn.dataset.action === 'edit')   showEditDialog(id, container);
        if (btn.dataset.action === 'preview' && _onSelect) _onSelect(_assets[id]);
      });
    });
    container.querySelectorAll('.al-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-action]')) return;
        const a = _assets[card.dataset.id];
        if (a && _onSelect) _onSelect(a);
        if (a && _onAdd)    _onAdd(a);
      });
    });
  }

  // ── Create / Edit dialog ─────────────────────────────────
  function showCreateDialog(container) {
    _showDialog({
      title: 'New Asset',
      asset: { id: '', name: '', category: 'sink', modelUrl: '', thumbnail: '' },
      isNew: true,
      container,
    });
  }

  function showEditDialog(id, container) {
    const asset = _assets[id];
    if (!asset) return;
    _showDialog({ title: 'Edit Asset', asset: { ...asset }, isNew: false, container });
  }

  function _showDialog({ title, asset, isNew, container }) {
    const dlg = document.createElement('div');
    dlg.className = 'al-dialog-overlay';
    dlg.innerHTML = `
      <div class="al-dialog">
        <div class="al-dialog-header">
          <h3>${title}</h3>
          <button class="al-dialog-close">✕</button>
        </div>
        <div class="al-dialog-body">
          <div class="al-form-row">
            <label>Asset ID ${isNew ? '(auto-generated if empty)' : ''}</label>
            <input id="dlg-id" class="al-input" value="${asset.id}" ${!isNew ? 'readonly' : ''} placeholder="e.g. asset_compact_400">
          </div>
          <div class="al-form-row">
            <label>Name *</label>
            <input id="dlg-name" class="al-input" value="${asset.name}" placeholder="Compact 400">
          </div>
          <div class="al-form-row">
            <label>Category</label>
            <select id="dlg-cat" class="al-input">
              ${CATEGORIES.map(c => `<option value="${c}" ${asset.category === c ? 'selected' : ''}>${_catLabel(c)}</option>`).join('')}
            </select>
          </div>
          <div class="al-form-row">
            <label>3D Model (.glb)</label>
            <div class="al-file-row">
              <span class="al-file-path" id="dlg-model-path">${asset.modelUrl || 'No model'}</span>
              <label class="al-file-btn">
                Upload .glb <input type="file" id="dlg-model-file" accept=".glb,.gltf" hidden>
              </label>
            </div>
          </div>
          <div class="al-form-row">
            <label>Thumbnail</label>
            <div class="al-thumb-row">
              <div class="al-thumb-preview" id="dlg-thumb-prev">
                ${asset.thumbnail ? `<img src="/${asset.thumbnail}">` : '<span>No image</span>'}
              </div>
              <label class="al-file-btn">
                Upload image <input type="file" id="dlg-thumb-file" accept="image/*" hidden>
              </label>
            </div>
          </div>
        </div>
        <div class="al-dialog-footer">
          <button class="al-btn-ghost" id="dlg-cancel">Cancel</button>
          <button class="al-btn-primary" id="dlg-save">Save Asset</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);

    let pendingModel = null, pendingThumb = null;

    dlg.querySelector('#dlg-model-file')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      pendingModel = file;
      dlg.querySelector('#dlg-model-path').textContent = file.name;
    });

    dlg.querySelector('#dlg-thumb-file')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      pendingThumb = file;
      const url = URL.createObjectURL(file);
      dlg.querySelector('#dlg-thumb-prev').innerHTML = `<img src="${url}">`;
    });

    const close = () => dlg.remove();
    dlg.querySelector('.al-dialog-close')?.addEventListener('click', close);
    dlg.querySelector('#dlg-cancel')?.addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

    dlg.querySelector('#dlg-save')?.addEventListener('click', async () => {
      const name = dlg.querySelector('#dlg-name')?.value.trim();
      if (!name) { alert('Name is required'); return; }

      const id       = dlg.querySelector('#dlg-id')?.value.trim() || ('asset_' + Date.now());
      const category = dlg.querySelector('#dlg-cat')?.value;

      const data = { id, name, category, modelUrl: asset.modelUrl || '', thumbnail: asset.thumbnail || '' };

      // Upload files first
      if (pendingModel) {
        const res = await uploadModel(null, pendingModel);
        if (res.ok) data.modelUrl = res.url;
      }
      if (pendingThumb) {
        const res = await uploadThumbnail(null, pendingThumb);
        if (res.ok) data.thumbnail = res.url;
      }

      if (isNew) await createAsset(data);
      else       await updateAsset(asset.id, data);

      close();
      // Re-render grid
      const grid = container.querySelector('#al-grid');
      if (grid) grid.innerHTML = _renderGrid();
      _bindCardEvents(container);
    });
  }

  async function _confirmDelete(id, container) {
    if (!window.confirm(`Delete asset "${_assets[id]?.name || id}"?`)) return;
    await deleteAsset(id);
    const grid = container.querySelector('#al-grid');
    if (grid) grid.innerHTML = _renderGrid();
    _bindCardEvents(container);
  }

  // ── Compact picker (used in scene editor) ────────────────
  function renderPicker(container, onPick) {
    container.innerHTML = `
      <div class="al-picker">
        <div class="al-picker-search">
          <input class="al-search al-picker-input" placeholder="Search assets…">
          <div class="al-picker-cats">
            <button class="al-cat-btn active" data-cat="">All</button>
            ${CATEGORIES.map(c => `<button class="al-cat-btn" data-cat="${c}">${_catLabel(c)}</button>`).join('')}
          </div>
        </div>
        <div class="al-picker-grid" id="al-picker-grid">${_renderPickerItems()}</div>
      </div>`;

    let pCat = '';
    container.querySelectorAll('.al-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pCat = btn.dataset.cat;
        container.querySelectorAll('.al-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === pCat));
        container.querySelector('#al-picker-grid').innerHTML = _renderPickerItems(pCat, container.querySelector('.al-picker-input')?.value);
        bindPicker();
      });
    });
    container.querySelector('.al-picker-input')?.addEventListener('input', e => {
      container.querySelector('#al-picker-grid').innerHTML = _renderPickerItems(pCat, e.target.value);
      bindPicker();
    });
    function bindPicker() {
      container.querySelectorAll('.al-picker-item').forEach(el => {
        el.addEventListener('click', () => onPick(_assets[el.dataset.id]));
      });
    }
    bindPicker();
  }

  function _renderPickerItems(cat = '', q = '') {
    const list = Object.values(_assets).filter(a => {
      if (cat && a.category !== cat) return false;
      if (q && !(a.name || '').toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    if (!list.length) return '<div class="al-empty" style="padding:16px;font-size:11px">No assets</div>';
    return list.map(a => `
      <div class="al-picker-item" data-id="${a.id}">
        <div class="al-picker-thumb">
          ${a.thumbnail ? `<img src="/${a.thumbnail}" loading="lazy">` : `<div>${_catIcon(a.category)}</div>`}
        </div>
        <div class="al-picker-name">${a.name || a.id}</div>
      </div>`).join('');
  }

  // ── Helpers ──────────────────────────────────────────────
  function _catLabel(c) {
    return { sink:'Sink', faucet:'Faucet', drain:'Drain', accessory:'Accessory', finish:'Finish', other:'Other' }[c] || c;
  }
  function _catIcon(c) {
    return { sink:'🚿', faucet:'🚰', drain:'🕳', accessory:'🧴', finish:'✨', other:'📦' }[c] || '📦';
  }

  function getAll()   { return _assets; }
  function getById(id) { return _assets[id] || null; }

  return {
    load,
    renderPage,
    renderPicker,
    getAll,
    getById,
    createAsset,
    updateAsset,
    deleteAsset,
    uploadModel,
    set onSelect(cb) { _onSelect = cb; },
    set onAdd(cb)    { _onAdd    = cb; },
  };
})();
