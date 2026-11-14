import * as THREE from './vendor/three.module.min.js';
import {buildFacility, buildWatcher, CELL, layoutFor, releaseScene} from './assets/world/facility.js';
import {gateBlocks, POST} from './assets/world/checkpoint.js';
import {softwareView} from './assets/world/software-view.js';
import {advanceFirstEncounter, createFirstEncounter, FIRST_PATROL} from './assets/world/encounter.js';
import {ARCHIVE_DOOR, CHAPTER_SITES, EXIT_Z, restoreChapter} from './assets/world/chapter.js';
import {SIGNAL_BOARD, SIGNAL_SITES, restoreSignals} from './assets/world/signals.js';

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
  let hazardTime = 0, hazardPhase = 'idle', nextHazard = 38, patrolOrigin = 0, patrolLength = 0;
  let firstEncounter = null;
  let chapterState = null, chapterCompleted = 0;
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
    if (facility.chapterScene?.blocks(x, z, BODY_RADIUS)) return false;
    return !facility.checkpoint || !gateBlocks(x, z, facility.checkpoint.progress, BODY_RADIUS);
  }
  function visibleThroughCells(x, z) {
    const pos = camera.position;
    if (facility.chapterScene && !facility.chapterScene.lineClear(pos, {x, z})) return false;
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
      const y = p.y ?? (kind === 'item' ? 1.09 : 1.36);
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
  function updateGate(dt) {
    facility.chapterScene?.update(dt);
    const gate = facility.checkpoint;
    if (!gate?.active || gate.progress >= 1) return;
    const before = gate.progress;
    gate.setProgress(Math.min(1, before + dt / 1.2));
    if (before < .58 && gate.progress >= .58) {
      const dx = POST.phone.x - camera.position.x, dz = POST.phone.z - camera.position.z;
      const dy = POST.phone.y - camera.position.y, yaw = camera.rotation.y;
      const distance = Math.hypot(dx, dy, dz);
      callbacks.onPhoneRing?.((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance, distance);
    }
  }
  function updateFirstEncounter(dt) {
    const player = camera.position, key = layout.points.item;
    const events = advanceFirstEncounter(firstEncounter, dt, {
      collected, nearCabinet: Math.hypot(player.x - key.x, player.z - key.z) <= 5,
      sheltered: Math.abs(player.x) >= CELL / 2 + .30, playerZ: player.z,
    });
    const {phase, time} = firstEncounter;
    hazardPhase = phase === 'warning' || phase === 'patrol' ? phase : 'idle';
    hazardTime = 0;
    watcher.group.visible = phase === 'patrol';
    if (phase === 'patrol') {
      const z = FIRST_PATROL.origin + time * FIRST_PATROL.speed;
      watcher.group.position.set(Math.sin(time * 1.8) * .065, .016 * Math.sin(time * 4), z);
      for (const {pivot, sign} of watcher.limbs) pivot.rotation.x = sign * .29 * Math.sin(time * 4);
      warningLight.position.set(0, 3.05, z - 1.4);
      if (Math.abs(player.x) < CELL / 2 - .02 && Math.abs(z - player.z) < .84) {
        pause(); callbacks.onFail?.(); return;
      }
    }
    warningLight.intensity = phase === 'patrol' ? 2.1 : 0;
    facility.repair?.setPhase(phase, time);
    const messages = {
      warning: 'Щёлкнуло реле у ключницы. Лампа мигает. Укройтесь за открытой дверью ремонтной.',
      shadow: 'В матовом стекле прошла тень. Шаги приближаются по коридору.',
      patrol: firstEncounter.sheltered
        ? 'Обходчик проходит мимо. Оставайтесь за дверью и наблюдайте через окно.'
        : 'Обходчик в коридоре. Укройтесь в ремонтной и дождитесь, пока он пройдёт.',
      sheltered: 'Вы за дверью. Оставайтесь в комнате: Обходчик пройдёт мимо окна.',
      exposed: 'Вы вышли из укрытия. Обходчик ещё в коридоре.',
      passed: 'Шаги удалились и стихли. Можно выйти и продолжить сборку ключа.',
      waiting: 'Шаги стихли. Вернитесь к ключнице у ремонтной и переждите следующий обход в комнате.',
    };
    const dx = watcher.group.position.x - player.x, dz = watcher.group.position.z - player.z;
    const distance = Math.hypot(dx, dz, 1.3 - player.y);
    const pan = (dx * Math.cos(camera.rotation.y) - dz * Math.sin(camera.rotation.y)) / Math.max(.1, distance);
    for (const event of events) callbacks.onEncounter?.({phase: event, message: messages[event] || '',
      sheltered: firstEncounter.sheltered, pan, distance});
    if (events.includes('passed')) {
      nextHazard = 38;
      callbacks.onEncounterComplete?.();
    }
  }
  function updateHazard(dt) {
    // The checkpoint teaches inspection. The first danger begins at the key cabinet.
    if (layout.id <= 2) return;
    if (firstEncounter && firstEncounter.phase !== 'passed') {
      updateFirstEncounter(dt); return;
    }
    hazardTime += dt;
    if (hazardPhase === 'idle' && hazardTime >= nextHazard) {
      hazardPhase = 'warning'; hazardTime = 0;
      callbacks.onThreat?.('В дальнем конце щёлкнуло реле. Обходчик идёт по центральному коридору. Укройтесь в боковой комнате.');
    } else if (hazardPhase === 'warning' && hazardTime >= 6) {
      hazardPhase = 'patrol'; hazardTime = 0;
      watcher.group.visible = true;
    } else if (hazardPhase === 'patrol') {
      const z = patrolOrigin + hazardTime * 2.05;
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
    facility.repair?.setPhase(hazardPhase === 'idle' ? 'passed' : hazardPhase, hazardTime);
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
      updateGate(dt / steps); move(dt / steps); updateHazard(dt / steps);
    }
    const exitReady = layout.opening ? chapterState.relayReleased : layout.signalHouse && chapterState.exitReleased;
    if (exitReady && camera.position.z < EXIT_Z - .9) {
      callbacks.onChapterExit?.();
      return;
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
  function syncChapter(instant = false) {
    if (!facility.chapterScene) return;
    facility.chapterScene.apply(chapterCompleted, chapterState, layout.id, collected, instant);
    if (layout.signalHouse) {
      facility.item.visible = false;
      if (layout.id !== 11) layout.points.switchboard = SIGNAL_BOARD;
      return;
    }
    facility.item.visible = chapterCompleted < 1 && !(layout.id === 1 && collected);
    facility.checkpoint.looseHand.visible = chapterCompleted < 2 && !(layout.id === 2 && collected);
    facility.checkpoint.minuteHand.visible = chapterCompleted >= 2;
    delete layout.points.door;
    if (layout.id >= 3 && !chapterState.archiveOpen) layout.points.door = ARCHIVE_DOOR;
  }
  function start(mission, {encounterPassed = false, chapter = null, signals = null, completed = mission.id - 1} = {}) {
    if (disposed) return;
    pause(); clearLevel();
    layout = layoutFor(mission.id);
    chapterCompleted = completed;
    chapterState = layout.signalHouse ? restoreSignals(signals, completed) : restoreChapter(chapter, completed);
    firstEncounter = mission.id === 3 ? createFirstEncounter(encounterPassed) : null;
    facility = buildFacility(mission, layout);
    facility.repair?.setPhase(firstEncounter?.phase ?? 'passed', 0);
    watcher = buildWatcher(facility.mat); watcher.group.visible = false;
    scene.add(facility.group, watcher.group);
    const fog = new THREE.Color(0x262a24);
    scene.background = fog; scene.fog = new THREE.FogExp2(fog, .053);
    for (const light of fixtures) light.color.set(facility.colors[4]);
    const spawnZ = mission.id === 2 ? POST.spawnZ : mission.id === 3 ? -19.3 :
      mission.id <= 5 && mission.id > 3 ? -8.94 : mission.id <= 10 && mission.id > 5 ? -31.5 : .78;
    camera.position.set(0, EYE_HEIGHT, spawnZ); camera.rotation.set(-.012, 0, 0, 'YXZ');
    collected = false; walkTime = 0; stepTime = .28; roomTime = 0;
    hazardTime = 0; hazardPhase = 'idle'; warningLight.intensity = 0;
    patrolOrigin = layout.opening ? POST.spawnZ + 1.85 : layout.signalHouse ? -36.8 : -layout.end * CELL;
    nextHazard = 43 - layout.chapter; patrolLength = (1.75 - patrolOrigin) / 2.05;
    syncChapter(true);
    const pose = facility.chapterScene && chapterState.pose;
    if (pose && canStand(pose.x, pose.z) && facility.chapterScene.canRestorePose(pose) &&
        (!facility.checkpoint || facility.checkpoint.active || pose.z >= POST.gateZ)) {
      camera.position.set(pose.x, EYE_HEIGHT, pose.z);
      camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
    }
    setFocus(null); updateLights(); render(); resume();
  }
  function advanceChapter(mission, completed, chapter) {
    if (!facility.chapterScene || Math.floor((mission.id - 1) / 10) !== layout.chapter) return;
    layout = layoutFor(mission.id);
    chapterCompleted = completed;
    chapterState = layout.signalHouse ? restoreSignals(chapter, completed) : restoreChapter(chapter, completed);
    collected = false;
    firstEncounter = mission.id === 3 ? createFirstEncounter(false) : null;
    watcher.group.visible = false; warningLight.intensity = 0;
    hazardPhase = 'idle'; hazardTime = 0; nextHazard = 43;
    facility.repair?.setPhase(firstEncounter?.phase ?? 'passed', 0);
    syncChapter(); setFocus(null);
  }
  function advanceToClock(mission) {
    if (disposed || layout?.id !== 1 || mission.id !== 2) return;
    layout = layoutFor(2);
    chapterCompleted = 1;
    collected = false; facility.item.visible = false;
    facility.checkpoint.active = true;
    facility.checkpoint.setProgress(0);
    // The latch and telephone are one audible beat. Begin the next patrol on
    // the entry side after the player has had time to cross into the booth.
    watcher.group.visible = false; warningLight.intensity = 0;
    hazardPhase = 'idle'; hazardTime = 0; nextHazard = 43;
    syncChapter();
    setFocus(null);
  }
  return {
    start, advanceToClock, advanceChapter, pause, resume,
    applyChapter(chapter) {
      chapterState = layout.signalHouse ? restoreSignals(chapter, chapterCompleted) : restoreChapter(chapter, chapterCompleted);
      syncChapter();
    },
    getChapterPose(missionId = layout?.id) {
      if (!facility?.chapterScene || Math.floor((missionId - 1) / 10) !== layout.chapter) return null;
      return {x: camera.position.x, z: camera.position.z, yaw: camera.rotation.y, pitch: camera.rotation.x};
    },
    getEncounterStatus() { return firstEncounter?.phase ?? null; },
    interact() {
      if (life !== 'running') return null;
      updateFocus();
      const kind = focus;
      if (kind) callbacks.onInteract?.(kind);
      return kind;
    },
    setCollected(value) {
      collected = !!value;
      if (facility) {
        if (facility.chapterScene) syncChapter();
        else facility.item.visible = !collected;
      }
      if (focus === 'item' && collected) setFocus(null);
    },
    setFlashlight(value) { flashlight = !!value; beam.visible = flashlight; },
    setSensitivity(value) { if (Number.isFinite(value)) sensitivity = between(value, .12, 2.5); },
    setMove(x, forward) { manualMove.set(between(x, -1, 1), between(forward, -1, 1)); },
    getLocations() {
      if (!layout) return {};
      if (layout.id === 1) return {
        item: 'Приёмная, стол слева от центрального коридора',
        clue: 'Табличка слева у турникета № 2',
        station: 'Приёмник жетонов справа у турникета № 2',
      };
      if (layout.id === 2) return {
        item: 'Будка за турникетом, рабочий стол слева',
        clue: 'Самописец на правом столе в будке',
        station: 'Табельные часы в глубине будки, рядом с телефоном',
      };
      if (layout.id === 3) return {
        item: 'Ключница на левой стене коридора у открытой двери ремонтной',
        clue: 'Журнал слесаря на столе в глубине ремонтной',
        station: 'Сборочная оправка у входа в ремонтную',
      };
      if (CHAPTER_SITES[layout.id]) return {
        item: layout.id === 9 ? 'Открытый шкаф в приёмной' : CHAPTER_SITES[layout.id].room,
        clue: layout.id === 9 ? 'Запись у ночного звонка в будке' : CHAPTER_SITES[layout.id].room,
        station: layout.id === 9 ? 'Телефон в будке дежурного' : CHAPTER_SITES[layout.id].room,
      };
      if (layout.id === 17) return {
        item: 'Кабины связи', clue: 'Схема кросса в коридоре', station: 'Разделительный кросс в коридоре',
      };
      if (SIGNAL_SITES[layout.id]) return {
        item: layout.id === 18 ? 'Монтажная' : layout.id === 20 ? 'Телефонный архив' : SIGNAL_SITES[layout.id].room,
        clue: layout.id === 18 ? 'Журнал импульсов в коммутаторной' : layout.id === 20 ? 'Сводка у микшера в коридоре' : SIGNAL_SITES[layout.id].room,
        station: layout.id === 18 ? 'Телефонный диск у двери архива' : layout.id === 20 ? 'Микшер перед выходом' : SIGNAL_SITES[layout.id].room,
      };
      return {item: layout.rooms[layout.itemRoom].title, clue: layout.rooms[layout.clueRoom].title, station: 'Пост в торце центрального коридора'};
    },
    dispose() {
      if (disposed) return;
      pause(); disposed = true; events.abort(); clearLevel();
      renderer?.dispose(); canvas.remove();
    },
  };
}
