'use strict';

// ── Admin panel 3D viewer — spherical orbit + in-viewer editing ──
window.AdminViewer = (function () {

  // ── Core refs ─────────────────────────────────────────────
  let renderer = null, scene, camera, modelGroup;
  let ambientLight, sunLight, fillLight, gridObj, sinkObj;
  let animId    = null;
  let loadingEl = null;

  // ── Camera (spherical orbit) ──────────────────────────────
  let camR     = 7;
  let camTheta = 0.4;
  let camPhi   = 0.35;
  const target = new THREE.Vector3(0, 0, 0);

  // ── Interaction state ─────────────────────────────────────
  let dragging     = false;
  let transforming = false;
  let lastX = 0, lastY = 0;
  let clickOrigin  = null;   // {x,y,t} — for click vs drag detection
  let autoRot      = true;

  // ── Transform mode + selection ────────────────────────────
  let transformMode  = 'orbit';  // 'orbit' | 'move' | 'rotate' | 'scale'
  let modelSelected  = false;

  // ── Callbacks ─────────────────────────────────────────────
  let _onLoaded       = null;
  let _onSelect       = null;
  let _onDeselect     = null;
  let _onTransform    = null;
  let _onTransformEnd = null;

  // ── Utils ─────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function applyCamera() {
    if (!camera) return;
    const cosP = Math.cos(camPhi), sinP = Math.sin(camPhi);
    camera.position.set(
      target.x + camR * cosP * Math.sin(camTheta),
      target.y + camR * sinP,
      target.z + camR * cosP * Math.cos(camTheta)
    );
    camera.lookAt(target);
  }

  // ── Init ──────────────────────────────────────────────────
  function init(canvas) {
    if (!canvas || typeof THREE === 'undefined') return;
    if (renderer && renderer.domElement !== canvas) destroy();
    if (renderer) return;

    const w = canvas.offsetWidth || 520, h = canvas.offsetHeight || 420;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog        = new THREE.FogExp2(0x0a0e17, 0.04);

    camera = new THREE.PerspectiveCamera(42, w / h, 0.03, 120);
    applyCamera();

    // Lights (stored for atmosphere control)
    ambientLight = new THREE.AmbientLight(0x8099b0, 0.9);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(5, 10, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    fillLight = new THREE.DirectionalLight(0x4488ff, 0.35);
    fillLight.position.set(-4, 3, -4);
    scene.add(fillLight);

    // Sink context
    const sinkMat = new THREE.MeshPhongMaterial({ color: 0xdde3ec, shininess: 120, specular: 0x888888 });
    sinkObj = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.2), sinkMat);
    sinkObj.receiveShadow = true;
    scene.add(sinkObj);

    // Floor
    gridObj = new THREE.GridHelper(16, 26, 0x1e3344, 0x121e2a);
    gridObj.position.y = -1.1;
    scene.add(gridObj);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.7 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.1;
    scene.add(glow);

    loadingEl = document.getElementById('av-loading');

    bindControls(canvas);

    new ResizeObserver(() => {
      if (!renderer || !canvas.offsetWidth) return;
      renderer.setSize(canvas.offsetWidth, canvas.offsetHeight, false);
      camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
      camera.updateProjectionMatrix();
    }).observe(canvas.parentElement || canvas);

    animate();
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;
    if (autoRot && !dragging && !transforming) { camTheta += 0.004; applyCamera(); }
    renderer.render(scene, camera);
  }

  // ── Load model ────────────────────────────────────────────
  function loadModel(modelUrl, c3d) {
    if (!scene) return;
    if (modelGroup) { scene.remove(modelGroup); modelGroup = null; }
    deselectModel();
    target.set(0, 0, 0); camR = 7; autoRot = true;

    const pos = c3d?.position || [0, 0, 0];
    const rot = c3d?.rotation || [0, 0, 0];
    const sz  = c3d?.size     || [1, 1, 1];

    const url = modelUrl && modelUrl !== '—'
      ? '/' + String(modelUrl).replace(/^\/+/, '') : null;

    if (!url || !(url.endsWith('.glb') || url.endsWith('.gltf'))) {
      showBox(pos, rot, sz); return;
    }
    showBox(pos, rot, sz, true);
    setLoading(true);
    if (!THREE.GLTFLoader) { setLoading(false); showBox(pos, rot, sz); return; }

    new THREE.GLTFLoader().load(url,
      gltf => {
        if (modelGroup) scene.remove(modelGroup);
        const wrapper = new THREE.Group();
        gltf.scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = o.receiveShadow = true;
          if (o.material) o.material.needsUpdate = true;
        });
        fitToBox(gltf.scene, sz);
        gltf.scene.rotation.set(rot[0]||0, rot[1]||0, rot[2]||0);
        wrapper.position.set(pos[0], pos[1], pos[2]);
        wrapper.userData.baseSize   = sz.slice();
        wrapper.userData.loadedSize = sz.slice();
        wrapper.add(gltf.scene);
        modelGroup = wrapper;
        scene.add(modelGroup);
        setLoading(false);
        if (_onLoaded) _onLoaded();
      },
      undefined,
      () => { showBox(pos, rot, sz); setLoading(false); }
    );
  }

  // ── Live transform update (from sliders) ──────────────────
  function updateTransform(pos, rot, sz) {
    if (!modelGroup) return;
    modelGroup.position.set(pos[0], pos[1], pos[2]);
    modelGroup.rotation.set(rot[0], rot[1], rot[2]);
    if (sz) {
      if (!modelGroup.userData.baseSize) modelGroup.userData.baseSize = sz.slice();
      const base = modelGroup.userData.baseSize;
      modelGroup.scale.set(
        base[0] > 0 ? sz[0] / base[0] : 1,
        base[1] > 0 ? sz[1] / base[1] : 1,
        base[2] > 0 ? sz[2] / base[2] : 1
      );
    }
    autoRot = false;
  }

  // ── In-viewer drag transform ──────────────────────────────
  function doTransformDrag(dx, dy) {
    if (!modelGroup || !modelSelected) return;
    const speed = camR * 0.002;
    if (transformMode === 'move') {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      modelGroup.position.addScaledVector(right, dx * speed);
      modelGroup.position.y -= dy * speed;
    } else if (transformMode === 'rotate') {
      modelGroup.rotation.y -= dx * 0.012;
      modelGroup.rotation.x = clamp(modelGroup.rotation.x - dy * 0.012, -Math.PI, Math.PI);
    } else if (transformMode === 'scale') {
      const factor = 1 - dy * 0.005;
      const cur = modelGroup.scale.x;
      const ns = clamp(cur * factor, 0.01, 20);
      modelGroup.scale.setScalar(ns);
    }
    autoRot = false;
    if (_onTransform) _onTransform(getModelTransform());
  }

  function getModelTransform() {
    if (!modelGroup) return null;
    return {
      position: modelGroup.position.toArray().map(v => +v.toFixed(4)),
      rotation: [modelGroup.rotation.x, modelGroup.rotation.y, modelGroup.rotation.z].map(v => +v.toFixed(4)),
      scale: +modelGroup.scale.x.toFixed(4),
    };
  }

  // ── Selection ─────────────────────────────────────────────
  function selectModel() {
    if (modelSelected) return;
    modelSelected = true;
    setHighlight(true);
    if (_onSelect) _onSelect();
  }

  function deselectModel() {
    if (!modelSelected) return;
    modelSelected = false;
    setHighlight(false);
    if (_onDeselect) _onDeselect();
  }

  function setHighlight(on) {
    if (!modelGroup) return;
    modelGroup.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      if (on) {
        obj.userData._he  = obj.material.emissive?.getHex()       ?? 0;
        obj.userData._hei = obj.material.emissiveIntensity        ?? 0;
        if (obj.material.emissive) { obj.material.emissive.setHex(0x60a5fa); obj.material.emissiveIntensity = 0.45; }
      } else {
        if (obj.material.emissive && obj.userData._he !== undefined) {
          obj.material.emissive.setHex(obj.userData._he);
          obj.material.emissiveIntensity = obj.userData._hei;
        }
      }
    });
  }

  function handleClick(cx, cy) {
    const canvas = renderer?.domElement;
    if (!canvas || !modelGroup) { deselectModel(); return; }
    const rect = canvas.getBoundingClientRect();
    const nx   = ((cx - rect.left) / rect.width)  *  2 - 1;
    const ny   = -((cy - rect.top)  / rect.height) *  2 + 1;
    const ray  = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const targets = [];
    modelGroup.traverse(o => { if (o.isMesh) targets.push(o); });
    const hits = ray.intersectObjects(targets, false);
    if (hits.length > 0) {
      if (modelSelected) deselectModel(); else selectModel();
    } else {
      deselectModel();
    }
  }

  // ── Atmosphere ────────────────────────────────────────────
  function setAtmosphere(opts) {
    if (!scene) return;
    if (opts.background !== undefined) {
      const c = new THREE.Color(opts.background);
      scene.background = c;
      if (scene.fog) scene.fog.color.set(opts.background);
    }
    if (opts.fog !== undefined) {
      scene.fog = opts.fog
        ? new THREE.FogExp2(scene.background.getHex(), opts.fogDensity ?? 0.04)
        : null;
    }
    if (opts.fogDensity !== undefined && scene.fog) scene.fog.density = opts.fogDensity;
    if (opts.ambient    !== undefined && ambientLight) ambientLight.intensity = opts.ambient;
    if (opts.ambientColor !== undefined && ambientLight) ambientLight.color.set(opts.ambientColor);
    if (opts.sun        !== undefined && sunLight)     sunLight.intensity     = opts.sun;
    if (opts.sunColor   !== undefined && sunLight)     sunLight.color.set(opts.sunColor);
    if (opts.fill       !== undefined && fillLight)    fillLight.intensity    = opts.fill;
    if (opts.grid       !== undefined && gridObj)      gridObj.visible        = opts.grid;
    if (opts.sink       !== undefined && sinkObj)      sinkObj.visible        = opts.sink;
    if (opts.exposure   !== undefined && renderer)     renderer.toneMappingExposure = opts.exposure;
  }

  // ── HDRI ──────────────────────────────────────────────────
  function loadHDRI(url) {
    const RGBELoader = THREE.RGBELoader;
    if (!RGBELoader || !scene || !renderer) return;
    new RGBELoader().load(url, texture => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const envMap = pmrem.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      scene.background  = envMap;
      texture.dispose();
      pmrem.dispose();
    });
  }

  function clearHDRI() {
    if (!scene) return;
    scene.environment = null;
    scene.background  = new THREE.Color(0x0a0e17);
    if (scene.fog) scene.fog.color.setHex(0x0a0e17);
  }

  // ── Controls ──────────────────────────────────────────────
  function bindControls(canvas) {

    const startOrbit = (x, y) => {
      dragging = true; autoRot = false;
      lastX = x; lastY = y;
      canvas.style.cursor = 'grabbing';
    };
    const doOrbit = (x, y) => {
      if (!dragging) return;
      camTheta -= (x - lastX) * 0.008;
      camPhi    = clamp(camPhi + (y - lastY) * 0.006, -1.4, 1.4);
      applyCamera();
      lastX = x; lastY = y;
    };

    const startTransform = (x, y) => {
      transforming = true; autoRot = false;
      lastX = x; lastY = y;
      canvas.style.cursor = 'crosshair';
    };
    const doXform = (x, y) => {
      if (!transforming) return;
      doTransformDrag(x - lastX, y - lastY);
      lastX = x; lastY = y;
    };

    const endAll = () => {
      const wasTransforming = transforming;
      dragging = false; transforming = false;
      canvas.style.cursor = transformMode === 'orbit' ? 'grab' : 'crosshair';
      if (wasTransforming && _onTransformEnd) _onTransformEnd(getModelTransform());
    };

    // Mouse
    canvas.addEventListener('mousedown', e => {
      e.stopPropagation();
      clickOrigin = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (transformMode === 'orbit') startOrbit(e.clientX, e.clientY);
      else if (modelSelected)        startTransform(e.clientX, e.clientY);
      else                           startOrbit(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => {
      if (dragging)     doOrbit(e.clientX, e.clientY);
      if (transforming) doXform(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', e => {
      endAll();
      if (clickOrigin) {
        const dx = Math.abs(e.clientX - clickOrigin.x);
        const dy = Math.abs(e.clientY - clickOrigin.y);
        if (dx < 5 && dy < 5 && Date.now() - clickOrigin.t < 350) {
          handleClick(e.clientX, e.clientY);
        }
        clickOrigin = null;
      }
    });

    // Touch
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      clickOrigin = { x: t.clientX, y: t.clientY, t: Date.now() };
      startOrbit(t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault(); doOrbit(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    canvas.addEventListener('touchend', endAll);

    // Zoom toward cursor
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const nx   = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const ny   = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const ray  = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, camera);
      const step    = e.deltaY > 0 ? 1 : -1;
      const zoomAmt = step * Math.max(0.05, camR * 0.09);
      const newR    = clamp(camR + zoomAmt, 0.15, 16);
      const moved   = newR - camR;
      camR = newR;
      target.addScaledVector(ray.ray.direction, -moved * 0.55);
      target.x = clamp(target.x, -5, 5);
      target.y = clamp(target.y, -2, 5);
      target.z = clamp(target.z, -5, 5);
      applyCamera();
    }, { passive: false });

    // Shift+drag = pan
    let shiftDown = false;
    window.addEventListener('keydown', e => { if (e.key === 'Shift') shiftDown = true;  });
    window.addEventListener('keyup',   e => {
      if (e.key === 'Shift') shiftDown = false;
      if (e.key === 'Escape') deselectModel();
    });
    canvas.addEventListener('mousemove', e => {
      if (!dragging || !shiftDown) return;
      const speed = camR * 0.0012;
      const right = new THREE.Vector3();
      camera.getWorldDirection(right).negate();
      right.crossVectors(camera.up, right).normalize();
      target.addScaledVector(right, -(e.clientX - lastX) * speed);
      target.y = clamp(target.y + (e.clientY - lastY) * speed, -2, 5);
      applyCamera();
      lastX = e.clientX; lastY = e.clientY;
    });

    canvas.style.cursor = 'grab';
  }

  // ── Helpers ───────────────────────────────────────────────
  function showBox(pos, rot, sz, wireframe = false) {
    if (modelGroup) scene.remove(modelGroup);
    const [w, h, d] = sz.map(v => clamp(v, 0.05, 4));
    const geo  = new THREE.BoxGeometry(w || 1, h || 0.4, d || 1);
    const mat  = new THREE.MeshPhongMaterial({ color: 0x3b82f6, shininess: 80, transparent: true, opacity: wireframe ? 0.18 : 0.72, wireframe });
    const mesh = new THREE.Mesh(geo, mat);
    if (!wireframe) mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.55 })
    ));
    mesh.position.set(...pos);
    mesh.rotation.set(rot[0]||0, rot[1]||0, rot[2]||0);
    modelGroup = new THREE.Group();
    modelGroup.add(mesh);
    modelGroup.userData.baseSize = sz.slice();
    scene.add(modelGroup);
  }

  function fitToBox(model, targetSize) {
    const box = new THREE.Box3().setFromObject(model);
    const sz  = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    const [tw, th, td] = targetSize;
    const s   = Math.min(sz.x ? tw/sz.x : Infinity, sz.y ? th/sz.y : Infinity, sz.z ? td/sz.z : Infinity);
    const sc  = isFinite(s) && s > 0 ? s : 1;
    model.scale.multiplyScalar(sc);
    model.position.set(-ctr.x*sc, -ctr.y*sc, -ctr.z*sc);
  }

  function setLoading(on) {
    if (!loadingEl) loadingEl = document.getElementById('av-loading');
    if (loadingEl) loadingEl.style.display = on ? 'flex' : 'none';
  }

  // ── Mode setter ───────────────────────────────────────────
  function setMode(mode) {
    transformMode = mode;
    const canvas = renderer?.domElement;
    if (canvas) canvas.style.cursor = mode === 'orbit' ? 'grab' : 'crosshair';
    if (mode === 'orbit') deselectModel();
  }

  // ── Cleanup ───────────────────────────────────────────────
  function destroy() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = camera = modelGroup = ambientLight = sunLight = fillLight = gridObj = sinkObj = loadingEl = null;
    modelSelected = false; transformMode = 'orbit'; autoRot = true;
    camR = 7; camTheta = 0.4; camPhi = 0.35; target.set(0,0,0);
  }

  return {
    init, loadModel, updateTransform, setMode, setAtmosphere, loadHDRI, clearHDRI, destroy,
    get selectedModel() { return modelSelected; },
    set onLoaded(cb)    { _onLoaded    = cb; },
    set onSelect(cb)    { _onSelect    = cb; },
    set onDeselect(cb)  { _onDeselect  = cb; },
    set onTransform(cb)    { _onTransform    = cb; },
    set onTransformEnd(cb) { _onTransformEnd = cb; },
  };

})();
