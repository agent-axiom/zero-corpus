import * as THREE from '../../vendor/three.module.min.js';
import {missions} from '../../campaign.js';
import {restoreChapterPose} from './chapter.js';
import {buildAccess} from './access.js';
import {labelMaterial} from './surfaces.js';

export const WATER_MODES = [31, 32, 34, 35, 38];
export const WATER_VALVES = ['забор', 'обход', 'слив'];
export const WATER_SLOTS = ['Верх', 'Право', 'Низ', 'Лево'];
export const WATER_CHANNELS = {А: [8, 6, 3], Б: [8, 4, 5], В: [8, 9, 1]};
export const WATER_SITES = {
  31: {
    item: {x: -4.8, y: 1.06, z: -6.3},
    clue: {x: -5.1, y: 1.38, z: -11.8},
    station: {x: -7.5, y: 1.4, z: -11.7},
    room: 'Насосная',
  },
  32: {
    item: {x: -7.5, y: 1.06, z: -6.3},
    clue: {x: -3.1, y: 1.38, z: -9.6},
    station: {x: -10.3, y: 1.4, z: -11.7},
    room: 'Насосная',
  },
  33: {
    item: {x: 5, y: 1.06, z: -10},
    clue: {x: 7.6, y: 1.38, z: -15.5},
    station: {x: 4.7, y: 1.3, z: -15.3},
    room: 'Фильтровальная',
  },
  34: {
    item: {x: 7.5, y: 1.06, z: -10.1},
    clue: {x: 4, y: 1.38, z: -10},
    station: {x: 7.4, y: 1.4, z: -13.4},
    room: 'Фильтровальная',
  },
  35: {
    item: {x: -4.1, y: 1.06, z: -8.8},
    clue: {x: -10.3, y: 1.38, z: -6.3},
    station: {x: -7.5, y: 1.4, z: -8.6},
    room: 'Насосная / ручной насос',
  },
  36: {
    item: {x: -4.5, y: 1.06, z: -21},
    clue: {x: -3.1, y: 1.38, z: -25.9},
    station: {x: -4.8, y: 1.3, z: -25.7},
    room: 'Мастерская',
  },
  37: {
    item: {x: -7.5, y: 1.06, z: -21},
    clue: {x: -3.3, y: 1.38, z: -21},
    station: {x: -7.5, y: 1.3, z: -23.8},
    room: 'Мастерская',
  },
  38: {
    item: {x: 10, y: 1.06, z: -25},
    clue: {x: 6.4, y: 1.38, z: -29.8},
    station: {x: 10.3, y: 1.4, z: -29.8},
    room: 'Дренаж',
  },
  39: {
    item: {x: 6.2, y: 1.06, z: -25},
    clue: {x: 9.3, y: 1.38, z: -26.8},
    station: {x: 6.1, y: 1.3, z: -29.8},
    room: 'Дренаж / сушильный стол',
  },
  40: {
    item: {x: 6.2, y: 1.06, z: -25},
    clue: {x: -1.4, y: 1.38, z: -37.3},
    station: {x: 0, y: 1.3, z: -39.1},
    room: 'Дренаж / самописец у выхода',
  },
};

const integer = (value, min, max, fallback) =>
  Number.isInteger(value) && value >= min && value <= max ? value : fallback;
export function restoreWater(raw, completed) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  return {
    risers:
      completed >= 31
        ? [true, false, false, false]
        : [0, 1, 2, 3].map((i) => saved.risers?.[i] === true),
    equalizer: completed >= 32 ? 2 : integer(saved.equalizer, 0, 4, 0),
    channel:
      completed >= 34
        ? 'А'
        : typeof saved.channel === 'string' && Object.hasOwn(WATER_CHANNELS, saved.channel)
          ? saved.channel
          : null,
    pumpSlot: completed >= 35 ? 2 : integer(saved.pumpSlot, 0, 3, 0),
    valveOrder:
      completed >= 38
        ? [...WATER_VALVES]
        : Array.isArray(saved.valveOrder)
          ? [...new Set(saved.valveOrder.filter((v) => WATER_VALVES.includes(v)))]
          : [],
    exitReleased: completed >= 40 || (completed >= 39 && saved.exitReleased === true),
    pose: restoreChapterPose(saved.pose),
  };
}

