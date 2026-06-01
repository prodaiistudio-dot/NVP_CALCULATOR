// ============================================================
//  app.js
// ============================================================

const state = {};   // { catId: Set(itemId) }
let openDropdown = null;  // currently open category id

// ────────────────────────────────────────────────────────────
//  INIT
// ────────────────────────────────────────────────────────────
function init() {
  initTheme();
  window.Viewer?.setTheme?.(getTheme());

  document.getElementById("company-name").textContent = COMPANY.name;
  document.title = COMPANY.name;

  CATEGORIES.forEach(c => { state[c.id] = new Set(); });
  loadStateFromUrl();

  // If nothing was loaded from URL → pre-select first item of every category
  // so all 3D blocks are visible on first load
  const hasAnySelected = CATEGORIES.some(c => state[c.id].size > 0);
  if (!hasAnySelected) {
    CATEGORIES.forEach(cat => {
      if (cat.multiSelect) {
        // Multi-select: activate all items
        cat.items.forEach(item => state[cat.id].add(item.id));
      } else {
        // Single-select: activate the first item
        if (cat.items.length > 0) state[cat.id].add(cat.items[0].id);
      }
    });
  }

  window.Viewer?.init();

  buildSelectors();
  applyI18n();
  updateAll();
  bindGlobal();
  bindLangTheme();
}

// ────────────────────────────────────────────────────────────
//  URL STATE
// ────────────────────────────────────────────────────────────
function saveStateToUrl() {
  const obj = {};
  CATEGORIES.forEach(c => { if (state[c.id].size) obj[c.id] = [...state[c.id]]; });
  const has = Object.keys(obj).length > 0;
  history.replaceState(null, "",
    has ? "#" + btoa(encodeURIComponent(JSON.stringify(obj)))
        : location.pathname + location.search);
}

function loadStateFromUrl() {
  try {
    const h = location.hash.slice(1);
    if (!h) return;
    const obj = JSON.parse(decodeURIComponent(atob(h)));
    CATEGORIES.forEach(c => {
      (obj[c.id] || []).forEach(id => {
        if (c.items.some(i => i.id === id)) state[c.id].add(id);
      });
    });
  } catch (_) {}
}

// ────────────────────────────────────────────────────────────
//  BUILD SELECTORS
// ────────────────────────────────────────────────────────────
function buildSelectors() {
  const list = document.getElementById("selectors-list");
  list.innerHTML = "";

  CATEGORIES.forEach(cat => {
    const row = document.createElement("div");
    row.className = "selector-row";
    row.id = `row-${cat.id}`;

    const badge = '';

    row.innerHTML = `
      <button class="selector-header" type="button" id="head-${cat.id}" aria-expanded="false" aria-controls="body-${cat.id}">
        <span class="sel-icon">${cat.icon}</span>
        <div class="sel-meta">
          <div class="sel-name">${catName(cat)}</div>
          <div class="sel-current" id="current-${cat.id}"></div>
        </div>
        <span class="sel-price-badge" id="price-${cat.id}"></span>
        <svg class="sel-arrow" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="selector-body" id="body-${cat.id}"></div>
    `;

    list.appendChild(row);
    row.addEventListener("click", e => e.stopPropagation());
    row.querySelector(".selector-header").addEventListener("click", e => {
      e.stopPropagation();
      toggleCategory(cat.id);
    });

    if (cat.multiSelect) {
      buildMulti(cat);
    } else {
      buildDropdown(cat);
    }
  });

  setOpenCategory(CATEGORIES[0]?.id, { scroll: false });
}

