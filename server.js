'use strict';

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const vm      = require('vm');
const stream  = require('stream');

const PORT      = process.env.PORT || 3000;
const ROOT      = __dirname;
const DATA_DIR    = path.join(ROOT, 'data');
const CMS_FILE    = path.join(DATA_DIR, 'cms.json');
const SCENE_FILE  = path.join(DATA_DIR, 'scene.json');    // legacy single-scene
const SCENES_FILE = path.join(DATA_DIR, 'scenes.json');   // Phase 5: multi-scene
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');   // Phase 1: asset library
const ENV_FILE    = path.join(DATA_DIR, 'env.json');       // Global scene environment objects
const THUMBS_DIR  = path.join(ROOT, 'images', 'thumbs');
const MIME      = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff' };

// ── Bootstrap ──────────────────────────────────────────────
[DATA_DIR, path.join(ROOT, 'models'), path.join(ROOT, 'images'), THUMBS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Assets helpers (Phase 1) ──────────────────────────────
function readAssets() {
  if (!fs.existsSync(ASSETS_FILE)) return { assets: {} };
  try { return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8')); }
  catch { return { assets: {} }; }
}
function writeAssets(d) { fs.writeFileSync(ASSETS_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// ── Scenes helpers (Phase 5) ─────────────────────────────
function readScenes() {
  if (!fs.existsSync(SCENES_FILE)) return { scenes: {} };
  try { return JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8')); }
  catch { return { scenes: {} }; }
}
function writeScenes(d) { fs.writeFileSync(SCENES_FILE, JSON.stringify(d, null, 2), 'utf8'); }

function makeScene(overrides = {}) {
  return {
    id:          overrides.id || 'scene_' + crypto.randomBytes(4).toString('hex'),
    name:        overrides.name || 'Untitled Scene',
    productId:   overrides.productId || null,
    objects:     overrides.objects || [],
    camera:      overrides.camera || { position: { x:5, y:4, z:8 }, target: { x:0, y:0, z:0 }, fov: 50 },
    environment: overrides.environment || { background: '#0a0e17', ambient: 0.9, sun: 1.4, fog: true, fogDensity: 0.04 },
    presets:     overrides.presets || [],
    versions:    overrides.versions || [],
    createdAt:   overrides.createdAt || new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
}

// ── CMS helpers ────────────────────────────────────────────
function readCMS() {
  if (!fs.existsSync(CMS_FILE)) return { items: {}, company: {}, draft: null };
  try { return JSON.parse(fs.readFileSync(CMS_FILE, 'utf8')); }
  catch { return { items: {}, company: {}, draft: null }; }
}
function writeCMS(data) {
  fs.writeFileSync(CMS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Scene helpers ──────────────────────────────────────────
function readScene() {
  if (!fs.existsSync(SCENE_FILE)) return { models: {} };
  try { return JSON.parse(fs.readFileSync(SCENE_FILE, 'utf8')); }
  catch { return { models: {} }; }
}
function writeScene(data) {
  fs.writeFileSync(SCENE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Environment helpers ────────────────────────────────────
function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return { objects: [] };
  try { return JSON.parse(fs.readFileSync(ENV_FILE, 'utf8')); }
  catch { return { objects: [] }; }
}
function writeEnv(d) { fs.writeFileSync(ENV_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// ── Auth ───────────────────────────────────────────────────
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const sessions   = new Set();
function isAuthed(req) {
  const t = req.headers['x-admin-token'];
  return t && sessions.has(t);
}

// ── Response helpers ───────────────────────────────────────
function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const stat = fs.statSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

// ── Body parsing ───────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Safe JSON parse — returns null on error instead of throwing
function parseBody(buf) {
  try { return JSON.parse(buf.toString()); }
  catch { return null; }
}

// ── Multipart file upload parser ───────────────────────────
function parseMultipart(req, destDir) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const match = ct.match(/boundary=(.+)$/);
    if (!match) return reject(new Error('No boundary'));
    const boundary = '--' + match[1];
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const parts = splitBuffer(body, Buffer.from('\r\n' + boundary));
      const fields = {};
      let fileInfo = null;

      parts.forEach((part, idx) => {
        if (idx === 0) {
          const stripped = part.indexOf('\r\n' + boundary + '--') > -1
            ? part.slice(boundary.length + 2)
            : part.slice(boundary.length + 2);
          // use stripped below
        }
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const headerStr = part.slice(0, headerEnd).toString();
        const dataStart = headerEnd + 4;
        const data      = part.slice(dataStart);

        const cdMatch    = headerStr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
        const fnMatch    = headerStr.match(/filename="([^"]+)"/i);
        const fieldName  = cdMatch?.[1];
        if (!fieldName) return;

        if (fnMatch) {
          fileInfo = { originalName: fnMatch[1], fieldName, data };
        } else {
          fields[fieldName] = data.toString().replace(/\r\n$/, '');
        }
      });

      if (!fileInfo) return reject(new Error('No file in upload'));
      const filename = fields['filename'] || `${Date.now()}-${fileInfo.originalName}`;
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\./, '_');
      const filePath = path.join(destDir, safeName);
      // Strip trailing \r\n that boundary adds
      const fileData = fileInfo.data.slice(-2).equals(Buffer.from('\r\n'))
        ? fileInfo.data.slice(0, -2) : fileInfo.data;
      fs.writeFile(filePath, fileData, err => {
        if (err) reject(err);
        else resolve({ filename: safeName, size: fileData.length });
      });
    });
  });
}

function splitBuffer(buf, delimiter) {
  const parts = []; let prev = 0;
  while (true) {
    const idx = buf.indexOf(delimiter, prev);
    if (idx === -1) { parts.push(buf.slice(prev)); break; }
    parts.push(buf.slice(prev, idx));
    prev = idx + delimiter.length;
  }
  return parts;
}

// ── Routing ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = new URL(req.url, `http://localhost`);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const query    = Object.fromEntries(parsed.searchParams);
  const method   = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── CMS script (injected before data.js on main site) ──
  if (method === 'GET' && pathname === '/api/cms.js') {
    const cms     = readCMS();
    const preview = query.preview === '1';
    const payload = {
      items:   { ...cms.items,   ...(preview ? (cms.draft?.items   || {}) : {}) },
      company: { ...cms.company, ...(preview ? (cms.draft?.company || {}) : {}) },
    };
    const body = `window.__CMS__=${JSON.stringify(payload)};`;
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  // ── Preview: index.html with draft data ────────────────
  if (method === 'GET' && pathname === '/preview') {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    html = html.replace('src="/api/cms.js"', 'src="/api/cms.js?preview=1"');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }

  // ── Admin panel ────────────────────────────────────────
  if (method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
    return sendFile(res, path.join(ROOT, 'admin', 'index.html'));
  }
  if (method === 'GET' && pathname.startsWith('/admin/')) {
    return sendFile(res, path.join(ROOT, 'admin', pathname.slice(7)));
  }

  // ── API ────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return handleAPI(req, res, pathname, method, query);
  }

  // ── Static files ───────────────────────────────────────
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname.slice(1));
  // strip query strings from path
  filePath = filePath.split('?')[0];
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath);
  }
  res.writeHead(404); res.end('Not found');
});

