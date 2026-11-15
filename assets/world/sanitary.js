import * as THREE from '../../vendor/three.module.min.js';
import {missions} from '../../campaign.js';
import {restoreChapterPose} from './chapter.js';
import {buildAccess} from './access.js';
import {labelMaterial} from './surfaces.js';

export const SPIRO_RECORDS = [
  {name: 'А', peaks: [0, 3, 6, 9]},
  {name: 'Б', peaks: [0, 3, 7, 10]},
  {name: 'В', peaks: [0, 4, 8, 12]},
];
export const NINA_RECORD = 1;
export const SPIRO_END = 12;
export const SANITARY_SITES = {
  41: {
    item: {x: -4.5, y: 1.06, z: -6.3},
    clue: {x: -3.4, y: 1.38, z: -11.7},
    station: {x: -6.5, y: 1.3, z: -11.6},
    room: 'Приёмная',
  },
  42: {
    item: {x: 6.8, y: 1.06, z: -6.2},
    clue: {x: 10.3, y: 1.38, z: -11.6},
    station: {x: 6, y: 1.4, z: -11.6},
    room: 'Палата 7',
  },
  43: {
    item: {x: 10, y: 1.06, z: -6.3},
    clue: {x: 4.5, y: 1.38, z: -6.4},
    station: {x: 10.5, y: 1.3, z: -9},
    room: 'Палата 7',
  },
  44: {
    item: {x: -4.2, y: 1.06, z: -21.1},
    clue: {x: -10.4, y: 1.38, z: -25.8},
    station: {x: -4.7, y: 1.3, z: -25.7},
    room: 'Процедурная',
  },
  45: {
    item: {x: -10.3, y: 1.06, z: -21.1},
    clue: {x: -7, y: 1.38, z: -25.8},
    station: {x: -7.5, y: 1.3, z: -21.2},
    room: 'Процедурная',
  },
  46: {
    item: {x: -4.2, y: 1.06, z: -21.1},
    clue: {x: -9.5, y: 1.38, z: -24},
    station: {x: -10.1, y: 1.3, z: -25.7},
    room: 'Процедурная',
  },
  47: {
    item: {x: 4.5, y: 1.06, z: -21.1},
    clue: {x: 7.5, y: 1.38, z: -25.8},
    station: {x: 4.7, y: 1.3, z: -25.7},
    room: 'Изолятор',
  },
  48: {
    item: {x: 7.5, y: 1.06, z: -21.1},
    clue: {x: 3.1, y: 1.38, z: -21.3},
    station: {x: 7.6, y: 1.3, z: -23.6},
    room: 'Изолятор',
  },
  49: {
    item: {x: 7.5, y: 1.06, z: -21.1},
    clue: {x: 6.3, y: 1.38, z: -25.9},
    station: {x: 6, y: 1.3, z: -21.2},
    room: 'Изолятор / ящик личной карты',
  },
  50: {
    item: {x: 7.5, y: 1.06, z: -21.1},
    clue: {x: -1.3, y: 1.38, z: -37.2},
    station: {x: 0, y: 1.3, z: -39.1},
    room: 'Изолятор / пневмопочта у выхода',
  },
};

const tick = (value) => Number.isInteger(value) && value >= 0 && value <= SPIRO_END;
export function restoreSanitary(raw, completed) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  const marks = SPIRO_RECORDS.map((record, i) =>
    Array.isArray(saved.marks?.[i])
      ? [...new Set(saved.marks[i].filter((value) => record.peaks.includes(value)))].sort(
          (a, b) => a - b,
        )
      : [],
  );
  if (completed >= 42) marks[NINA_RECORD] = [...SPIRO_RECORDS[NINA_RECORD].peaks];
  return {
    selected:
      Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < 3
        ? saved.selected
        : completed >= 42
          ? NINA_RECORD
          : 0,
    positions: [0, 1, 2].map((i) => (tick(saved.positions?.[i]) ? saved.positions[i] : 0)),
    marks,
    exitReleased: completed >= 50 || (completed >= 49 && saved.exitReleased === true),
    pose: restoreChapterPose(saved.pose),
  };
}