// ── Single-select dropdown ───────────────────────────────────
function buildDropdown(cat) {
  const body = document.getElementById(`body-${cat.id}`);
  if (!body) return;

  const menu = document.createElement("div");
  menu.className = "select-dropdown select-dropdown-panel";
  menu.id = `menu-${cat.id}`;

  // No deselect option — optional categories start empty and can be left unselected

  cat.items.forEach(item => {
    const opt = document.createElement("div");
    opt.className = "do-card";
    opt.dataset.id = item.id;
    const hasImg = !!item.image;
    const gallery = item.gallery || (hasImg ? [item.image] : []);
    opt.innerHTML = `
      <div class="do-photo">
        ${hasImg
          ? `<img src="/${item.image}" alt="${itemName(item)}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="do-ph">${cat.icon}</div>`
          : `<div class="do-ph">${cat.icon}</div>`}
        <div class="do-badge">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5.5 4,8 8.5,2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        ${gallery.length > 1 ? `<div class="do-gallery-count">${gallery.length} ✦</div>` : ''}
      </div>
      <div class="do-body">
        <div class="do-name">${itemName(item)}</div>
        <div class="do-desc">${itemDesc(item) || ''}</div>
        <div class="do-foot">
          <span class="do-price ${item.price === 0 ? 'free' : ''}">
            ${item.price === 0 ? t("included") : fmt(item.price)}
          </span>
        </div>
        <button class="do-select-btn" data-select="${item.id}" type="button">
          Select
        </button>
      </div>
    `;
    menu.appendChild(opt);
  });

  body.appendChild(menu);

  // Select button → directly apply selection and advance to next category
  menu.addEventListener("click", e => {
    const selBtn = e.target.closest(".do-select-btn");
    if (selBtn) {
      e.stopPropagation();
      const id = selBtn.dataset.select;
      state[cat.id].clear();
      if (id) state[cat.id].add(id);
      updateAll();
      openNextCategory(cat.id);
      return;
    }
    // Card body click → open detail modal
    const opt = e.target.closest(".do-card");
    if (!opt) return;
    const item = findItem(opt.dataset.id);
    if (item) openModal(cat, item);
  });

  refreshDropdown(cat);
}

function refreshDropdown(cat) {
  const menu  = document.getElementById(`menu-${cat.id}`);
  const current = document.getElementById(`current-${cat.id}`);
  const row = document.getElementById(`row-${cat.id}`);
  if (!menu || !current) return;

  const selId = [...state[cat.id]][0];
  const item  = selId ? findItem(selId) : null;

  if (item) {
    row?.classList.add("has-value");
    current.innerHTML = `<span>${itemName(item)}</span>`;
    const pb = document.getElementById(`price-${cat.id}`);
    if (pb) pb.textContent = item.price === 0 ? t("included") : fmt(item.price);
  } else {
    row?.classList.remove("has-value");
    current.innerHTML = `<span style="color:var(--muted)">—</span>`;
    const pb = document.getElementById(`price-${cat.id}`);
    if (pb) pb.textContent = '';
  }

  // Mark selected card + update button text
  menu.querySelectorAll(".do-card").forEach(opt => {
    const isSel = opt.dataset.id === (selId || "");
    opt.classList.toggle("selected", isSel);
    const btn = opt.querySelector(".do-select-btn");
    if (btn) {
      btn.textContent = isSel ? "✓ Selected" : "Select";
      btn.classList.toggle("do-select-btn--active", isSel);
    }
  });
}

// ── Multi-select checkboxes ──────────────────────────────────
function buildMulti(cat) {
  const body = document.getElementById(`body-${cat.id}`);
  if (!body) return;

  const wrap = document.createElement("div");
  wrap.className = "multi-options";
  wrap.id = `multi-${cat.id}`;

  cat.items.forEach(item => {
    const opt = document.createElement("div");
    opt.className = "mo-card";
    opt.id = `mo-${item.id}`;
    opt.dataset.id = item.id;
    const hasImg = !!item.image;
    opt.innerHTML = `
      <div class="mo-photo">
        ${hasImg
          ? `<img src="/${item.image}" alt="${itemName(item)}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="mo-ph">${cat.icon}</div>`
          : `<div class="mo-ph">${cat.icon}</div>`}
        <div class="mo-badge">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5.5 4,8 8.5,2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <div class="mo-body">
        <div class="mo-name">${itemName(item)}</div>
        <div class="mo-desc">${itemDesc(item) || ''}</div>
        <div class="mo-foot">
          <span class="mo-price ${item.price === 0 ? 'free' : ''}">
            ${item.price === 0 ? t("included") : fmt(item.price)}
          </span>
        </div>
      </div>
    `;

    // Card click → open modal (same pattern as single-select cards)
    opt.addEventListener("click", () => openModal(cat, item));

    wrap.appendChild(opt);
  });

  body.appendChild(wrap);
  refreshMulti(cat);
}

function refreshMulti(cat) {
  const current = document.getElementById(`current-${cat.id}`);
  const priceBadge = document.getElementById(`price-${cat.id}`);
  const row = document.getElementById(`row-${cat.id}`);
  const selected = cat.items.filter(item => state[cat.id].has(item.id));

  if (current) {
    if (selected.length) {
      // Show up to 2 names then "…+N more" if too many
      const names = selected.map(itemName);
      const preview = names.length <= 2
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
      current.innerHTML = `<span>${preview}</span>`;
    } else {
      current.innerHTML = `<span style="color:var(--muted)">—</span>`;
    }
  }

  // Show selected count in the price badge (matches single-select price display)
  if (priceBadge) {
    if (selected.length > 0) {
      const total = selected.reduce((s, i) => s + i.price, 0);
      priceBadge.textContent = total > 0 ? fmt(total) : `${selected.length} ×`;
    } else {
      priceBadge.textContent = '';
    }
  }

  // has-value class — same visual treatment as single-select
  row?.classList.toggle("has-value", selected.length > 0);

  cat.items.forEach(item => {
    const el = document.getElementById(`mo-${item.id}`);
    if (!el) return;
    el.classList.toggle("checked", state[cat.id].has(item.id));
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".selector-row.dropdown-open").forEach(r => {
    r.classList.remove("dropdown-open");
    r.querySelector(".selector-header")?.setAttribute("aria-expanded", "false");
  });
  openDropdown = null;
}

function toggleCategory(catId) {
  if (openDropdown === catId) return;
  setOpenCategory(catId);
}

function setOpenCategory(catId, opts = {}) {
  if (!catId) return;
  closeAllDropdowns();
  const row = document.getElementById(`row-${catId}`);
  row?.classList.add("dropdown-open");
  row?.querySelector(".selector-header")?.setAttribute("aria-expanded", "true");
  openDropdown = catId;
  if (opts.scroll !== false) {
    row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function openNextCategory(catId) {
  const idx = CATEGORIES.findIndex(cat => cat.id === catId);
  const next = CATEGORIES[idx + 1];
  if (next) setOpenCategory(next.id);
  else setOpenCategory(catId);
}

// ────────────────────────────────────────────────────────────
//  UPDATE ALL
// ────────────────────────────────────────────────────────────
function updateAll() {
  CATEGORIES.forEach(cat => {
    if (cat.multiSelect) refreshMulti(cat);
    else refreshDropdown(cat);
  });
  updateSummary();
  saveStateToUrl();
  window.Viewer?.sync(state);
}

// ────────────────────────────────────────────────────────────
//  SUMMARY
// ────────────────────────────────────────────────────────────
function updateSummary() {
  const sel   = getSelected();
  const total = sel.reduce((s, i) => s + i.price, 0);
  const hasAny = sel.length > 0;

  document.getElementById("summary-empty").style.display  = hasAny ? "none" : "";
  document.getElementById("summary-total").style.display  = hasAny ? ""     : "none";
  document.getElementById("btn-pdf").disabled   = true;
  document.getElementById("btn-share").disabled = !hasAny;

  const list = document.getElementById("summary-list");
  list.innerHTML = "";

  if (hasAny) {
    document.getElementById("total-val").textContent     = fmt(total);
    document.getElementById("total-vat-val").textContent = fmt(Math.round(total * 1.2));

    sel.forEach(item => {
      const cat = findCatOf(item.id);
      const li  = document.createElement("li");
      li.className = "summary-item";
      li.innerHTML = `
        <span class="s-dot" style="background:${cat?.color||'#888'}"></span>
        <span class="s-name">${itemName(item)}</span>
        ${item.price === 0
          ? `<span class="s-free">${t("included")}</span>`
          : `<span class="s-price">${fmtShort(item.price)}</span>`}
      `;
      list.appendChild(li);
    });
  }

  const missing = CATEGORIES.filter(c => c.required && !state[c.id].size);
  const valEl   = document.getElementById("summary-val");

  if (missing.length && hasAny) {
    valEl.innerHTML = `<span class="val-err">⚠ ${t("val_missing")} ${missing.map(c => catName(c)).join(", ")}</span>`;
  } else if (!hasAny) {
    valEl.innerHTML = "";
  } else {
    valEl.innerHTML = `<span class="val-ok">${t("val_ok")}</span>`;
    document.getElementById("btn-pdf").disabled = false;
  }
}

// ────────────────────────────────────────────────────────────
//  MODAL
// ────────────────────────────────────────────────────────────
function openModal(cat, item) {
  const hex = cat.color.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const specs  = itemSpecs(item);
  const rows   = Object.entries(specs).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  const isSel  = state[cat.id].has(item.id);
  const isInc  = isIncompat(item) && !isSel;
  const gallery = item.gallery || (item.image ? [item.image] : []);

  // Gallery HTML
  const galleryHtml = gallery.length
    ? `<div class="mg-wrap">
        <div class="mg-main-wrap">
          <img id="mg-main" src="/${gallery[0]}" alt="${itemName(item)}">
          ${gallery.length > 1 ? `
            <button class="mg-nav mg-prev" id="mg-prev">‹</button>
            <button class="mg-nav mg-next" id="mg-next">›</button>` : ''}
        </div>
        ${gallery.length > 1 ? `<div class="mg-thumbs" id="mg-thumbs">
          ${gallery.map((img, i) => `
            <div class="mg-thumb ${i === 0 ? 'active' : ''}" data-i="${i}"
                 style="background-image:url(/${img})"></div>`).join('')}
        </div>` : ''}
      </div>`
    : `<div class="mg-wrap mg-empty">
        <div class="mg-icon-ph">${cat.icon}</div>
      </div>`;

  document.getElementById("modal-body").innerHTML = `
    ${galleryHtml}
    <div class="modal-meta" style="--pr:${r};--pg:${g};--pb:${b}">
      <div class="modal-meta-cat">${catName(cat)}</div>
      <div class="modal-meta-name">${itemName(item)}</div>
      <div class="modal-meta-sku">${t("art")} ${item.sku}</div>
    </div>
    <div class="modal-content">
      <div class="modal-desc">${itemDesc(item)}</div>
      <div class="modal-price${item.price === 0 ? " free" : ""}">
        ${item.price === 0 ? t("included_long") : fmt(item.price)}
      </div>
      ${rows ? `<div class="specs-head">${t("specs_title")}</div>
        <table class="specs-table"><tbody>${rows}</tbody></table>` : ""}
      ${isInc
        ? `<button class="modal-action" disabled>${t("modal_incompat")}</button>`
        : `<button class="modal-action ${isSel ? "remove" : "add"}" id="modal-toggle">
             ${isSel ? t("modal_remove") : t("modal_add")}
           </button>`}
    </div>
  `;

  // Gallery interactions
  if (gallery.length > 1) {
    let cur = 0;
    const mainImg = document.getElementById("mg-main");
    const thumbs  = document.querySelectorAll(".mg-thumb");
    const go = i => {
      cur = (i + gallery.length) % gallery.length;
      mainImg.src = "/" + gallery[cur];
      thumbs.forEach((t, j) => t.classList.toggle("active", j === cur));
    };
    document.getElementById("mg-prev")?.addEventListener("click", () => go(cur - 1));
    document.getElementById("mg-next")?.addEventListener("click", () => go(cur + 1));
    document.getElementById("mg-thumbs")?.querySelectorAll(".mg-thumb").forEach((th, i) =>
      th.addEventListener("click", () => go(i)));
  }

  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("modal-toggle")?.addEventListener("click", () => {
    if (cat.multiSelect) {
      const sel = state[cat.id];
      sel.has(item.id) ? sel.delete(item.id) : sel.add(item.id);
    } else {
      state[cat.id].clear();
      if (!isSel) state[cat.id].add(item.id);
    }
    updateAll();
    closeModal();
  });
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ────────────────────────────────────────────────────────────
//  PDF
// ────────────────────────────────────────────────────────────
function generatePDF(withContacts) {
  const sel   = getSelected();
  const total = sel.reduce((s, i) => s + i.price, 0);
  const date  = new Date().toLocaleDateString("uk-UA", { day:"2-digit", month:"2-digit", year:"numeric" });
  const id    = "ORD-" + Date.now().toString().slice(-6);
  const g = id => document.getElementById(id)?.value || "";

  const cN = withContacts ? g("cf-name") : "";
  const cC = withContacts ? g("cf-company") : "";
  const cP = withContacts ? g("cf-phone") : "";
  const cE = withContacts ? g("cf-email") : "";

  const rows = sel.map(item => {
    const cat = findCatOf(item.id);
    return `<tr>
      <td>${cat ? catName(cat) : ""}</td>
      <td><strong>${itemName(item)}</strong></td>
      <td style="color:#64748b">${item.sku}</td>
      <td style="text-align:right;font-weight:700;color:#3b82f6">
        ${item.price === 0 ? t("pdf_included") : item.price.toLocaleString("uk-UA") + " " + COMPANY.currencyName}
      </td>
    </tr>`;
  }).join("");

  const contact = (cN||cC||cP||cE) ? `
    <div style="margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px">
      <strong>${t("pdf_client")}</strong><br>
      ${cN?cN+"<br>":""}${cC?cC+"<br>":""}${cP?t("pdf_tel")+" "+cP+"<br>":""}${cE?"Email: "+cE:""}
    </div>` : "";

  const html = `<!DOCTYPE html><html lang="${getLang()}"><head><meta charset="UTF-8"/>
  <title>${t("pdf_spec")} ${id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#1e293b}
    .pg{padding:40px;max-width:800px;margin:0 auto}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
    thead th{background:#f1f5f9;padding:9px 11px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:2px solid #e2e8f0}
    thead th:last-child{text-align:right}
    tbody td{padding:10px 11px;border-bottom:1px solid #f1f5f9}
    @media print{.pg{padding:22px}}
  </style></head><body><div class="pg">
  <div style="display:flex;justify-content:space-between;margin-bottom:26px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#3b82f6">${COMPANY.name}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${COMPANY.phone} · ${COMPANY.email}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b">
      <div style="font-size:17px;font-weight:700;color:#1e293b">${t("pdf_spec")}</div>
      <div>№ ${id}</div><div>${t("pdf_footer")} ${date}</div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #3b82f6;margin-bottom:20px"/>
  ${contact}
  <table>
    <thead><tr>
      <th>${t("pdf_col_cat")}</th><th>${t("pdf_col_name")}</th>
      <th>${t("pdf_col_sku")}</th><th style="text-align:right">${t("pdf_col_price")}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #e2e8f0">
        <td colspan="3" style="text-align:right;padding:10px 11px;color:#64748b;font-size:12px">${t("pdf_no_vat")}</td>
        <td style="text-align:right;padding:10px 11px;color:#3b82f6;font-weight:700;font-size:14px">${total.toLocaleString("uk-UA")} ${COMPANY.currencyName}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align:right;padding:5px 11px;color:#94a3b8;font-size:11px">${t("pdf_vat")}</td>
        <td style="text-align:right;padding:5px 11px;color:#94a3b8;font-size:11px">${(total*.2).toLocaleString("uk-UA")} ${COMPANY.currencyName}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align:right;padding:5px 11px;font-size:13px">${t("pdf_with_vat")}</td>
        <td style="text-align:right;padding:5px 11px;font-size:15px;color:#3b82f6;font-weight:800">${(total*1.2).toLocaleString("uk-UA")} ${COMPANY.currencyName}</td>
      </tr>
    </tfoot>
  </table>
  <p style="margin-top:30px;font-size:10px;color:#94a3b8;text-align:center">${COMPANY.name} · ${COMPANY.website}</p>
  </div></body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
  document.getElementById("contact-form").style.display = "none";
}

// ────────────────────────────────────────────────────────────
//  i18n
// ────────────────────────────────────────────────────────────
function applyI18n() {
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === getLang());
  });
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById("theme-icon");
  if (!icon) return;
  icon.innerHTML = getTheme() === "dark"
    ? `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`
    : `<circle cx="12" cy="12" r="5"/>
       <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
       <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
       <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
       <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
}

function bindLangTheme() {
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.addEventListener("click", () => {
      setLang(b.dataset.lang);
      buildSelectors();
      applyI18n();
      updateAll();
    });
  });
  document.getElementById("theme-btn")?.addEventListener("click", () => {
    toggleTheme();
    window.Viewer?.setTheme?.(getTheme());
    updateThemeIcon();
  });
}

// ────────────────────────────────────────────────────────────
//  GLOBAL EVENTS
// ────────────────────────────────────────────────────────────
function bindGlobal() {
  // Screenshot / photo capture — always downloads locally
  document.getElementById("btn-screenshot")?.addEventListener("click", () => {
    const dataUrl = window.Viewer?.captureScreenshot?.();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `scene_${Date.now()}.png`;
    a.click();
    showToast('Photo downloaded');
  });

  // Share
  document.getElementById("btn-share")?.addEventListener("click", () => {
    const url = location.href;
    navigator.clipboard?.writeText(url)
      .then(() => showToast(t("toast_copied")))
      .catch(() => fallbackCopy(url));
  });

  // PDF
  document.getElementById("btn-pdf")?.addEventListener("click", () => {
    const cf = document.getElementById("contact-form");
    cf.style.display = cf.style.display === "none" ? "block" : "none";
    if (cf.style.display === "block") cf.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.getElementById("btn-generate")?.addEventListener("click", () => generatePDF(true));
  document.getElementById("btn-skip")?.addEventListener("click",     () => generatePDF(false));

  // Reset
  document.getElementById("btn-reset")?.addEventListener("click", () => {
    CATEGORIES.forEach(c => state[c.id].clear());
    updateAll();
    document.getElementById("contact-form").style.display = "none";
  });

  // Modal close
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.getElementById("modal-overlay")?.addEventListener("click", e => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeAllDropdowns(); } });
}

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────
function getSelected() {
  return CATEGORIES.flatMap(c => c.items.filter(i => state[c.id].has(i.id)));
}
function findItem(id) {
  for (const c of CATEGORIES) { const f = c.items.find(i => i.id === id); if (f) return f; }
  return null;
}
function findCatOf(id) {
  return CATEGORIES.find(c => c.items.some(i => i.id === id)) || null;
}
function itemVisual(cat, item, className) {
  return `<div class="${className}"><span class="${className}-ph">${cat.icon}</span></div>`;
}
function isIncompat(item) {
  if (!item.incompatible?.length) return false;
  for (const cs of Object.values(state)) {
    for (const sid of cs) {
      if (item.incompatible.includes(sid)) return true;
      if (findItem(sid)?.incompatible?.includes(item.id)) return true;
    }
  }
  return false;
}
function fmt(p)       { return p.toLocaleString("uk-UA") + " " + COMPANY.currencyName; }
function fmtShort(p)  {
  if (!p) return "0 " + COMPANY.currencyName;
  return p >= 1000 ? (p/1000).toFixed(1).replace(".0","")+"к "+COMPANY.currencyName : p+" "+COMPANY.currencyName;
}

function showToast(msg, isErr = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = "toast"; }, 2800);
}
function fallbackCopy(text) {
  const ta = Object.assign(document.createElement("textarea"), { value: text });
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); showToast(t("toast_copied")); }
  catch (_) { showToast(t("toast_copy_hint"), true); }
  ta.remove();
}

document.addEventListener("DOMContentLoaded", init);