// Every input changes the hydraulic configuration; committing a mission is a
// separate action. Closing a sheet or reloading never counts as a solution.
export function operateWater(state, action, value) {
  const next = {...state, risers: [...state.risers], valveOrder: [...state.valveOrder]};
  if (action === 'riser' && Number.isInteger(value) && value >= 0 && value < 4)
    next.risers[value] = !next.risers[value];
  if (action === 'transfer' && (value === 1 || value === -1))
    next.equalizer = Math.max(0, Math.min(4, next.equalizer + value));
  if (action === 'channel' && typeof value === 'string' && Object.hasOwn(WATER_CHANNELS, value))
    next.channel = value;
  if (action === 'pump' && (value === 1 || value === -1))
    next.pumpSlot = (next.pumpSlot + value + 4) % 4;
  if (action === 'valve' && WATER_VALVES.includes(value) && !next.valveOrder.includes(value))
    next.valveOrder.push(value);
  if (action === 'reset-valves') next.valveOrder = [];
  return next;
}

export function waterIssue(mode, state) {
  if (mode === 31) {
    if (state.risers.filter(Boolean).length !== 1)
      return 'Откройте ровно один стояк: лишние линии унесут бумагу.';
    if (!state.risers[0])
      return 'Эта линия не соответствует старому четвёртому стояку. Сверьте перенумерацию с уликой.';
  } else if (mode === 32 && state.equalizer !== 2)
    return (
      'Давление различается: слева ' +
      (6 - state.equalizer) +
      ', справа ' +
      (2 + state.equalizer) +
      '. Переведите деления уравнителем.'
    );
  else if (mode === 34) {
    if (!state.channel) return 'Откройте один канал на распределителе.';
    const heights = WATER_CHANNELS[state.channel];
    if (heights.some((v, i) => i > 0 && v >= heights[i - 1]))
      return 'На этом пути есть подъём. Самотёк остановится; нужен непрерывный уклон.';
  } else if (mode === 35 && state.pumpSlot !== 2)
    return 'Метка ещё не совпала. От верхнего паза отсчитайте два по часовой стрелке.';
  else if (mode === 38 && state.valveOrder.join(',') !== WATER_VALVES.join(','))
    return 'Маршрут не готов. Закройте группу и откройте забор, обход и слив в порядке, указанном на клапанах.';
  else if (!WATER_MODES.includes(mode)) return 'Этот прибор не относится к клапанной группе.';
  return null;
}