export function operateSpiro(state, action, value) {
  const next = {...state, positions: [...state.positions], marks: state.marks.map((m) => [...m])};
  if (action === 'select' && Number.isInteger(value) && value >= 0 && value < 3)
    next.selected = value;
  const index = next.selected;
  if (action === 'seek' && tick(value)) next.positions[index] = value;
  if (action === 'step' && (value === 1 || value === -1))
    next.positions[index] = Math.max(0, Math.min(SPIRO_END, next.positions[index] + value));
  if (
    action === 'mark' &&
    SPIRO_RECORDS[index].peaks.includes(next.positions[index]) &&
    !next.marks[index].includes(next.positions[index])
  )
    next.marks[index].push(next.positions[index]);
  if (action === 'clear') next.marks[index] = [];
  next.marks[index].sort((a, b) => a - b);
  return next;
}
export const spiroIntervals = (marks) => marks.slice(1).map((value, i) => value - marks[i]);
export function spiroIssue(state) {
  if (state.marks[state.selected].length !== 4)
    return 'Отметьте четыре вдоха на выбранной ленте, чтобы измерить три интервала.';
  if (
    state.selected !== NINA_RECORD ||
    spiroIntervals(state.marks[state.selected]).join(',') !== '3,4,3'
  )
    return 'На этой полосе интервалы одинаковы. У Нины они меняются: 3, 4, 3 секунды.';
  return null;
}

