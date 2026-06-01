// ============================================================
//  VIEWER.JS — Three.js 3D configurator
//  Same scene as admin panel (OrbitControls, no editing)
// ============================================================

window.Viewer = (function () {
  if (typeof THREE === 'undefined') {
    console.warn('[Viewer] Three.js not found');
    return { init() {}, sync() {}, setTheme() {} };
  }

  let renderer, scene, camera, orbitControls;
  let group;
  let sinkBody, bowlInner;

  const meshMap = {};
  const tweens  = {};

  const DEF_SINK = 0xdde3ec;
  const DEF_BOWL = 0xc8cfd9;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const canvas = document.getElementById('viewer-canvas');
    if (!canvas) return;

    // ── Scene — identical to admin scene-editor.js ─────────
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.055);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ── Camera — same as admin ─────────────────────────────
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 3.5, 7.5);
    camera.lookAt(0, 0, 0);

    // ── Lights — identical to admin scene-editor.js ────────
    scene.add(new THREE.AmbientLight(0x8099b0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4488ff, 0.35);
    fill.position.set(-4, 3, -4);
    scene.add(fill);

    // Group for product models (no rotation — world space = group-local space)
    group = new THREE.Group();
    scene.add(group);

    buildSink();
    buildFloor();
    buildAllMeshes();
    loadEnvScene();   // load admin-configured environment objects
    _setupOrbit(canvas);

    if (window.__CMS_SCENE__) applySceneSettings(window.__CMS_SCENE__);

    new ResizeObserver(resize).observe(canvas.parentElement);
    resize();
    animate();
  }

  // ── OrbitControls — same config as admin ──────────────────
  function _setupOrbit(canvas) {
    const OC = THREE.OrbitControls;
    if (!OC) {
      // Fallback: basic mouse-drag rotation if OrbitControls not loaded
      _fallbackOrbit(canvas);
      return;
    }
    orbitControls = new OC(camera, canvas);
    orbitControls.enableDamping  = true;
    orbitControls.dampingFactor  = 0.05;
    orbitControls.screenSpacePanning = true;
    orbitControls.minDistance    = 1;
    orbitControls.maxDistance    = 30;
    orbitControls.mouseButtons   = {
      LEFT:   THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN,
    };
  }

  // Simple fallback if OrbitControls CDN fails
  function _fallbackOrbit(canvas) {
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      group.rotation.y += (e.clientX - lastX) * 0.007;
      group.rotation.x = Math.max(-0.65, Math.min(0.65, group.rotation.x + (e.clientY - lastY) * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('wheel', e => {
      camera.position.z = Math.max(2, Math.min(14, camera.position.z + e.deltaY * 0.01));
      e.preventDefault();
    }, { passive: false });
  }

  function applySceneSettings(sc) {
    if (!sc) return;
    if (sc.background !== undefined) { scene.background.set(sc.background); if (scene.fog) scene.fog.color.set(sc.background); }
    if (sc.fog        !== undefined) scene.fog = sc.fog ? new THREE.FogExp2(scene.background.getHex(), sc.fogDensity ?? 0.055) : null;
    if (sc.fogDensity !== undefined && scene.fog) scene.fog.density = sc.fogDensity;
  }

  // ── Base sink (always visible) ────────────────────────────
  function buildSink() {
    const mat = (c, s = 100, spec = 0x666666) =>
      new THREE.MeshPhongMaterial({ color: c, shininess: s, specular: spec });

    sinkBody = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.2), mat(DEF_SINK, 120, 0x888888));
    sinkBody.castShadow = sinkBody.receiveShadow = true;
    group.add(sinkBody);

    bowlInner = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.44, 1.4), mat(DEF_BOWL, 160, 0xaaaaaa));
    bowlInner.position.set(0, -0.18, 0.04);
    bowlInner.receiveShadow = true;
    group.add(bowlInner);

    const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20), mat(0x2a3340, 40));
    drain.position.set(0, -0.36, 0.14);
    group.add(drain);

    const ov = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), mat(0x94a3b8, 60));
    ov.rotation.x = Math.PI / 2;
    ov.position.set(0, 0.06, -0.64);
    group.add(ov);

    const mp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.22), mat(0xb0b8c4, 80));
    mp.position.set(0, 0.19, -0.9);
    group.add(mp);

    group.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.82, 0.14, 2.22)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })
    ));
  }

  // ── Floor — grid + circular glow (same as admin) ──────────
  function buildFloor() {
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.7 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.22;
    group.add(glow);

    const grid = new THREE.GridHelper(14, 24, 0x1e3344, 0x121e2a);
    grid.position.y = -1.22;
    scene.add(grid);
  }

  // ── Product meshes ─────────────────────────────────────────
  // GLB model if available, otherwise a subtle wireframe placeholder
  // so the user gets visual feedback when selecting a product.
  function buildAllMeshes() {
    if (typeof CATEGORIES === 'undefined') return;
    CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        if (!item.c3d || item.c3d.role === 'finish') return;
        const mesh = item.c3d.model
          ? buildModelMesh(item.c3d, cat.color)
          : buildPlaceholderMesh(item.c3d, cat.color);
        if (!mesh) return;
        mesh.visible = false;
        mesh.scale.set(0.001, 0.001, 0.001);
        group.add(mesh);
        meshMap[item.id] = mesh;
        tweens[item.id]  = { target: 0, current: 0.001 };
      });
    });
  }

  // Minimal wireframe box — shown when a product has no GLB model
  function buildPlaceholderMesh(c3d, catColorHex) {
    const hex = parseInt((catColorHex || '#3b82f6').replace('#', ''), 16);
    const [w, h, d] = (c3d.size && c3d.size.every(v => v < 10)) ? c3d.size : [0.5, 0.2, 0.4];
    const [px, py, pz] = c3d.position || [0, 0, 0];
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.5 })
    ));
    mesh.position.set(px, py, pz);
    return mesh;
  }

  // Load GLB and apply fitModelToBox (same algorithm as admin _fitModelToSize)
  function buildModelMesh(c3d, catColorHex) {
    const Loader = THREE.GLTFLoader || window.GLTFLoader;
    if (typeof Loader === 'undefined') return null;

    const wrapper = new THREE.Group();
    const [px, py, pz] = c3d.position || [0, 0, 0];
    wrapper.position.set(px, py, pz);
    wrapper.userData.loading = true;

    new Loader().load(
      c3d.model,
      gltf => {
        const model = gltf.scene;
        model.traverse(obj => {
          if (!obj.isMesh) return;
          obj.castShadow = obj.receiveShadow = true;
          if (obj.material) obj.material.needsUpdate = true;
        });
        fitModelToBox(model, c3d.size || [1, 1, 1]);
        applyRotation(model, c3d.rotation);
        wrapper.add(model);
        wrapper.userData.loading = false;
      },
      undefined,
      err => {
        console.warn('[Viewer] Could not load model', c3d.model, err);
        wrapper.userData.loading = false;
      }
    );
    return wrapper;
  }

  // Scales + centers model to fit inside targetSize box.
  // Identical semantics to admin's _fitModelToSize.
  function fitModelToBox(model, targetSize) {
    const box    = new THREE.Box3().setFromObject(model);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const [tw, th, td] = targetSize;
    const scale = Math.min(
      size.x > 0 ? tw / size.x : 1,
      size.y > 0 ? th / size.y : 1,
      size.z > 0 ? td / size.z : 1
    );
    model.scale.multiplyScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }

  function applyRotation(model, rotation) {
    if (!rotation) return;
    const [rx, ry, rz] = rotation;
    model.rotation.set(rx || 0, ry || 0, rz || 0);
  }

  // ── Sync with app state ───────────────────────────────────
  function sync(appState) {
    if (!scene) return;
    let anyFinish = false;

    if (typeof CATEGORIES !== 'undefined') {
      CATEGORIES.forEach(cat => {
        cat.items.forEach(item => {
          if (!item.c3d) return;
          const on = appState[cat.id]?.has(item.id) || false;

          if (item.c3d.role === 'finish') {
            if (on) { applyFinish(item.c3d.sinkColor, item.c3d.bowlColor); anyFinish = true; }
            return;
          }

          const mesh = meshMap[item.id];
          if (!mesh) return;
          if (on && !mesh.visible) {
            mesh.visible = true;
            tweens[item.id] = { target: 1, current: tweens[item.id]?.current || 0.001 };
          } else if (!on && mesh.visible) {
            tweens[item.id] = { target: 0, current: tweens[item.id]?.current || 1 };
          }
        });
      });
    }
    if (!anyFinish) applyFinish(DEF_SINK, DEF_BOWL);
  }

  function applyFinish(sc, bc) {
    if (sinkBody?.material)  sinkBody.material.color.setHex(sc || DEF_SINK);
    if (bowlInner?.material) bowlInner.material.color.setHex(bc || DEF_BOWL);
  }

  // ── Load env scene (configured in admin 3D Space) ─────────
  function loadEnvScene() {
    const Loader = THREE.GLTFLoader || window.GLTFLoader;
    if (!Loader) return;
    const canvas = document.getElementById('viewer-canvas');
    // Show loading overlay while env objects load
    let loadOverlay = null;
    if (canvas?.parentElement) {
      loadOverlay = document.createElement('div');
      loadOverlay.id = 'viewer-env-loading';
      loadOverlay.style.cssText = [
        'position:absolute', 'inset:0',
        'background:rgba(10,14,23,1)',   // fully opaque — nothing shows through
        'display:flex', 'align-items:center', 'justify-content:center',
        'flex-direction:column', 'gap:12px',
        'z-index:999',                   // above every other layer
        'pointer-events:none',
      ].join(';');
      loadOverlay.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5"
             style="animation:spin 1s linear infinite">
          <path d="M21 12a9 9 0 1 1-9-9"/>
        </svg>
        <span style="font-size:12px;color:rgba(255,255,255,.35);letter-spacing:.06em">Loading scene…</span>`;
      // Inject the spin keyframe once
      if (!document.getElementById('viewer-spin-style')) {
        const st = document.createElement('style');
        st.id = 'viewer-spin-style';
        st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(st);
      }
      canvas.parentElement.style.position = 'relative';
      canvas.parentElement.appendChild(loadOverlay);
    }

    fetch('/api/env')
      .then(r => r.json())
      .then(data => {
        const objects = (data?.objects || []).filter(o => o.url);
        if (!objects.length) { loadOverlay?.remove(); return; }

        let loaded = 0;
        objects.forEach(obj => {
          const wrapper = new THREE.Group();
          const t = obj.transform;
          if (t?.position) wrapper.position.set(t.position.x || 0, t.position.y || 0, t.position.z || 0);
          if (t?.rotation) wrapper.rotation.set(t.rotation.x || 0, t.rotation.y || 0, t.rotation.z || 0);
          if (t?.scale)    wrapper.scale.set(t.scale.x || 1, t.scale.y || 1, t.scale.z || 1);
          // Keep wrapper invisible until model is loaded
          wrapper.visible = false;
          group.add(wrapper);

          new Loader().load('/' + obj.url,
            gltf => {
              const model = gltf.scene;
              model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
              wrapper.add(model);
              wrapper.visible = true;
              loaded++;
              if (loaded >= objects.length) loadOverlay?.remove();
            },
            undefined,
            () => { loaded++; wrapper.visible = true; if (loaded >= objects.length) loadOverlay?.remove(); }
          );
        });
      })
      .catch(() => { loadOverlay?.remove(); });
  }

  // ── Screenshot / photo capture ────────────────────────────
  function captureScreenshot() {
    if (!renderer) return null;
    // Force render one more frame so screenshot is up-to-date
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  // ── Animate ───────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    // Scale tweens for show/hide
    Object.keys(tweens).forEach(id => {
      const t = tweens[id];
      const m = meshMap[id];
      if (!m) return;
      t.current += (t.target - t.current) * 0.13;
      const s = Math.max(0.001, t.current);
      m.scale.set(s, s, s);
      if (Math.abs(t.current - t.target) < 0.005) {
        t.current = t.target;
        if (t.target === 0) { m.visible = false; m.scale.set(0.001, 0.001, 0.001); }
        delete tweens[id];
      }
    });

    if (orbitControls) orbitControls.update();
    renderer.render(scene, camera);
  }

  // ── Resize ────────────────────────────────────────────────
  function resize() {
    const wrap = document.getElementById('viewer-canvas')?.parentElement;
    if (!wrap || !renderer) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }

  // ── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    if (!scene) return;
    if (window.__CMS_SCENE__?.background) return;
    const bg = theme === 'dark' ? 0x060a10 : 0x0a0e17;
    scene.background.setHex(bg);
    if (scene.fog) scene.fog.color.setHex(bg);
  }

  return { init, sync, setTheme, captureScreenshot };
})();