async function handleAPI(req, res, pathname, method, query) {
  // Public endpoint
  if (method === 'GET' && pathname === '/api/cms') {
    return json(res, 200, readCMS());
  }

  // Auth: login
  if (method === 'POST' && pathname === '/api/auth/login') {
    try {
      const body = await readBody(req);
      const data = parseBody(body);
      if (data.password !== ADMIN_PASS) return json(res, 401, { error: 'Wrong password' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      return json(res, 200, { token });
    } catch { return json(res, 400, { error: 'Invalid request body' }); }
  }

  // Auth: logout
  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (isAuthed(req)) sessions.delete(req.headers['x-admin-token']);
    return json(res, 200, { ok: true });
  }

  // Public read-only endpoints (no auth needed)
  if (method === 'GET' && pathname === '/api/env') return json(res, 200, readEnv());

  // Protected: require auth
  if (!isAuthed(req)) return json(res, 401, { error: 'Unauthorized' });

  // Source data (parses data.js)
  if (method === 'GET' && pathname === '/api/source-data') {
    const raw     = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
    const code    = raw.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');
    const sandbox = {};
    try {
      vm.runInNewContext(code, sandbox);
      return json(res, 200, { categories: sandbox.CATEGORIES, company: sandbox.COMPANY });
    } catch (e) {
      return json(res, 500, { error: 'Failed to parse data.js', detail: e.message });
    }
  }

  // Save draft item
  const itemMatch = pathname.match(/^\/api\/cms\/item\/(.+)$/);
  if (method === 'POST' && itemMatch) {
    const id   = itemMatch[1];
    const body = await readBody(req);
    const data = parseBody(body);
    if (!data) return json(res, 400, { error: 'Invalid JSON body' });
    const cms = readCMS();
    if (!cms.draft)       cms.draft = { items: {}, company: null };
    if (!cms.draft.items) cms.draft.items = {};
    cms.draft.items[id] = data;
    writeCMS(cms);
    return json(res, 200, { ok: true });
  }

  // Save draft company
  if (method === 'POST' && pathname === '/api/cms/company') {
    const body = await readBody(req);
    const data = parseBody(body);
    if (!data) return json(res, 400, { error: 'Invalid JSON body' });
    const cms = readCMS();
    if (!cms.draft) cms.draft = { items: {}, company: null };
    cms.draft.company = data;
    writeCMS(cms);
    return json(res, 200, { ok: true });
  }

  // Publish
  if (method === 'POST' && pathname === '/api/cms/publish') {
    const cms = readCMS();
    if (cms.draft?.items)   Object.assign(cms.items, cms.draft.items);
    if (cms.draft?.company) cms.company = cms.draft.company;
    cms.draft = null;
    writeCMS(cms);
    return json(res, 200, { ok: true });
  }

  // Discard
  if (method === 'POST' && pathname === '/api/cms/discard') {
    const cms = readCMS();
    cms.draft = null;
    writeCMS(cms);
    return json(res, 200, { ok: true });
  }

  // Upload model
  if (method === 'POST' && pathname === '/api/upload/model') {
    try {
      const result = await parseMultipart(req, path.join(ROOT, 'models'));
      return json(res, 200, { ok: true, url: `models/${result.filename}` });
    } catch (e) { return json(res, 500, { error: e.message }); }
  }

  // Upload image
  if (method === 'POST' && pathname === '/api/upload/image') {
    try {
      const result = await parseMultipart(req, path.join(ROOT, 'images'));
      return json(res, 200, { ok: true, url: `images/${result.filename}` });
    } catch (e) { return json(res, 500, { error: e.message }); }
  }

  // ── Scene: GET ────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/scene') {
    return json(res, 200, readScene());
  }
  if (method === 'POST' && pathname === '/api/scene') {
    const body = await readBody(req);
    const data = parseBody(body);
    if (data) writeScene(data);
    return json(res, 200, { ok: true });
  }
  const sceneModelMatch = pathname.match(/^\/api\/scene\/(.+)$/);
  if (method === 'GET' && sceneModelMatch) {
    const sc = readScene();
    const m  = sc.models?.[sceneModelMatch[1]];
    if (!m) return json(res, 404, { error: 'Model not found' });
    return json(res, 200, m);
  }

  // ── Environment objects ──────────────────────────────────
  if (method === 'GET'  && pathname === '/api/env') return json(res, 200, readEnv());
  if (method === 'POST' && pathname === '/api/env') {
    const body = await readBody(req);
    const data = parseBody(body);
    if (data) writeEnv(data);
    return json(res, 200, { ok: true });
  }

  // List files
  const filesMatch = pathname.match(/^\/api\/files\/(models|images)$/);
  if (method === 'GET' && filesMatch) {
    const dir = path.join(ROOT, filesMatch[1]);
    if (!fs.existsSync(dir)) return json(res, 200, []);
    const files = fs.readdirSync(dir)
      .filter(f => !f.startsWith('.') && !f.endsWith('.md'))
      .map(f => {
        try {
          const s = fs.statSync(path.join(dir, f));
          return { name: f, url: `${filesMatch[1]}/${f}`, size: s.size };
        } catch { return null; }
      }).filter(Boolean);
    return json(res, 200, files);
  }

  // Delete file
  const fileDelMatch = pathname.match(/^\/api\/files\/(images|models)\/(.+)$/);
  if (method === 'DELETE' && fileDelMatch) {
    const [, type, filename] = fileDelMatch;
    const safeFile = path.basename(filename); // prevent path traversal
    const filePath = path.join(ROOT, type, safeFile);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return json(res, 200, { ok: true });
    } catch (e) { return json(res, 500, { error: e.message }); }
  }

  // ── Phase 1: Asset Library ────────────────────────────────
  if (method === 'GET' && pathname === '/api/assets') {
    return json(res, 200, readAssets());
  }
  if (method === 'POST' && pathname === '/api/assets') {
    const body = await readBody(req);
    const d = readAssets();
    const asset = parseBody(body);
    if (!asset.id) asset.id = 'asset_' + crypto.randomBytes(4).toString('hex');
    asset.createdAt = new Date().toISOString();
    d.assets[asset.id] = asset;
    writeAssets(d);
    return json(res, 200, { ok: true, asset });
  }
  const assetIdMatch = pathname.match(/^\/api\/assets\/(.+)$/);
  if (assetIdMatch) {
    const id = assetIdMatch[1];
    const d  = readAssets();
    if (method === 'GET')    { const a = d.assets[id]; return a ? json(res, 200, a) : json(res, 404, { error: 'Not found' }); }
    if (method === 'PUT')    { const body = await readBody(req); d.assets[id] = { ...d.assets[id], ...parseBody(body), updatedAt: new Date().toISOString() }; writeAssets(d); return json(res, 200, { ok: true }); }
    if (method === 'DELETE') { delete d.assets[id]; writeAssets(d); return json(res, 200, { ok: true }); }
  }

  // ── Phase 5: Multi-Scene CRUD ─────────────────────────────
  if (method === 'GET' && pathname === '/api/scenes') {
    const d = readScenes();
    // Return list without bulky versions array
    const list = Object.values(d.scenes).map(s => ({ id: s.id, name: s.name, productId: s.productId, objectCount: s.objects?.length || 0, updatedAt: s.updatedAt }));
    return json(res, 200, { scenes: list });
  }
  if (method === 'POST' && pathname === '/api/scenes') {
    const body = await readBody(req);
    const d    = readScenes();
    const s    = makeScene(parseBody(body));
    d.scenes[s.id] = s;
    writeScenes(d);
    return json(res, 200, { ok: true, scene: s });
  }

  const sceneFullMatch = pathname.match(/^\/api\/scenes\/([^/]+)$/);
  if (sceneFullMatch) {
    const sid = sceneFullMatch[1];
    const d   = readScenes();
    if (method === 'GET') {
      const s = d.scenes[sid]; return s ? json(res, 200, s) : json(res, 404, { error: 'Scene not found' });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const upd  = parseBody(body);
      d.scenes[sid] = { ...d.scenes[sid], ...upd, updatedAt: new Date().toISOString() };
      writeScenes(d); return json(res, 200, { ok: true });
    }
    if (method === 'DELETE') { delete d.scenes[sid]; writeScenes(d); return json(res, 200, { ok: true }); }
  }

  // ── Phase 7: Scene Presets ────────────────────────────────
  const presetMatch = pathname.match(/^\/api\/scenes\/([^/]+)\/preset$/);
  if (presetMatch && method === 'POST') {
    const body = await readBody(req);
    const d    = readScenes();
    const s    = d.scenes[presetMatch[1]];
    if (!s) return json(res, 404, { error: 'Scene not found' });
    const preset = { ...parseBody(body), id: crypto.randomBytes(3).toString('hex'), createdAt: new Date().toISOString() };
    s.presets.push(preset); s.updatedAt = new Date().toISOString();
    writeScenes(d); return json(res, 200, { ok: true, preset });
  }
  const presetDelMatch = pathname.match(/^\/api\/scenes\/([^/]+)\/preset\/([^/]+)$/);
  if (presetDelMatch && method === 'DELETE') {
    const d = readScenes(); const s = d.scenes[presetDelMatch[1]];
    if (!s) return json(res, 404, { error: 'Scene not found' });
    s.presets = s.presets.filter(p => p.id !== presetDelMatch[2]);
    writeScenes(d); return json(res, 200, { ok: true });
  }

  // ── Phase 8: Scene Versioning ─────────────────────────────
  const versionMatch = pathname.match(/^\/api\/scenes\/([^/]+)\/version$/);
  if (versionMatch && method === 'POST') {
    const body = await readBody(req);
    const d = readScenes(); const s = d.scenes[versionMatch[1]];
    if (!s) return json(res, 404, { error: 'Scene not found' });
    const ver = {
      index: s.versions.length,
      label: parseBody(body).label || `Version ${s.versions.length + 1}`,
      snapshot: JSON.stringify({ objects: s.objects, camera: s.camera, environment: s.environment }),
      createdAt: new Date().toISOString(),
    };
    s.versions.unshift(ver); // newest first
    if (s.versions.length > 20) s.versions.length = 20; // keep last 20
    s.updatedAt = new Date().toISOString();
    writeScenes(d); return json(res, 200, { ok: true, version: ver });
  }
  const restoreMatch = pathname.match(/^\/api\/scenes\/([^/]+)\/restore\/(\d+)$/);
  if (restoreMatch && method === 'POST') {
    const d = readScenes(); const s = d.scenes[restoreMatch[1]];
    if (!s) return json(res, 404, { error: 'Scene not found' });
    const ver = s.versions[parseInt(restoreMatch[2])];
    if (!ver) return json(res, 404, { error: 'Version not found' });
    const snap = JSON.parse(ver.snapshot);
    Object.assign(s, snap); s.updatedAt = new Date().toISOString();
    writeScenes(d); return json(res, 200, { ok: true });
  }

  // ── Phase 6 & 10: Product-Scene linking ───────────────────
  const prodSceneMatch = pathname.match(/^\/api\/products\/([^/]+)\/scene$/);
  if (prodSceneMatch) {
    const pid = prodSceneMatch[1];
    const cms = readCMS();
    if (method === 'GET') {
      const sceneId = cms.productScenes?.[pid];
      if (!sceneId) return json(res, 200, { sceneId: null });
      const d = readScenes(); const s = d.scenes[sceneId];
      return json(res, 200, { sceneId, scene: s || null });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const { sceneId } = parseBody(body);
      if (!cms.productScenes) cms.productScenes = {};
      cms.productScenes[pid] = sceneId;
      writeCMS(cms); return json(res, 200, { ok: true });
    }
  }

  // ── Phase 11: Public Website API (no auth required) ───────
  const pubProdMatch = pathname.match(/^\/api\/pub\/product\/(.+)$/);
  if (pubProdMatch && method === 'GET') {
    const pid = pubProdMatch[1];
    const cms = readCMS();
    const sceneId = cms.productScenes?.[pid] || null;
    if (!sceneId) return json(res, 200, { productId: pid, sceneId: null });
    const d = readScenes();
    const s = d.scenes[sceneId];
    return json(res, 200, { productId: pid, sceneId, scene: s || null });
  }
  const pubSceneMatch = pathname.match(/^\/api\/pub\/scene\/(.+)$/);
  if (pubSceneMatch && method === 'GET') {
    const d = readScenes();
    const s = d.scenes[pubSceneMatch[1]];
    if (!s) return json(res, 404, { error: 'Scene not found' });
    // Strip versions to keep response small
    const { versions, ...publicScene } = s;
    return json(res, 200, publicScene);
  }
  // List all scenes for a product (website integration)
  if (method === 'GET' && pathname === '/api/pub/scenes') {
    const d = readScenes();
    const list = Object.values(d.scenes).map(({ id, name, productId, objects, camera, environment }) =>
      ({ id, name, productId, objects, camera, environment }));
    return json(res, 200, { scenes: list });
  }

  json(res, 404, { error: 'Not found' });
}

// ── Start ──────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  Calculator running at   http://localhost:${PORT}`);
  console.log(`  Admin panel:            http://localhost:${PORT}/admin/`);
  console.log(`  Admin password:         ${ADMIN_PASS}`);
  console.log(`  (set ADMIN_PASS env var to change)\n`);
});