// Fictional recorder traces are authored puzzle evidence, not medical data.
export function breathTrace(time, peaks) {
  return peaks.reduce(
    (sum, peak) =>
      sum +
      Math.exp(-(((time - peak) / 0.19) ** 2)) -
      0.32 * Math.exp(-(((time - peak - 0.42) / 0.27) ** 2)),
    0,
  );
}
export function paintSpirogram(c, state, width, height, found = false) {
  const index = state.selected,
    record = SPIRO_RECORDS[index],
    marks = state.marks[index];
  const X = (t) => width * (0.065 + (0.87 * t) / SPIRO_END);
  c.fillStyle = '#d7d1b0';
  c.fillRect(0, 0, width, height);
  c.strokeStyle = '#a9b597';
  c.lineWidth = 1;
  for (let i = 0; i <= 48; i++) {
    const x = X(i / 4);
    c.beginPath();
    c.moveTo(x, height * 0.18);
    c.lineTo(x, height * 0.86);
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const y = height * (0.18 + i * 0.06);
    c.beginPath();
    c.moveTo(width * 0.04, y);
    c.lineTo(width * 0.96, y);
    c.stroke();
  }
  c.fillStyle = '#254639';
  c.font = 'bold ' + Math.round(height * 0.065) + 'px monospace';
  c.fillText('ПОЛОСА ' + record.name, width * 0.055, height * 0.11);
  const wave = (peaks, base, amplitude) => {
    c.strokeStyle = '#284d3d';
    c.lineWidth = Math.max(2, width * 0.003);
    c.beginPath();
    for (let i = 0; i <= width; i++) {
      const t = -0.3 + ((SPIRO_END + 0.6) * i) / width,
        x = X(t),
        y = base - breathTrace(t, peaks) * amplitude;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  };
  wave(record.peaks, height * 0.38, height * 0.15);
  wave([0, 3, 6, 9, 12], height * 0.71, height * 0.09);
  c.font = Math.round(height * 0.04) + 'px monospace';
  c.fillStyle = '#31503b';
  c.fillText('КОНТРОЛЬ АППАРАТА', width * 0.055, height * 0.58);
  for (let t = 0; t <= SPIRO_END; t += 2) {
    c.fillText(String(t), X(t) - width * 0.006, height * 0.95);
  }
  c.strokeStyle = '#a65536';
  c.lineWidth = Math.max(2, width * 0.004);
  c.beginPath();
  c.moveTo(X(state.positions[index]), height * 0.18);
  c.lineTo(X(state.positions[index]), height * 0.84);
  c.stroke();
  marks.forEach((t) => {
    c.fillStyle = '#a65536';
    c.beginPath();
    c.arc(X(t), height * 0.2, width * 0.009, 0, Math.PI * 2);
    c.fill();
  });
  if (found) {
    c.fillStyle = '#31573d';
    c.font = 'bold ' + Math.round(height * 0.044) + 'px monospace';
    c.fillText('НИНА / 3—4—3', width * 0.52, height * 0.11);
  }
}

export function buildSanitaryFloor({
  group,
  mat,
  box,
  round,
  plane,
  block,
  mesh,
  sign,
  solid,
  at,
  table,
}) {
  const items = new Map(),
    stations = new Map();
  const access = buildAccess(
    {group, mat, box, block, sign, solid},
    [
      ['ward', 1.95, -8.94, 41, 'ПАЛАТА 7 / ЖУРНАЛ НАБЛЮДЕНИЙ'],
      ['procedure', -1.95, -23.54, 43, 'ПРОЦЕДУРНАЯ / ТЕМПЕРАТУРНЫЙ ЛИСТ'],
      ['isolation', 1.95, -23.54, 46, 'ИЗОЛЯТОР / ДОПУСК ЛИДИИ'],
    ],
    {
      exitTitle: 'МАКЕТНЫЙ ЦЕХ',
      exitSubtitle: 'ВЫХОД С САНИТАРНОГО ЭТАЖА',
      exitRequired: 50,
      accessLabel: 'ЖУРНАЛ ДОПУСКА',
    },
  );
  const add = (parent, material, x, y, z, w, h, d, geometry = box) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    parent.add(object);
    return object;
  };
  const labels = {
    41: 'ЖУРНАЛ ЛИДИИ СЕРГЕЕВНЫ',
    43: 'ТАМБУР / 8°',
    44: 'КОПИЯ ОПОЗНАНА',
    45: '03:15:10',
    46: 'ЦЕХ',
    47: 'НИНА ВЫШЛА НАРУЖУ',
    48: 'ШИНА Б ОТКЛЮЧЕНА',
    49: 'ВЕРА / ПЛЕМЯННИЦА',
    50: 'КЛЮЧ ОТ ЭКСПОЗИЦИИ',
  };
  for (const [textId, site] of Object.entries(SANITARY_SITES)) {
    const id = Number(textId),
      mission = missions[id - 1],
      p = site.item,
      s = site.station;
    if (![46, 49, 50].includes(id)) at(p.x, p.z, 0, table);
    const item = new THREE.Group();
    item.position.set(p.x, p.y, p.z);
    group.add(item);
    if (id === 41) {
      add(item, mat.paper, 0, 0.04, 0, 0.09, 0.08, 0.27);
      add(item, mat.zinc, 0, 0.02, 0, 0.25, 0.04, 0.055);
    } else if ([42, 49, 50].includes(id)) {
      add(item, mat.paper, 0, 0.02, 0, 0.34, 0.045, 0.24);
      add(item, mat.dark, 0, 0.05, 0, 0.2, 0.015, 0.08);
    } else if (id === 45) {
      add(item, mat.zinc, 0, 0.07, 0, 0.25, 0.11, 0.25, round);
      add(item, mat.paper, 0, 0.13, 0, 0.2, 0.02, 0.2, round);
    } else {
      add(item, mat.zinc, 0, 0.035, 0, 0.34, 0.06, 0.18);
      add(item, mat.dark, 0, 0.08, 0, 0.17, 0.03, 0.1);
    }
    items.set(id, item);
    block(mat.dark, site.clue.x, site.clue.y, site.clue.z - 0.04, 0.9, 0.64, 0.07);
    sign(
      'ЗАПИСЬ ЛИДИИ СЕРГЕЕВНЫ',
      mission.clue,
      site.clue.x,
      site.clue.y,
      site.clue.z,
      0.86,
      0.6,
      0,
      'paper',
    );
    const special = id === 41 || id === 42,
      width = id === 42 ? 1.9 : 1.3;
    if (id !== 41) {
      block(mat.paint, s.x, 0.56, s.z - 0.18, width, 1.12, 0.65);
      solid(s.x, s.z - 0.18, width, 0.65);
      block(mat.steel, s.x, 1.15, s.z - 0.12, width + 0.1, 0.08, 0.8);
    }
    sign(
      mission.station.toUpperCase(),
      'САНИТАРНЫЙ ЭТАЖ / ' + id,
      s.x,
      id === 41 ? 2.6 : 2.27,
      s.z - 0.12,
      width + 0.45,
      0.35,
    );
    const face = special ? null : new THREE.MeshBasicMaterial({color: 0xa57e58});
    if (!special) mesh(plane, face, s.x, s.y, s.z + 0.21, 0.98, 0.4, 1);
    const changed = new THREE.Group();
    changed.position.set(s.x, s.y, s.z + 0.29);
    group.add(changed);
    if (!special)
      add(
        changed,
        labelMaterial(labels[id], 'ЗАПИСЬ СОХРАНЕНА', 'screen'),
        0,
        0,
        0.02,
        0.96,
        0.36,
        1,
        plane,
      );
    changed.visible = false;
    stations.set(id, {point: s, label: mission.station, face, changed});
  }
  const cabinet = new THREE.Group(),
    cabinetDoor = new THREE.Group();
  cabinet.position.set(-6.5, 0, -11.9);
  group.add(cabinet);
  solid(-6.5, -11.9, 1.25, 0.55);
  add(cabinet, mat.dark, 0, 1.1, 0, 1.25, 2.2, 0.55);
  cabinetDoor.position.set(-0.625, 0, 0.3);
  cabinet.add(cabinetDoor);
  add(cabinetDoor, mat.paper, 0.625, 1.1, 0, 1.25, 2.2, 0.07);
  add(
    cabinetDoor,
    labelMaterial('○', 'НАБЛЮДЕНИЯ', 'paper'),
    0.625,
    1.55,
    0.045,
    0.65,
    0.4,
    1,
    plane,
  );
  const doctorJournal = add(cabinet, mat.paper, 0, 1.05, 0.15, 0.55, 0.08, 0.32);
  const s = SANITARY_SITES[42].station,
    canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 560;
  const spiroTexture = new THREE.CanvasTexture(canvas);
  spiroTexture.colorSpace = THREE.SRGBColorSpace;
  mesh(plane, new THREE.MeshBasicMaterial({map: spiroTexture}), s.x, 1.5, s.z + 0.23, 1.8, 1.0, 1);
  stations.get(42).texture = spiroTexture;
  const roller = new THREE.Group();
  roller.position.set(s.x, 1.13, s.z + 0.32);
  group.add(roller);
  const rollerBody = add(roller, mat.zinc, 0, 0, 0, 0.1, 1.85, 0.1, round);
  rollerBody.rotation.z = Math.PI / 2;
  const rollerMark = add(roller, mat.dark, 0.78, 0.07, 0, 0.16, 0.03, 0.07);
  const pen = new THREE.Group();
  pen.position.set(s.x, 1.5, s.z + 0.28);
  group.add(pen);
  add(pen, mat.steel, 0, 0.17, 0, 0.017, 0.42, 0.025);
  add(pen, mat.rust, 0, -0.05, 0.025, 0.055, 0.035, 0.04);
  const stamp = add(
    group,
    labelMaterial('НИНА / 3—4—3', 'ЗАПИСЬ НАЙДЕНА', 'paper'),
    s.x,
    1.0,
    s.z + 0.35,
    1.2,
    0.3,
    1,
    plane,
  );
  const drum = new THREE.Group();
  drum.position.set(-10.1, 1.57, -25.75);
  group.add(drum);
  add(drum, mat.glass, 0, 0, 0, 0.5, 0.48, 0.5, round);
  const drumText = add(drum, labelMaterial('ЦЦЕЕХХ', '', 'paper'), 0, 0, 0.28, 0.6, 0.24, 1, plane);
  const decoded = add(
    group,
    labelMaterial('ЦЕХ', 'ПОСЛАНИЕ ДЛЯ ВЕРЫ', 'paper'),
    -10.1,
    1.7,
    -25.42,
    0.65,
    0.3,
    1,
    plane,
  );
  const bed = new THREE.Group();
  bed.position.set(5.5, 0, -23.2);
  group.add(bed);
  solid(5.5, -23.2, 1.3, 1.6);
  add(bed, mat.steel, 0, 0.44, 0, 1.3, 0.06, 1.6);
  add(bed, mat.paper, 0, 0.58, 0, 1.2, 0.2, 1.48);
  add(bed, mat.paper, 0, 0.73, -0.48, 0.8, 0.12, 0.4);
  for (const x of [-0.58, 0.58])
    for (const z of [-0.71, 0.71]) add(bed, mat.steel, x, 0.25, z, 0.05, 0.5, 0.05);
  const pulseCanvas = document.createElement('canvas');
  pulseCanvas.width = 640;
  pulseCanvas.height = 200;
  const pulseTexture = new THREE.CanvasTexture(pulseCanvas);
  pulseTexture.colorSpace = THREE.SRGBColorSpace;
  mesh(plane, new THREE.MeshBasicMaterial({map: pulseTexture}), 7.6, 1.65, -23.3, 0.98, 0.35, 1);
  const pulseLamp = new THREE.MeshBasicMaterial({color: 0xc17e51});
  block(pulseLamp, 7.95, 1.98, -23.3, 0.08, 0.08, 0.06);
  const drawer = new THREE.Group();
  drawer.position.set(7.5, 0.68, -21.1);
  group.add(drawer);
  add(drawer, mat.paper, 0, 0, -0.1, 1.1, 0.38, 0.3);
  add(drawer, mat.zinc, 0, 0, 0.07, 0.27, 0.04, 0.05);
  const projection = new THREE.Group();
  group.add(projection);
  add(
    projection,
    labelMaterial('ПОРОГ → СТЕКЛО → ПОРУЧЕНЬ', 'НИНА ВЫШЛА НАРУЖУ', 'screen'),
    3.8,
    1.8,
    -26.2,
    1.2,
    0.7,
    1,
    plane,
  );
  const tube = new THREE.Group();
  tube.position.set(0, 0, -39.1);
  group.add(tube);
  add(tube, mat.zinc, 0.55, 2.5, -0.15, 0.17, 1.5, 0.17, round);
  const dispatchKey = new THREE.Group();
  dispatchKey.position.set(0, 1.2, -38.77);
  group.add(dispatchKey);
  add(dispatchKey, mat.zinc, 0, 0, 0, 0.35, 0.045, 0.045);
  add(dispatchKey, mat.zinc, -0.14, 0, 0, 0.06, 0.04, 0.12);
  let spiroKey = '',
    pulseKey = null;
  function drawRecord(state, completed) {
    const key = JSON.stringify([completed >= 42, state.selected, state.positions, state.marks]);
    if (key === spiroKey) return;
    spiroKey = key;
    paintSpirogram(
      canvas.getContext('2d'),
      state,
      canvas.width,
      canvas.height,
      completed >= 42 && state.selected === NINA_RECORD,
    );
    spiroTexture.needsUpdate = true;
    const fraction = state.positions[state.selected] / SPIRO_END;
    roller.rotation.x = fraction * Math.PI * 4;
    rollerMark.rotation.x = fraction * Math.PI * 4;
    pen.position.x = s.x - 0.78 + fraction * 1.56;
  }
  function drawPulse(done) {
    if (pulseKey === done) return;
    pulseKey = done;
    const c = pulseCanvas.getContext('2d');
    c.fillStyle = '#1c3427';
    c.fillRect(0, 0, 640, 200);
    c.strokeStyle = '#a5c28e';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x < 640; x++) {
      const t = ((x / 640) * 4) % 1,
        y =
          100 -
          (done
            ? 0
            : Math.exp(-(((t - 0.3) / 0.025) ** 2)) * 65 -
              Math.exp(-(((t - 0.36) / 0.03) ** 2)) * 25);
      if (x) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
    pulseTexture.needsUpdate = true;
  }
  return {
    ...access,
    items,
    stations,
    sanitaryWing: true,
    spiroTexture,
    pulseTexture,
    cabinetDoor,
    doctorJournal,
    roller,
    pen,
    decoded,
    drawer,
    pulseLamp,
    projection,
    dispatchKey,
    completed: 40,
    apply(completed, state, mission, collected, instant = false) {
      this.completed = completed;
      access.apply(completed, state.exitReleased, instant);
      for (const [id, item] of items) item.visible = id === mission && !collected;
      for (const [id, station] of stations) {
        const done = completed >= id || (id === 50 && state.exitReleased);
        station.changed.visible = done;
        station.face?.color.setHex(done ? 0xa8cf85 : 0xa57e58);
      }
      cabinetDoor.rotation.y = completed >= 41 ? -Math.PI * 0.6 : 0;
      doctorJournal.visible = completed >= 41;
      stamp.visible = completed >= 42;
      drawRecord(state, completed);
      drum.rotation.y = completed >= 46 ? Math.PI : 0;
      drumText.visible = completed < 46;
      decoded.visible = completed >= 46;
      projection.visible = completed >= 47;
      drawPulse(completed >= 48);
      pulseLamp.color.setHex(completed >= 48 ? 0x24362a : 0xc17e51);
      drawer.position.z = completed >= 48 ? -20.82 : -21.1;
      dispatchKey.visible = state.exitReleased;
    },
  };
}