export function buildWaterWorks({
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
    stations = new Map(),
    panels = new Map();
  const access = buildAccess(
    {group, mat, box, block, sign, solid},
    [
      ['filters', 1.95, -12.59, 32, 'ФИЛЬТРОВАЛЬНАЯ / ДАВЛЕНИЕ'],
      ['workshop', -1.95, -23.54, 35, 'МАСТЕРСКАЯ / СУХОЙ ПОРОГ'],
      ['drain', 1.95, -27.19, 37, 'ДРЕНАЖ / ЛЮК ЗАДЕРЖКИ'],
    ],
    {
      exitTitle: 'САНИТАРНЫЙ ЭТАЖ',
      exitSubtitle: 'ВЫХОД ИЗ ВОДОМЕРНОГО УЗЛА',
      exitRequired: 40,
      accessLabel: 'ВОДОМЕРНЫЙ ДОПУСК',
    },
  );
  const torus = new THREE.TorusGeometry(0.19, 0.026, 6, 18);
  const add = (parent, material, x, y, z, w, h, d, geometry = box) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    parent.add(object);
    return object;
  };
  const wheel = (parent, x, y, z) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    parent.add(pivot);
    add(pivot, mat.rust, 0, 0, 0, 1, 1, 1, torus);
    add(pivot, mat.rust, 0, 0, 0, 0.035, 0.36, 0.04);
    add(pivot, mat.rust, 0, 0, 0, 0.36, 0.035, 0.04);
    add(pivot, mat.paper, 0, 0.17, 0.03, 0.06, 0.035, 0.02);
    return pivot;
  };
  const labels = {
    33: 'СЕТКА 2 мм',
    36: 'ЗАЖИМ Л. С.',
    37: '3 МИНУТЫ',
    39: 'НИНА КРЫЛОВА',
    40: 'ПОСТОРОННИЙ УДАР / 5 с',
  };
  for (const [textId, site] of Object.entries(WATER_SITES)) {
    const id = Number(textId),
      mission = missions[id - 1],
      p = site.item,
      s = site.station;
    if (id !== 40) at(p.x, p.z, 0, table);
    const item = new THREE.Group();
    item.position.set(p.x, p.y, p.z);
    group.add(item);
    if ([31, 33, 36].includes(id)) {
      const ring = add(item, mat.zinc, 0, 0.06, 0, 0.6, 0.6, 0.6, torus);
      ring.rotation.x = Math.PI / 2;
    } else if (id === 39) add(item, mat.glass, 0, 0.04, 0, 0.4, 0.04, 0.3);
    else {
      add(item, mat.zinc, 0, 0.035, 0, 0.34, 0.065, 0.21);
      add(item, mat.dark, 0, 0.075, 0, 0.22, 0.03, 0.1);
    }
    items.set(id, item);
    block(mat.dark, site.clue.x, site.clue.y, site.clue.z - 0.04, 0.9, 0.64, 0.07);
    sign(
      'ЗАПИСЬ ВОДОМЕРЩИКА',
      mission.clue,
      site.clue.x,
      site.clue.y,
      site.clue.z,
      0.86,
      0.6,
      0,
      'paper',
    );
    const special = WATER_MODES.includes(id),
      width = id === 31 ? 2.25 : 1.35;
    block(mat.paint, s.x, 0.56, s.z - 0.18, width, 1.12, 0.65);
    solid(s.x, s.z - 0.18, width, 0.65);
    block(mat.steel, s.x, 1.15, s.z - 0.12, width + 0.1, 0.08, 0.8);
    sign(
      mission.station.toUpperCase(),
      'ВОДОМЕРНЫЙ УЗЕЛ / ' + id,
      s.x,
      2.3,
      s.z - 0.12,
      width + 0.4,
      0.36,
    );
    const changed = new THREE.Group();
    changed.position.set(s.x, s.y, s.z + 0.31);
    group.add(changed);
    const face = special ? null : new THREE.MeshBasicMaterial({color: 0xa57e58});
    let texture = null;
    if (special) {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 560;
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({map: texture});
      mesh(plane, material, s.x, 1.61, s.z + 0.2, width - 0.12, 0.82, 1);
      panels.set(id, {canvas, texture, wheels: [], key: ''});
    } else {
      mesh(plane, face, s.x, s.y, s.z + 0.21, 0.98, 0.4, 1);
      add(
        changed,
        labelMaterial(labels[id], 'ПРОТОКОЛ СОХРАНЁН', 'screen'),
        0,
        0,
        0.02,
        0.96,
        0.36,
        1,
        plane,
      );
    }
    changed.visible = false;
    stations.set(id, {point: s, label: mission.station, face, changed, texture});
  }
  // The same valve configuration drives the close-up diagram, these physical
  // wheels, and the fallback renderer's instrument faces.
  for (const id of WATER_MODES) {
    const s = WATER_SITES[id].station,
      panel = panels.get(id),
      rack = new THREE.Group();
    rack.position.set(s.x, 0, s.z + 0.27);
    group.add(rack);
    const count = id === 31 ? 4 : id === 38 ? 3 : id === 34 ? 3 : 1;
    const spacing = id === 31 ? 0.45 : 0.37;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spacing;
      block(mat.rust, s.x + x, 2.04, s.z + 0.12, 0.065, 0.25, 0.065);
      panel.wheels.push(wheel(rack, x, 1.02, 0.03));
    }
  }
  // Ceiling pipes distinguish the wet sector without obstructing the path.
  for (const x of [-1.5, 1.5]) {
    block(mat.rust, x, 2.97, -23, 0.1, 0.1, 36);
    for (const z of [-8, -16, -24, -32]) block(mat.zinc, x, 2.97, z, 0.18, 0.18, 0.055);
  }
  const floodMaterial = new THREE.MeshBasicMaterial({
    color: 0x446c69,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const flood = add(group, floodMaterial, 0, 0.018, -23.8, 3.2, 10, 1, plane);
  flood.rotation.x = -Math.PI / 2;
  const footprints = new THREE.Group();
  group.add(footprints);
  for (let i = 0; i < 10; i++)
    add(footprints, mat.dark, i % 2 ? 0.17 : -0.17, 0.024, -24 - i * 0.52, 0.12, 0.008, 0.28);
  const well = add(group, mat.dark, -10.3, 0.025, -9.25, 0.86, 0.86, 1, plane);
  well.rotation.x = -Math.PI / 2;
  const hatch = new THREE.Group();
  hatch.position.set(-10.3, 0.04, -8.8);
  group.add(hatch);
  add(hatch, mat.door, 0, 0, -0.45, 0.9, 0.07, 0.9);
  add(hatch, mat.zinc, 0, 0.06, -0.7, 0.28, 0.04, 0.06);
  const tank = new THREE.Group();
  tank.position.set(-6.7, 0, -25.8);
  group.add(tank);
  solid(-6.7, -25.8, 0.85, 0.75);
  add(tank, mat.dark, 0, 0.7, 0, 0.85, 1.4, 0.75);
  const waterLevel = add(
    tank,
    new THREE.MeshBasicMaterial({color: 0x78a3a0}),
    0,
    0.65,
    0.39,
    0.6,
    0.85,
    0.02,
  );
  add(tank, labelMaterial('9 → 3 л', 'БАК ЗАДЕРЖКИ', 'sign'), 0, 1.7, 0.4, 0.9, 0.28, 1, plane);
  const firstFragment = add(group, mat.paper, 4.7, 1.2, -14.98, 0.2, 0.07, 0.03);
  const secondFragment = add(group, mat.paper, 10.3, 1.2, -29.48, 0.22, 0.08, 0.03);
  const talon = add(
    stations.get(39).changed,
    labelMaterial('НИНА КРЫЛОВА', 'ВЫХОДНОЙ ТАЛОН', 'paper'),
    0,
    -0.45,
    0.1,
    0.65,
    0.28,
    1,
    plane,
  );
  const clamp = add(stations.get(36).changed, mat.zinc, 0, -0.45, 0.15, 0.35, 0.04, 0.06);
  let flooded = true;
  function drawPanel(id, state, completed) {
    const panel = panels.get(id),
      values =
        id === 31
          ? state.risers
          : id === 32
            ? [6 - state.equalizer, 2 + state.equalizer]
            : id === 34
              ? [state.channel]
              : id === 35
                ? [state.pumpSlot]
                : state.valveOrder;
    const key = JSON.stringify([completed >= id, values]);
    if (panel.key === key) return;
    panel.key = key;
    const c = panel.canvas.getContext('2d');
    c.fillStyle = '#213c36';
    c.fillRect(0, 0, 960, 560);
    c.strokeStyle = '#93aaa0';
    c.lineWidth = 5;
    c.strokeRect(10, 10, 940, 540);
    c.fillStyle = '#dfd8b8';
    c.font = 'bold 38px monospace';
    c.fillText(
      id === 31
        ? 'КОЛЛЕКТОР СТОЯКОВ'
        : id === 32
          ? 'УРАВНИТЕЛЬ'
          : id === 34
            ? 'САМОТЁК'
            : id === 35
              ? 'РУЧНОЙ НАСОС'
              : 'ОБХОДНАЯ ВЕТКА',
      40,
      70,
    );
    if (id === 31) {
      c.strokeStyle = '#899d8d';
      c.lineWidth = 18;
      c.beginPath();
      c.moveTo(110, 150);
      c.lineTo(850, 150);
      c.stroke();
      state.risers.forEach((open, i) => {
        const x = 150 + i * 220;
        c.strokeStyle = open ? '#82c4bb' : '#766c51';
        c.beginPath();
        c.moveTo(x, 150);
        c.lineTo(x, 380);
        c.stroke();
        c.fillStyle = '#e1ddbf';
        c.font = 'bold 46px monospace';
        c.fillText('№ ' + (i + 1), x - 50, 460);
        c.fillStyle = open ? '#a8d7b0' : '#c57b53';
        c.fillRect(x - 20, 270, 40, 40);
      });
    } else if (id === 32) {
      values.forEach((value, i) => {
        const x = 260 + i * 440;
        c.fillStyle = '#c9d2b8';
        c.beginPath();
        c.arc(x, 280, 143, 0, Math.PI * 2);
        c.fill();
        const angle = ((-120 + value * 30) * Math.PI) / 180;
        c.strokeStyle = '#9b4d36';
        c.lineWidth = 12;
        c.beginPath();
        c.moveTo(x, 280);
        c.lineTo(x + Math.sin(angle) * 110, 280 - Math.cos(angle) * 110);
        c.stroke();
        c.fillStyle = '#243a2b';
        c.font = 'bold 55px monospace';
        c.fillText(String(value), x - 17, 355);
      });
    } else if (id === 34) {
      Object.entries(WATER_CHANNELS).forEach(([name, heights], i) => {
        c.strokeStyle = state.channel === name ? '#8ed3c9' : '#7c8e7f';
        c.lineWidth = 15;
        c.beginPath();
        heights.forEach((v, j) => {
          const x = 240 + j * 270,
            y = 160 + i * 120 + (8 - v) * 10;
          if (j) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.stroke();
        c.fillStyle = '#e1ddbf';
        c.font = '38px monospace';
        c.fillText(name + ' / ' + heights.join(' > '), 45, 195 + i * 120);
      });
    } else {
      c.fillStyle = '#b9d3b3';
      c.font = 'bold 50px monospace';
      if (id === 35) {
        c.fillText(WATER_SLOTS[state.pumpSlot].toUpperCase(), 90, 270);
        c.font = '30px monospace';
        c.fillText(completed >= 35 ? 'ПОРОГ ОСУШЕН' : 'ПАЗ МАХОВИКА', 90, 360);
      } else {
        c.font = '36px monospace';
        c.fillText(
          state.valveOrder.length
            ? state.valveOrder.map((v) => v.toUpperCase()).join(' > ')
            : 'ВЕНТИЛИ ЗАКРЫТЫ',
          45,
          255,
        );
        c.font = '29px monospace';
        c.fillText('ГОРЯЧИЙ ОТСТОЙНИК ПЕРЕКРЫТ', 45, 380);
      }
    }
    c.fillStyle = completed >= id ? '#b6e5aa' : '#cbbd8c';
    c.font = '26px monospace';
    c.fillText(completed >= id ? 'НАСТРОЙКА ЗАФИКСИРОВАНА' : 'РУЧНОЕ УПРАВЛЕНИЕ', 40, 515);
    panel.texture.needsUpdate = true;
    panel.wheels.forEach((w, i) => {
      w.rotation.z =
        id === 31
          ? state.risers[i]
            ? Math.PI / 4
            : 0
          : id === 34
            ? state.channel === Object.keys(WATER_CHANNELS)[i]
              ? Math.PI / 4
              : 0
            : id === 35
              ? (-state.pumpSlot * Math.PI) / 2
              : id === 38
                ? state.valveOrder.includes(WATER_VALVES[i])
                  ? Math.PI / 4
                  : 0
                : (-state.equalizer * Math.PI) / 2;
    });
  }
  return {
    ...access,
    items,
    stations,
    waterWing: true,
    panels,
    hatch,
    waterLevel,
    firstFragment,
    secondFragment,
    talon,
    clamp,
    get flooded() {
      return flooded;
    },
    completed: 30,
    apply(completed, state, mission, collected, instant = false) {
      this.completed = completed;
      access.apply(completed, state.exitReleased, instant);
      for (const [id, item] of items) item.visible = id === mission && !collected;
      for (const [id, station] of stations) {
        const done = completed >= id || (id === 40 && state.exitReleased);
        station.changed.visible = done;
        station.face?.color.setHex(done ? 0xa8cf85 : 0xa57e58);
      }
      for (const id of WATER_MODES) drawPanel(id, state, completed);
      flooded = completed < 35;
      flood.visible = flooded;
      footprints.visible = !flooded;
      well.visible = completed >= 32;
      hatch.rotation.x = completed >= 32 ? -Math.PI * 0.45 : 0;
      waterLevel.scale.y = completed >= 37 ? 0.28 : 0.85;
      waterLevel.position.y = completed >= 37 ? 0.36 : 0.65;
      firstFragment.visible = completed >= 33 && completed < 39;
      secondFragment.visible = completed >= 38 && completed < 39;
    },
  };
}
