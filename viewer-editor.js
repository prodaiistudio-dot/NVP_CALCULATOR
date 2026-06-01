'use strict';

// ── In-viewer 3D editor panel ─────────────────────────────
window.ViewerEditor = (function () {

  let activeId    = null;
  let originalC3D = null;

  // ── Helpers ───────────────────────────────────────────────
  function $ (id)     { return document.getElementById(id); }
  function findItem(id) {
    if (typeof CATEGORIES === 'undefined') return null;
    for (const cat of CATEGORIES) {
      const it = cat.items.find(i => i.id === id);
      if (it) return it;
    }
    return null;
  }

  function setSlider(prefix, vals) {
    ['x','y','z'].forEach((a, i) => {
      const v = parseFloat(vals[i] ?? 0).toFixed(3);
      const r = $(`ve-${prefix}-${a}`); if (r) r.value = v;
      const n = $(`ve-${prefix}-${a}-n`); if (n) n.value = v;
    });
  }

  function getVec3(prefix) {
    return ['x','y','z'].map(a => parseFloat($(`ve-${prefix}-${a}-n`)?.value ?? 0));
  }

  // ── Show panel ────────────────────────────────────────────
  function show(id) {
    const item = findItem(id);
    if (!item) return;
    activeId    = id;
    originalC3D = JSON.parse(JSON.stringify(item.c3d || {}));

    const c3d = item.c3d || {};
    const pos = c3d.position || [0, 0, 0];
    const rot = c3d.rotation || [0, 0, 0];
    // Use [1,1,1] as neutral default so raw data.js values don't appear
    const sz  = (window.__CMS__?.items?.[id]?.c3d?.size) || [1, 1, 1];

    $('ve-name').textContent = item.name;
    $('ve-id').textContent   = id;

    setSlider('pos', pos);
    setSlider('rot', rot);
    ['w','h','d'].forEach((k, i) => { const el = $(`ve-sz-${k}`); if (el) el.value = sz[i]; });
    originalC3D._displaySize = sz.slice(); // store display default for reset

    $('ve-model-row').style.display = c3d.model ? 'flex' : 'none';
    $('ve-model-name').textContent  = c3d.model ? c3d.model.replace('models/', '') : '';

    $('viewer-editor').classList.add('open');
  }

  // ── Hide panel ────────────────────────────────────────────
  function hide() {
    activeId = null;
    $('viewer-editor').classList.remove('open');
  }

  // ── Apply live to viewer ──────────────────────────────────
  function applyLive() {
    if (!activeId) return;
    Viewer.updateC3D(activeId, getVec3('pos'), getVec3('rot'));
  }

  // ── Reset to original values ──────────────────────────────
  function reset() {
    if (!activeId || !originalC3D) return;
    setSlider('pos', originalC3D.position || [0,0,0]);
    setSlider('rot', originalC3D.rotation || [0,0,0]);
    ['w','h','d'].forEach((k, i) => {
      const el = $(`ve-sz-${k}`);
      if (el) el.value = (originalC3D.size || [1,1,1])[i];
    });
    applyLive();
    toast('Reset to original');
  }

  // ── Save to draft ─────────────────────────────────────────
  async function saveDraft() {
    if (!activeId) return;
    const item = findItem(activeId);
    if (!item) return;

    const pos = getVec3('pos');
    const rot = getVec3('rot');
    const sz  = ['w','h','d'].map(k => parseFloat($(`ve-sz-${k}`)?.value ?? 1));

    const payload = {
      name:        item.name,
      sku:         item.sku,
      description: item.description,
      price:       item.price,
      image:       item.image,
      specs:       item.specs,
      c3d: { ...item.c3d, position: pos, rotation: rot, size: sz },
    };
    if (item._i18n) payload._i18n = item._i18n;

    const token = localStorage.getItem('cms-token') || '';
    try {
      const res  = await fetch(`/api/cms/item/${activeId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body:    JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        // Update in-memory c3d so reset works with new values
        if (item.c3d) { item.c3d.position = pos; item.c3d.rotation = rot; item.c3d.size = sz; }
        originalC3D = JSON.parse(JSON.stringify(item.c3d || {}));
        toast('Saved to draft ✓', 'success');
        // Pulse the save button
        const btn = $('ve-save');
        if (btn) { btn.textContent = 'Saved ✓'; setTimeout(() => { btn.textContent = 'Save to Draft'; }, 2000); }
      } else if (res.status === 401) {
        toast('Log in to Admin panel to save', 'warn');
      } else {
        toast('Save failed', 'error');
      }
    } catch {
      toast('Server offline — preview only', 'warn');
    }
  }

  // ── Toast ─────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `toast toast-${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  // ── Wire up all controls ──────────────────────────────────
  function bindControls() {
    // Sliders ↔ number inputs sync + live apply
    ['pos','rot'].forEach(prefix => {
      ['x','y','z'].forEach(axis => {
        const range = $(`ve-${prefix}-${axis}`);
        const num   = $(`ve-${prefix}-${axis}-n`);
        if (range) range.addEventListener('input', () => {
          if (num) num.value = parseFloat(range.value).toFixed(3);
          applyLive();
        });
        if (num) num.addEventListener('input', () => {
          if (range) range.value = num.value;
          applyLive();
        });
      });
    });

    // Size lock — reference-based proportional scaling
    let veSizeLocked = false;
    let veSzRef = [1, 1, 1];
    const getVeSz = () => ['w','h','d'].map(k => parseFloat($(`ve-sz-${k}`)?.value) || 1);

    $('ve-sz-lock')?.addEventListener('click', () => {
      veSizeLocked = !veSizeLocked;
      if (veSizeLocked) veSzRef = getVeSz(); // snapshot current values
      $('ve-sz-lock').classList.toggle('ve-lock-active', veSizeLocked);
      const path = $('ve-lock-shackle');
      if (path) path.setAttribute('d', veSizeLocked
        ? 'M7 11V7a5 5 0 0 1 10 0'
        : 'M7 11V7a5 5 0 0 1 10 0v4');
    });
    ['w','h','d'].forEach((k, ki) => {
      const inp = $(`ve-sz-${k}`);
      if (!inp) return;
      inp.addEventListener('input', () => {
        const cur = parseFloat(inp.value);
        if (veSizeLocked && veSzRef[ki] > 0 && cur > 0) {
          const factor = cur / veSzRef[ki];
          ['w','h','d'].forEach((j, ji) => {
            if (ji === ki) return;
            const other = $(`ve-sz-${j}`);
            if (other) other.value = (veSzRef[ji] * factor).toFixed(4);
          });
        }
      });
    });

    $('ve-close') ?.addEventListener('click', () => { Viewer.clearSelection(); hide(); });
    $('ve-save')  ?.addEventListener('click', saveDraft);
    $('ve-reset') ?.addEventListener('click', reset);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (typeof Viewer === 'undefined') return;
    Viewer.onSelect   = show;
    Viewer.onDeselect = hide;
    bindControls();
  }

  return { init };

})();
