'use strict';

// ── Admin 3D Scene Editor ──────────────────────────────────────
// Models live directly in the world scene (no parent group rotation).
// viewer.js's group also starts at rotation=(0,0,0) so c3d.position
// values are in the same coordinate space in both admin and public.
window.SceneEditor = (function () {

  let renderer, scene, camera, canvas;
  let orbitControls, transformControls;
  let animId = null;
  let raycaster;

  const models    = new Map();
  let selectedId  = null;
  let transformMode = 'translate';

  let gridHelper, axesHelper, originMarker;

  const undoStack = [];
  const redoStack = [];

  let _onSelect    = null;
  let _onTransform = null;
  let _onDeselect  = null;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt4   = v => +v.toFixed(4);

  // ──────────────────────────────────────────────────────────
  //  INIT — matches viewer.js atmosphere; no group rotation
  // ──────────────────────────────────────────────────────────
  function init(canvasEl) {
    if (!canvasEl || typeof THREE === 'undefined') return;
    if (renderer) destroy();
    canvas = canvasEl;

    const w = canvas.offsetWidth  || 800;
    const h = canvas.offsetHeight || 600;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.055);

    // Camera: same FOV + start position as viewer.js
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 3.5, 7.5);
    camera.lookAt(0, 0, 0);

    raycaster = new THREE.Raycaster();

    _setupOrbit();
    _setupTransform();
    _setupHelpers();
    _setupLights();

    new ResizeObserver(() => {
      if (!canvas || !renderer) return;
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }).observe(canvas);

    _animate();
  }

  function _setupOrbit() {
    const OC = THREE.OrbitControls;
    if (!OC) return;
    orbitControls = new OC(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = true;
    orbitControls.panSpeed = 0.8;
    orbitControls.minDistance = 0.2;
    orbitControls.maxDistance = 50;
    orbitControls.mouseButtons = {
      LEFT:   THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN,
    };
  }

  function _setupTransform() {
    const TC = THREE.TransformControls;
    if (!TC) return;
    transformControls = new TC(camera, renderer.domElement);
    transformControls.setMode(transformMode);
    transformControls.setSpace('world');
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', e => {
      if (orbitControls) orbitControls.enabled = !e.value;
      if (!e.value && selectedId) {
        pushUndoState();
        if (_onTransform) _onTransform(selectedId, _readTransform(selectedId));
      }
    });

    transformControls.addEventListener('objectChange', () => {
      if (selectedId && _onTransform) {
        _onTransform(selectedId, _readTransform(selectedId));
      }
    });
  }

  // ── Helpers — grid + sink reference guide ─────────────────
  function _setupHelpers() {
    // Grid matching viewer.js colours and position
    gridHelper = new THREE.GridHelper(14, 24, 0x1e3344, 0x121e2a);
    gridHelper.position.y = -1.22;
    scene.add(gridHelper);

    // Circular glow — same as viewer.js buildFloor()
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.7 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.22;
    scene.add(glow);

    // Wireframe sink reference — helps with product positioning
    // Dimensions match viewer.js buildSink() exactly
    const sinkRef = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.8, 0.12, 2.2)),
      new THREE.LineBasicMaterial({ color: 0x3a5470, transparent: true, opacity: 0.35 })
    );
    scene.add(sinkRef); // sinkBody is at y=0 in viewer.js

    const bowlRef = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 0.44, 1.4)),
      new THREE.LineBasicMaterial({ color: 0x3a5470, transparent: true, opacity: 0.22 })
    );
    bowlRef.position.set(0, -0.18, 0.04); // matches viewer.js bowlInner
    scene.add(bowlRef);

    axesHelper = new THREE.AxesHelper(1.5);
    scene.add(axesHelper);

    originMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true })
    );
    scene.add(originMarker);
  }

  // ── Lights — exact match to viewer.js ─────────────────────
  function _setupLights() {
    scene.add(new THREE.AmbientLight(0x8099b0, 0.9));

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near   = 0.1;
    sun.shadow.camera.far    = 100;
    sun.shadow.camera.left   = sun.shadow.camera.bottom = -10;
    sun.shadow.camera.right  = sun.shadow.camera.top    =  10;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x4488ff, 0.35);
    fill.position.set(-4, 3, -4);
    scene.add(fill);
  }

  function _animate() {
    animId = requestAnimationFrame(_animate);
    if (orbitControls) orbitControls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  // ──────────────────────────────────────────────────────────
  //  MODEL FIT — identical to viewer.js fitModelToBox()
  //  Call BEFORE adding model to scene so Box3 gives model-local
  //  bounds (no parent transform skew).
  // ──────────────────────────────────────────────────────────
  function _fitModelToSize(model, targetSize) {
    const [tw, th, td] = Array.isArray(targetSize) ? targetSize : [1, 1, 1];

    let nat = model.userData.naturalBox;
    if (!nat) {
      const savedScale = model.scale.clone();
      const savedPos   = model.position.clone();
      model.scale.set(1, 1, 1);
      model.position.set(0, 0, 0);
      const box = new THREE.Box3().setFromObject(model);
      nat = {
        size:   box.getSize(new THREE.Vector3()),
        center: box.getCenter(new THREE.Vector3()),
      };
      model.userData.naturalBox = nat;
      model.scale.copy(savedScale);
      model.position.copy(savedPos);
    }

    const { size, center } = nat;
    const scale = Math.min(
      size.x > 0 ? tw / size.x : 1,
      size.y > 0 ? th / size.y : 1,
      size.z > 0 ? td / size.z : 1
    );

    model.scale.setScalar(scale);
    model.userData.fitOffset = {
      x: -center.x * scale,
      y: -center.y * scale,
      z: -center.z * scale,
    };
    model.position.set(
      model.userData.fitOffset.x,
      model.userData.fitOffset.y,
      model.userData.fitOffset.z
    );
  }

  function reFitModel(id, newSize, posRot) {
    const entry = models.get(id);
    if (!entry || !entry.hasGLB) return;
    _fitModelToSize(entry.mesh, newSize);
    const off = entry.mesh.userData.fitOffset || { x: 0, y: 0, z: 0 };
    const pos = posRot?.position || { x: 0, y: 0, z: 0 };
    entry.mesh.position.set(off.x + pos.x, off.y + pos.y, off.z + pos.z);
    if (posRot?.rotation) {
      entry.mesh.rotation.set(
        posRot.rotation.x ?? 0,
        posRot.rotation.y ?? 0,
        posRot.rotation.z ?? 0
      );
    }
  }

  // ──────────────────────────────────────────────────────────
  //  MODEL MANAGEMENT
  // ──────────────────────────────────────────────────────────
  async function loadModel(id, url, opts = {}) {
    if (models.has(id)) _removeFromScene(id);

    const vis      = opts.visible !== false;
    const catColor = opts.catColor || 0x3b82f6;

    const Loader = THREE.GLTFLoader;
    if (!Loader || !url || url === 'null' || url === 'undefined') {
      _addPlaceholder(id, url, opts, catColor, vis);
      return null;
    }

    return new Promise(resolve => {
      new Loader().load(
        '/' + String(url).replace(/^\/+/, ''),
        gltf => {
          // Guard: SceneEditor may have been destroyed while the model was loading
          if (!scene) { resolve(null); return; }

          const root = gltf.scene;
          root.traverse(obj => {
            if (!obj.isMesh) return;
            obj.castShadow = obj.receiveShadow = true;
            if (obj.material) obj.material.needsUpdate = true;
          });

          if (opts.fitToSize) {
            // Fit before adding to scene — natural bounds are model-local
            _fitModelToSize(root, opts.fitToSize);
            const off = root.userData.fitOffset || { x: 0, y: 0, z: 0 };
            const pos = opts.transform?.position || { x: 0, y: 0, z: 0 };
            root.position.set(off.x + (pos.x ?? 0), off.y + (pos.y ?? 0), off.z + (pos.z ?? 0));
            if (opts.transform?.rotation) {
              root.rotation.set(
                opts.transform.rotation.x ?? 0,
                opts.transform.rotation.y ?? 0,
                opts.transform.rotation.z ?? 0
              );
            }
          } else {
            _applyTransform(root, opts.transform);
          }

          root.userData.modelId = id;
          root.visible = vis;
          scene.add(root);
          models.set(id, {
            mesh: root, url, hasGLB: true,
            name:       opts.name       || id,
            productId:  opts.productId  || id,
            categoryId: opts.categoryId || '',
            isEnv:      !!opts.isEnv,
            visible:    vis,
          });
          resolve(root);
        },
        undefined,
        () => { _addPlaceholder(id, url, opts, catColor, vis); resolve(null); }
      );
    });
  }

  function _addPlaceholder(id, url, opts, catColor = 0x3b82f6, vis = true) {
    const sz  = opts.fitToSize || [1, 0.5, 1.5];
    const [w, h, d] = sz;
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mat  = new THREE.MeshPhongMaterial({ color: catColor, transparent: true, opacity: 0.55, shininess: 60 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: catColor, transparent: true, opacity: 0.5 })
    ));
    _applyTransform(mesh, opts.transform);
    mesh.userData.modelId = id;
    mesh.visible = vis;
    scene.add(mesh);
    models.set(id, {
      mesh, url, hasGLB: false,
      name:       opts.name       || id,
      productId:  opts.productId  || id,
      categoryId: opts.categoryId || '',
      isEnv:      !!opts.isEnv,
      visible:    vis,
    });
  }

  function _applyTransform(mesh, t) {
    if (!t) return;
    if (t.position) mesh.position.set(t.position.x ?? 0, t.position.y ?? 0, t.position.z ?? 0);
    if (t.rotation) mesh.rotation.set(t.rotation.x ?? 0, t.rotation.y ?? 0, t.rotation.z ?? 0);
    if (t.scale)    mesh.scale.set(   t.scale.x    ?? 1, t.scale.y    ?? 1, t.scale.z    ?? 1);
  }

  function _removeFromScene(id) {
    const entry = models.get(id);
    if (!entry) return;
    if (selectedId === id) _detach();
    scene.remove(entry.mesh);
    entry.mesh.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    models.delete(id);
  }

  function removeModel(id) {
    pushUndoState(id, 'delete');
    _removeFromScene(id);
    if (_onDeselect) _onDeselect();
  }

  function setVisible(id, v) {
    const entry = models.get(id);
    if (!entry) return;
    entry.visible = v;
    entry.mesh.visible = v;
    if (!v && selectedId === id) _detach();
  }

  function getVisible(id) { return models.get(id)?.visible ?? false; }

  function setAllVisible(categoryId, v) {
    models.forEach((entry, id) => {
      if (entry.categoryId === categoryId) setVisible(id, v);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  SELECTION
  // ──────────────────────────────────────────────────────────
  function selectModel(id) {
    if (selectedId === id) return;
    _detach();
    const entry = models.get(id);
    if (!entry) return;
    selectedId = id;

    if (transformControls) transformControls.attach(entry.mesh);

    entry.mesh.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      obj.userData._he  = obj.material.emissive?.getHex()       ?? 0;
      obj.userData._hei = obj.material.emissiveIntensity         ?? 0;
      if (obj.material.emissive) { obj.material.emissive.setHex(0x60a5fa); obj.material.emissiveIntensity = 0.4; }
    });

    if (_onSelect) _onSelect(id, _readTransform(id), entry.name, entry.productId);
  }

  function _detach() {
    if (!selectedId) return;
    const entry = models.get(selectedId);
    if (entry) {
      entry.mesh.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.userData._he !== undefined && obj.material.emissive) {
          obj.material.emissive.setHex(obj.userData._he);
          obj.material.emissiveIntensity = obj.userData._hei ?? 0;
        }
      });
    }
    if (transformControls) transformControls.detach();
    selectedId = null;
  }

  function deselect() {
    _detach();
    if (_onDeselect) _onDeselect();
  }

  // ──────────────────────────────────────────────────────────
  //  CAMERA
  // ──────────────────────────────────────────────────────────
  function focusSelected() {
    if (!camera) return; // guard: destroyed while loading
    if (!selectedId) { _resetView(); return; }
    const entry = models.get(selectedId);
    if (!entry) return;
    _focusMesh(entry.mesh);
  }

  function _focusMesh(mesh) {
    if (!camera) return;
    const box    = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist   = clamp(maxDim * 2.5, 0.5, 30);

    if (orbitControls) {
      orbitControls.target.copy(center);
      orbitControls.update();
    }
    const dir = camera.position.clone().sub(center).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
  }

  function _resetView() {
    if (!camera) return; // guard: destroyed while loading
    camera.position.set(0, 3.5, 7.5);
    if (orbitControls) { orbitControls.target.set(0, 0, 0); orbitControls.update(); }
  }

  // ──────────────────────────────────────────────────────────
  //  RAYCASTING
  // ──────────────────────────────────────────────────────────
  function handleClick(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx   = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ny   = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x: nx, y: ny }, camera);

    const targets = [];
    models.forEach(entry => entry.mesh.traverse(o => { if (o.isMesh) targets.push(o); }));

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      let obj = hits[0].object;
      let hitId = null;
      while (obj) {
        if (obj.userData.modelId) { hitId = obj.userData.modelId; break; }
        obj = obj.parent;
      }
      if (hitId) {
        if (hitId === selectedId) deselect();
        else selectModel(hitId);
      }
    } else {
      deselect();
    }
  }

  function handleDblClick(e) {
    handleClick(e);
    setTimeout(focusSelected, 0);
  }

  // ──────────────────────────────────────────────────────────
  //  TRANSFORM
  // ──────────────────────────────────────────────────────────
  function _readTransform(id) {
    const entry = models.get(id);
    if (!entry) return null;
    const m = entry.mesh;
    return {
      position: { x: fmt4(m.position.x), y: fmt4(m.position.y), z: fmt4(m.position.z) },
      rotation: { x: fmt4(m.rotation.x), y: fmt4(m.rotation.y), z: fmt4(m.rotation.z) },
      scale:    { x: fmt4(m.scale.x),    y: fmt4(m.scale.y),    z: fmt4(m.scale.z)    },
    };
  }

  function applyTransform(id, t) {
    const entry = models.get(id);
    if (!entry) return;
    _applyTransform(entry.mesh, t);
  }

  function setMode(mode) {
    transformMode = mode;
    if (transformControls) transformControls.setMode(mode);
  }

  function setSpace(space) {
    if (transformControls) transformControls.setSpace(space);
  }

  function resetTransform(id, which = 'all') {
    const entry = models.get(id);
    if (!entry) return;
    pushUndoState();
    const m = entry.mesh;
    if (which === 'position' || which === 'all') {
      const off = m.userData.fitOffset || { x: 0, y: 0, z: 0 };
      m.position.set(off.x, off.y, off.z);
    }
    if (which === 'rotation' || which === 'all') m.rotation.set(0, 0, 0);
    if (which === 'scale'    || which === 'all') m.scale.set(1, 1, 1);
    if (_onTransform) _onTransform(id, _readTransform(id));
  }

  function getBounds(id) {
    const entry = models.get(id);
    if (!entry) return null;
    const box = new THREE.Box3().setFromObject(entry.mesh);
    return box.getSize(new THREE.Vector3());
  }

  // ──────────────────────────────────────────────────────────
  //  UNDO / REDO
  // ──────────────────────────────────────────────────────────
  function pushUndoState(id, action = 'transform') {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    const t = _readTransform(targetId);
    if (!t && action !== 'delete') return;
    undoStack.push({ id: targetId, transform: t, action });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (!undoStack.length) return;
    const state = undoStack.pop();
    const cur = _readTransform(state.id);
    if (cur) redoStack.push({ id: state.id, transform: cur });
    if (state.transform) applyTransform(state.id, state.transform);
    if (state.id === selectedId && _onTransform) _onTransform(state.id, _readTransform(state.id));
  }

  function redo() {
    if (!redoStack.length) return;
    const state = redoStack.pop();
    const cur = _readTransform(state.id);
    if (cur) undoStack.push({ id: state.id, transform: cur });
    if (state.transform) applyTransform(state.id, state.transform);
    if (state.id === selectedId && _onTransform) _onTransform(state.id, _readTransform(state.id));
  }

  async function duplicateModel(id) {
    const entry = models.get(id);
    if (!entry) return null;
    const t = _readTransform(id);
    t.position.x += 1.5;
    const newId = id + '_copy_' + Date.now();
    await loadModel(newId, entry.url, { name: entry.name + ' (copy)', productId: entry.productId, transform: t });
    selectModel(newId);
    return newId;
  }

  function getSceneData() {
    const data = {};
    models.forEach((entry, id) => {
      data[id] = {
        name: entry.name, file: entry.url, productId: entry.productId,
        categoryId: entry.categoryId, hasGLB: entry.hasGLB,
        visible: entry.visible, transform: _readTransform(id),
      };
    });
    return data;
  }

  function getModelIds()         { return [...models.keys()]; }
  function getModelEntry(id)     { return models.get(id) || null; }
  function getModelCount()       { return models.size; }
  function getVisibleCount()     { return [...models.values()].filter(e => e.visible).length; }
  function getTransform(id)      { return _readTransform(id); }
  function getEnvModelIds()      { return [...models.entries()].filter(([,e]) => e.isEnv).map(([id]) => id); }
  function getProductModelIds()  { return [...models.entries()].filter(([,e]) => !e.isEnv).map(([id]) => id); }

  function _getCameraState() {
    if (!camera || !orbitControls) return null;
    return {
      position: { x: fmt4(camera.position.x), y: fmt4(camera.position.y), z: fmt4(camera.position.z) },
      target:   { x: fmt4(orbitControls.target.x), y: fmt4(orbitControls.target.y), z: fmt4(orbitControls.target.z) },
      fov: camera.fov,
    };
  }

  function applyCameraState(state) {
    if (!camera || !orbitControls || !state) return;
    if (state.position) camera.position.set(state.position.x, state.position.y, state.position.z);
    if (state.target)   orbitControls.target.set(state.target.x, state.target.y, state.target.z);
    if (state.fov)      { camera.fov = state.fov; camera.updateProjectionMatrix(); }
    orbitControls.update();
  }

  function toggleGrid(v)   { if (gridHelper)   gridHelper.visible   = v; }
  function toggleAxes(v)   { if (axesHelper)   axesHelper.visible   = v; }
  function toggleOrigin(v) { if (originMarker) originMarker.visible = v; }

  function destroy() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    models.forEach((_, id) => _removeFromScene(id));
    if (transformControls) { try { transformControls.dispose(); } catch(_) {} transformControls = null; }
    if (orbitControls)     { try { orbitControls.dispose();     } catch(_) {} orbitControls     = null; }
    if (renderer)          { renderer.dispose(); renderer = null; }
    scene = camera = null;
    selectedId = null;
    undoStack.length = 0; redoStack.length = 0;
    transformMode = 'translate';
  }

  return {
    init, destroy,
    loadModel, removeModel, selectModel, deselect, focusSelected,
    getTransform, getEnvModelIds, getProductModelIds,
    duplicateModel, applyTransform, reFitModel, setMode, setSpace,
    resetTransform, getBounds, undo, redo, pushUndoState,
    toggleGrid, toggleAxes, toggleOrigin,
    getSceneData, getModelIds, getModelEntry, handleClick, handleDblClick,
    get selectedId()  { return selectedId; },
    get canUndo()     { return undoStack.length > 0; },
    get canRedo()     { return redoStack.length > 0; },
    get undoCount()   { return undoStack.length; },
    get redoCount()   { return redoStack.length; },
    setVisible, getVisible, setAllVisible, getModelCount, getVisibleCount,
    _getCameraState, applyCameraState,
    set onSelect(cb)    { _onSelect    = cb; },
    set onDeselect(cb)  { _onDeselect  = cb; },
    set onTransform(cb) { _onTransform = cb; },
  };

})();
