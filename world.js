import * as THREE from './vendor/three.module.min.js';
import {buildFacility, buildWatcher, CELL, layoutFor, releaseScene} from './assets/world/facility.js';
import {softwareView} from './assets/world/software-view.js';

const EYE_HEIGHT = 1.62;
const BODY_RADIUS = .24;
const between = (v, min, max) => Math.max(min, Math.min(v, max));
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
  'ArrowRight', 'ShiftLeft', 'ShiftRight', 'PageUp', 'PageDown']);

export function createWorld(container, callbacks = {}) {
  let canvas = document.createElement('canvas');
  let renderer = null, drawSoftware = null;
  let renderScale = Math.min(window.devicePixelRatio || 1, 1.6), slowFrames = 0;
  try {
    const attributes = {antialias: true, alpha: false, depth: true, powerPreference: 'high-performance'};
    const context = canvas.getContext('webgl2', attributes) || canvas.getContext('webgl', attributes);
    if (!context) throw new Error('WebGL unavailable');
    renderer = new THREE.WebGLRenderer({canvas, context, ...attributes});
    const gl = renderer.getContext(), gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (gpuInfo && /swiftshader|llvmpipe|software rasterizer/i.test(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL))) {
      renderScale = Math.min(renderScale, .72);
    }
    renderer.setPixelRatio(renderScale);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
  } catch {
    // A canvas which has already tried a GL context cannot acquire a 2D context.
    canvas = document.createElement('canvas');
    drawSoftware = softwareView(canvas);
  }
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;user-select:none;';
  canvas.setAttribute('aria-label', 'Коридоры комплекса. Перемещение — WASD или стрелки, осмотр — мышь.');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 1, .045, 77);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const ambient = new THREE.HemisphereLight(0xd1d2b5, 0x79705d, .82);
  scene.add(ambient);
  const fixtures = Array.from({length: 4}, () => {
    const source = new THREE.PointLight(0xffe1a5, 12, 13, 2);
    scene.add(source);
    return source;
  });

  const beam = new THREE.SpotLight(0xffedc5, 24, 28, .52, .68, 1.4);
  beam.position.set(.16, -.15, .04);
  beam.target.position.set(0, -.18, -7);
  camera.add(beam, beam.target);
  const warningLight = new THREE.PointLight(0xe85f37, 0, 8, 2);
  scene.add(warningLight);
  const direction = new THREE.Vector3(), targetDir = new THREE.Vector3();
  const keys = new Set(), touches = new Map(), manualMove = new THREE.Vector2();
  let life = 'idle', layout, facility, watcher;
  let collected = false, flashlight = true, focus = null;
  let sensitivity = 1, walkTime = 0, stepTime = 0, roomTime = 0, frame = 0, previousTime = 0;
  let hazardTime = 0, hazardPhase = 'idle', nextHazard = 38, patrolLength = 0;
  let mouseDown = false, wasLocked = false, ignoreUnlock = false, disposed = false;
  let lastSize = '';
  const events = new AbortController();
  const listen = (el, type, fn, opts = {}) => el.addEventListener(type, fn, {...opts, signal: events.signal});

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    if (lastSize === w + '/' + h) return;
    lastSize = w + '/' + h;
    camera.aspect = w / h;
    camera.fov = camera.aspect < .85 ? 78 : 68;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(w, h, false);
    else {
      const factor = Math.min(1, 580 / w, 370 / h);
      canvas.width = Math.max(1, Math.round(w * factor));
      canvas.height = Math.max(1, Math.round(h * factor));
    }
  }

  function clearInput() {
    keys.clear();
    touches.clear();
    manualMove.set(0, 0);
    mouseDown = false;
  }
  function requestMouse() {
    if (!canvas.requestPointerLock || document.pointerLockElement === canvas) return;
    try { canvas.requestPointerLock()?.catch(() => {}); } catch { /* Drag remains available. */ }
  }
  function look(horizontal, vertical) {
    camera.rotation.y -= horizontal;
    camera.rotation.x = between(camera.rotation.x - vertical, -1.08, 1.08);
  }
  listen(document, 'pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (wasLocked && !locked && life === 'running' && !ignoreUnlock) callbacks.onPause?.();
    wasLocked = locked;
    if (!locked) ignoreUnlock = false;
  });
  listen(canvas, 'pointerdown', e => {
    if (life !== 'running') return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      const rect = canvas.getBoundingClientRect();
      const mode = e.clientX - rect.left < rect.width * .45 ? 'move' : 'look';
      touches.set(e.pointerId, {mode, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY});
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    } else if (e.button === 0) {
      mouseDown = true;
      requestMouse();
    }
  });
  listen(document, 'pointermove', e => {
    if (life !== 'running') return;
    const touch = touches.get(e.pointerId);
    if (touch) {
      if (touch.mode === 'look') look((e.clientX - touch.x) * .0043 * sensitivity, (e.clientY - touch.y) * .0043 * sensitivity);
      else manualMove.set(between((e.clientX - touch.ox) / 50, -1, 1), between((touch.oy - e.clientY) / 50, -1, 1));
      touch.x = e.clientX; touch.y = e.clientY;
    } else if (e.pointerType === 'mouse' && (mouseDown || document.pointerLockElement === canvas)) {
      look(e.movementX * .00235 * sensitivity, e.movementY * .00235 * sensitivity);
    }
  });
  function releasePointer(e) {
    if (touches.get(e.pointerId)?.mode === 'move') manualMove.set(0, 0);
    touches.delete(e.pointerId);
    if (e.pointerType === 'mouse') mouseDown = false;
  }
  listen(document, 'pointerup', releasePointer);
  listen(document, 'pointercancel', releasePointer);
  listen(window, 'keydown', e => {
    if (life !== 'running' || !movementKeys.has(e.code)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    keys.add(e.code);
    e.preventDefault();
  });
  listen(window, 'keyup', e => keys.delete(e.code));
  listen(window, 'blur', () => { clearInput(); if (life === 'running') callbacks.onPause?.(); });
  listen(document, 'visibilitychange', () => {
    if (document.hidden && life === 'running') { clearInput(); callbacks.onPause?.(); }
  });

  function clearLevel() {
    if (!facility) return;
    // The watcher uses the same materials and gets disposed with the facility.
    facility.group.add(watcher.group);
    scene.remove(facility.group);
    releaseScene(facility.group);
    facility = null; watcher = null;
  }
  function canStand(x, z) {
    for (const dx of [-BODY_RADIUS, BODY_RADIUS]) for (const dz of [-BODY_RADIUS, BODY_RADIUS])
      if (!layout.inside(x + dx, z + dz)) return false;
    for (const o of facility.obstacles) {
      if (Math.abs(x - o.x) < o.w + BODY_RADIUS && Math.abs(z - o.z) < o.d + BODY_RADIUS) return false;
    }
    return true;
  }
  function visibleThroughCells(x, z) {
    const pos = camera.position;
    const distance = Math.hypot(pos.x - x, pos.z - z);
    const steps = Math.ceil(distance / .19);
    for (let i = 1; i < steps; i++)
      if (!layout.inside(pos.x + (x - pos.x) * i / steps, pos.z + (z - pos.z) * i / steps)) return false;
    return true;
  }
  function setFocus(kind) {
    if (focus === kind) return;
    focus = kind;
    callbacks.onFocus?.(kind);
  }
  function updateFocus() {
    camera.getWorldDirection(direction);
    let best = null, bestScore = -Infinity;
    for (const [kind, p] of Object.entries(layout.points)) {
      if (kind === 'item' && collected) continue;
      const y = kind === 'item' ? 1.09 : 1.36;
      targetDir.set(p.x - camera.position.x, y - camera.position.y, p.z - camera.position.z);
      const distance = targetDir.length();
      if (distance > 2.9 || distance < .05) continue;
      const score = targetDir.normalize().dot(direction);
      // Widen the inspection cone beside the tabletop so keyboard-only
      // players can read the prompt without tiny corrections to their turn.
      const requiredAim = .66 + .21 * between((distance - 1.10) / 1.4, 0, 1);
      if (score < requiredAim || score <= bestScore || !visibleThroughCells(p.x, p.z)) continue;
      best = kind; bestScore = score;
    }
    setFocus(best);
  }
  function move(dt) {
    const k = (...codes) => codes.some(code => keys.has(code)) ? 1 : 0;
    const turn = k('ArrowRight') - k('ArrowLeft');
    const pitch = k('PageDown') - k('PageUp');
    if (turn || pitch) look(turn * dt * 1.85 * sensitivity, pitch * dt * 1.2);
    let x = k('KeyD') - k('KeyA') + manualMove.x;
    let forward = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') + manualMove.y;
    const length = Math.hypot(x, forward);
    if (length > 1) { x /= length; forward /= length; }
    const running = k('ShiftLeft', 'ShiftRight');
    const speed = running ? 4.55 : 2.85;
    const speedDt = speed * dt, cs = Math.cos(camera.rotation.y), sn = Math.sin(camera.rotation.y);
    const pos = camera.position, oldX = pos.x, oldZ = pos.z;
    const nx = pos.x + (x * cs - forward * sn) * speedDt;
    const nz = pos.z + (-x * sn - forward * cs) * speedDt;
    if (canStand(nx, pos.z)) pos.x = nx;
    if (canStand(pos.x, nz)) pos.z = nz;
    if (Math.abs(pos.x - oldX) + Math.abs(pos.z - oldZ) > .0004) {
      walkTime += dt * (running ? 12 : 8.7);
      pos.y = EYE_HEIGHT + Math.sin(walkTime) * .026;
      stepTime -= dt;
      if (stepTime <= 0) { callbacks.onMove?.(); stepTime = running ? .32 : .49; }
    } else {
      pos.y += (EYE_HEIGHT - pos.y) * Math.min(1, 12 * dt);
    }
  }
  function updateHazard(dt) {
    hazardTime += dt;
    if (hazardPhase === 'idle' && hazardTime >= nextHazard) {
      hazardPhase = 'warning'; hazardTime = 0;
      callbacks.onThreat?.('В дальнем конце щёлкнуло реле. Обходчик идёт по центральному коридору. Укройтесь в боковой комнате.');
    } else if (hazardPhase === 'warning' && hazardTime >= 6) {
      hazardPhase = 'patrol'; hazardTime = 0;
      watcher.group.visible = true;
    } else if (hazardPhase === 'patrol') {
      const z = -layout.end * CELL + hazardTime * 2.05;
      watcher.group.position.set(Math.sin(hazardTime * 1.8) * .065, .016 * Math.sin(hazardTime * 4), z);
      for (const {pivot, sign} of watcher.limbs) pivot.rotation.x = sign * .29 * Math.sin(hazardTime * 4);
      warningLight.position.set(0, 2.54, z + .2);
      if (Math.abs(camera.position.x) < CELL / 2 - .02 && Math.abs(z - camera.position.z) < .84) {
        pause(); callbacks.onFail?.(); return;
      }
      if (hazardTime >= patrolLength) {
        watcher.group.visible = false; hazardPhase = 'idle'; hazardTime = 0;
        nextHazard = 32 + (layout.end % 3) * 3;
        callbacks.onThreat?.('Шаги стихли. Центральный проход свободен.');
      }
    }
    warningLight.intensity = hazardPhase === 'patrol' ? 6.5 : 0;
  }
  function updateLights() {
    const pos = camera.position;
    facility.lights.sort((a, b) => a.distanceToSquared(pos) - b.distanceToSquared(pos));
    for (let i = 0; i < fixtures.length; i++) {
      const light = fixtures[i];
      light.position.copy(facility.lights[i]);
      const flicker = .97 + .03 * Math.sin(roomTime * 8.7 + i * 3);
      const warn = hazardPhase === 'warning' ? .58 + .22 * Math.cos(roomTime * 5) : 1;
      light.intensity = (i === 0 ? 20 : 14) * flicker * warn;
    }
  }
  function render() {
    resize();
    if (renderer) renderer.render(scene, camera);
    else drawSoftware({camera, layout, facility, flashlight, watcher: watcher.group, collected});
  }
  function tick(now) {
    frame = 0;
    if (life !== 'running' || disposed) return;
    const elapsed = Math.max(0, (now - previousTime) / 1000);
    previousTime = now;
    // Substeps keep movement and the patrol responsive on slower GPUs without
    // tunnelling through thin cabinets or walls during a long frame.
    const dt = Math.min(.25, elapsed);
    const steps = Math.max(1, Math.ceil(dt / .045));
    roomTime += dt;
    for (let i = 0; i < steps && life === 'running'; i++) {
      move(dt / steps); updateHazard(dt / steps);
    }
    slowFrames = elapsed > .065 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (renderer && slowFrames >= 6 && renderScale > .41) {
      renderScale = Math.max(.40, renderScale * .75);
      renderer.setPixelRatio(renderScale);
      slowFrames = 0;
    }
    if (life !== 'running') return;
    updateFocus(); updateLights(); render();
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (disposed || !facility || life === 'running') return;
    clearInput();
    life = 'running'; previousTime = performance.now();
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (life === 'running') life = 'paused';
    clearInput(); setFocus(null);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (document.pointerLockElement === canvas) {
      ignoreUnlock = true;
      document.exitPointerLock?.();
    }
  }
  function start(mission) {
    if (disposed) return;
    pause(); clearLevel();
    layout = layoutFor(mission.id);
    facility = buildFacility(mission, layout);
    watcher = buildWatcher(facility.mat); watcher.group.visible = false;
    scene.add(facility.group, watcher.group);
    const fog = new THREE.Color(0x262a24);
    scene.background = fog; scene.fog = new THREE.FogExp2(fog, .053);
    for (const light of fixtures) light.color.set(facility.colors[4]);
    camera.position.set(0, EYE_HEIGHT, .78); camera.rotation.set(-.012, 0, 0, 'YXZ');
    collected = false; walkTime = 0; stepTime = .28; roomTime = 0;
    hazardTime = 0; hazardPhase = 'idle'; warningLight.intensity = 0;
    nextHazard = 43 - layout.chapter; patrolLength = (layout.end * CELL + 1.75) / 2.05;
    setFocus(null); updateLights(); render(); resume();
  }
  return {
    start, pause, resume,
    interact() {
      if (life !== 'running') return null;
      updateFocus();
      const kind = focus;
      if (kind) callbacks.onInteract?.(kind);
      return kind;
    },
    setCollected(value) {
      collected = !!value;
      if (facility) facility.item.visible = !collected;
      if (focus === 'item' && collected) setFocus(null);
    },
    setFlashlight(value) { flashlight = !!value; beam.visible = flashlight; },
    setSensitivity(value) { if (Number.isFinite(value)) sensitivity = between(value, .12, 2.5); },
    setMove(x, forward) { manualMove.set(between(x, -1, 1), between(forward, -1, 1)); },
    getLocations() {
      if (!layout) return {};
      return {item: layout.rooms[layout.itemRoom].title, clue: layout.rooms[layout.clueRoom].title, station: 'Пост в торце центрального коридора'};
    },
    dispose() {
      if (disposed) return;
      pause(); disposed = true; events.abort(); clearLevel();
      renderer?.dispose(); canvas.remove();
    },
  };
}
