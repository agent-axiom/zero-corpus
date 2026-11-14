import * as THREE from '../../vendor/three.module.min.js';
import {missions} from '../../campaign.js';
import {doorBlocks, restoreChapterPose} from './chapter.js';
import {labelMaterial} from './surfaces.js';

export const SIGNAL_BOARD = {x: -7.5, y: 1.45, z: -11.7};
export const SIGNAL_SITES = {
  11: {
    item: {x: -4.8, y: 1.06, z: -6.3},
    clue: {x: -5.1, y: 1.38, z: -11.8},
    station: SIGNAL_BOARD,
    room: 'Коммутаторная',
  },
  12: {
    item: {x: 5, y: 1.06, z: -10},
    clue: {x: 7.6, y: 1.38, z: -15.5},
    station: {x: 4.7, y: 1.3, z: -15.3},
    room: 'Монтажная',
  },
  13: {
    item: {x: 7.5, y: 1.06, z: -10.1},
    clue: {x: 4, y: 1.38, z: -10},
    station: {x: 7.4, y: 1.3, z: -13.4},
    room: 'Монтажная',
  },
  14: {
    item: {x: -4.5, y: 1.06, z: -21},
    clue: {x: -3.1, y: 1.38, z: -25.9},
    station: {x: -4.8, y: 1.3, z: -25.7},
    room: 'Кабины связи',
  },
  15: {
    item: {x: -7.5, y: 1.06, z: -21},
    clue: {x: -3.3, y: 1.38, z: -21},
    station: {x: -7.5, y: 1.3, z: -23.8},
    room: 'Кабины связи',
  },
  16: {
    item: {x: -4.1, y: 1.06, z: -23.6},
    clue: {x: -6.3, y: 1.38, z: -25.9},
    station: {x: -6, y: 1.3, z: -21.1},
    room: 'Кабины связи',
  },
  17: {
    item: {x: -4.1, y: 1.06, z: -23.6},
    clue: {x: 1.3, y: 1.38, z: -23.2},
    station: {x: 1.25, y: 1.3, z: -25.5},
    room: 'Разделительный кросс в коридоре',
  },
  18: {
    item: {x: 5, y: 1.06, z: -10},
    clue: {x: -3.6, y: 1.38, z: -10.8},
    station: {x: 0.9, y: 1.3, z: -29.1},
    room: 'Монтажная / коммутаторная / телефонный диск у архива',
  },
  19: {
    item: {x: 10, y: 1.06, z: -25},
    clue: {x: 6.4, y: 1.38, z: -29.8},
    station: {x: 10.3, y: 1.3, z: -29.8},
    room: 'Телефонный архив',
  },
  20: {
    item: {x: 6.2, y: 1.06, z: -25},
    clue: {x: -1.4, y: 1.38, z: -37.3},
    station: {x: 0, y: 1.3, z: -39.1},
    room: 'Головка в телефонном архиве / микшер в конце коридора',
  },
};

export const LINE_RECORDS = [
  {name: 'I', text: 'Непрерывное шипение. Движения за ним не слышно.'},
  {name: 'II', text: 'После подключения слышны один шаг и короткий выдох.'},
  {name: 'III', text: 'Ровные щелчки реле. Рисунок повторяется.'},
];

export function restoreSignals(raw, completed) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  return {
    selectedLine:
      Number.isInteger(saved.selectedLine) && saved.selectedLine >= -1 && saved.selectedLine <= 2
        ? saved.selectedLine
        : completed >= 11
          ? 1
          : -1,
    heard: [0, 1, 2].map((i) => saved.heard?.[i] === true || (completed >= 11 && i === 1)),
    exitReleased: completed >= 20 || (saved.exitReleased === true && completed >= 19),
    pose: restoreChapterPose(saved.pose),
  };
}

export function buildSignalHouse({group, mat, box, round, plane, block, mesh, sign, solid, at, table}) {
  const items = new Map(),
    stations = new Map(),
    doors = [];
  const add = (parent, material, x, y, z, w, h, d, geometry = box) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    parent.add(object);
    return object;
  };
  for (const [name, x, z, required, title] of [
    ['workshop', 1.95, -12.59, 11, 'МОНТАЖНАЯ'],
    ['cabins', -1.95, -23.54, 13, 'КАБИНЫ СВЯЗИ'],
    ['archive', 1.95, -27.19, 18, 'ТЕЛЕФОННЫЙ АРХИВ'],
  ]) {
    const side = Math.sign(x);
    for (const [a, b] of [
      [z - 3.835, z - 0.85],
      [z + 0.85, z + 3.465],
    ]) {
      block(mat.paint, x, 1.43, (a + b) / 2, 0.15, 2.86, b - a);
      solid(x, (a + b) / 2, 0.15, b - a);
    }
    block(mat.paint, x, 2.64, z, 0.15, 0.48, 1.7);
    sign(title, 'ЛИНЕЙНЫЙ ДОСТУП', x - side * 0.09, 2.65, z, 1.6, 0.35, (-side * Math.PI) / 2);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z - 0.8);
    group.add(pivot);
    add(pivot, mat.door, 0, 1.2, 0.8, 0.1, 2.4, 1.6);
    add(pivot, mat.zinc, -side * 0.08, 1.03, 1.37, 0.14, 0.04, 0.12);
    const lamp = new THREE.MeshBasicMaterial({color: 0xc55e3e});
    add(pivot, lamp, -side * 0.07, 1.65, 0.8, 0.03, 0.1, 0.12);
    doors.push({
      name,
      x,
      z,
      required,
      side,
      hingeX: x,
      hingeZ: z - 0.8,
      span: 1.6,
      axis: 'z',
      progress: 0,
      target: 0,
      pivot,
      lamp,
    });
  }
  const exit = new THREE.Group();
  exit.position.set(-1.65, 0, -41.95);
  group.add(exit);
  add(exit, mat.door, 1.65, 1.25, 0, 3.3, 2.5, 0.12);
  add(exit, mat.zinc, 2.9, 1.04, 0.1, 0.08, 0.28, 0.08);
  const exitLamp = new THREE.MeshBasicMaterial({color: 0xc55e3e});
  block(exitLamp, 1.74, 1.8, -41.85, 0.08, 0.16, 0.08);
  sign('АРХИВ СМЕНЫ', 'ВЫХОД ИЗ ДОМА СВЯЗИ', 0, 2.85, -41.86, 2.5, 0.4);
  doors.push({
    name: 'exit',
    required: 20,
    hingeX: -1.65,
    hingeZ: -41.95,
    axis: 'x',
    span: 3.3,
    progress: 0,
    target: 0,
    pivot: exit,
    lamp: exitLamp,
  });

  for (const [textId, site] of Object.entries(SIGNAL_SITES)) {
    const id = Number(textId),
      mission = missions[id - 1],
      p = site.item;
    // Shared evidence trays reveal only the object relevant to the current task.
    if (![17, 18].includes(id)) at(p.x, p.z, 0, table);
    const item = new THREE.Group();
    item.position.set(p.x, p.y, p.z);
    group.add(item);
    if (id === 11) {
      add(item, mat.dark, 0, 0.05, 0, 0.45, 0.06, 0.26);
      for (const x of [-0.17, 0.17]) add(item, mat.black, x, 0.1, 0, 0.14, 0.13, 0.17);
    } else if ([13, 18, 20].includes(id)) {
      add(item, mat.zinc, 0, 0.04, 0, 0.25, 0.08, 0.25, round);
      add(item, mat.dark, 0, 0.09, 0, 0.11, 0.025, 0.11, round);
    } else add(item, [12, 16, 17].includes(id) ? mat.paper : mat.amber, 0, 0, 0, 0.34, 0.055, 0.22);
    items.set(id, item);
    const clue = site.clue;
    block(mat.dark, clue.x, clue.y, clue.z - 0.04, 0.9, 0.64, 0.07);
    sign('ЗАПИСЬ ТЕЛЕФОНИСТКИ', mission.clue, clue.x, clue.y, clue.z, 0.86, 0.6, 0, 'paper');
    const s = site.station;
    if (id !== 11) {
      block(mat.paint, s.x, 0.56, s.z - 0.18, 1.3, 1.12, 0.65);
      solid(s.x, s.z - 0.18, 1.3, 0.65);
      block(mat.steel, s.x, 1.15, s.z - 0.12, 1.4, 0.08, 0.8);
    }
    const face = id === 11 ? null : new THREE.MeshBasicMaterial({color: 0xa57e58});
    if (id !== 11) {
      mesh(plane, face, s.x, s.y, s.z + 0.21, 0.83, 0.4, 1);
      sign(mission.station.toUpperCase(), 'ДОМ СВЯЗИ / ' + id, s.x, 2.1, s.z - 0.12, 1.8, 0.37);
    }
    const changed = new THREE.Group();
    changed.position.set(s.x, s.y, s.z + (id === 18 ? 0.35 : 0.24));
    group.add(changed);
    const labels = {
      12: 'ЛЕНТА СКЛЕЕНА',
      13: '15 м',
      14: 'Б / 03:16',
      15: '4 ДЕЛЕНИЯ',
      16: 'НЕ НАБИРАЙ',
      17: 'В—Е ОТКЛЮЧЕНА',
      18: '8',
      19: 'СЕМЁН ЧИЖОВ',
      20: '0 / 2 / 1',
    };
    if (id !== 11)
      add(
        changed,
        labelMaterial(labels[id], 'ЗАПИСЬ СОХРАНЕНА', 'screen'),
        0,
        0,
        0.02,
        0.8,
        0.36,
        1,
        plane,
      );
    changed.visible = false;
    stations.set(id, {point: s, label: mission.station, face, changed});
    if (id === 18) {
      mesh(round, mat.dark, s.x, s.y, s.z + 0.26, 0.36, 0.07, 0.36, 0, Math.PI / 2);
      for (let digit = 0; digit < 10; digit++) {
        const angle = (digit * Math.PI) / 5;
        mesh(
          round,
          mat.zinc,
          s.x + Math.sin(angle) * 0.13,
          s.y + Math.cos(angle) * 0.13,
          s.z + 0.31,
          0.04,
          0.01,
          0.04,
          0,
          Math.PI / 2,
        );
      }
    }
  }

  const board = SIGNAL_BOARD;
  block(mat.dark, board.x, 1.36, board.z - 0.18, 2.3, 1.65, 0.45);
  solid(board.x, board.z - 0.18, 2.3, 0.45);
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 600;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const boardFace = new THREE.MeshBasicMaterial({map: texture});
  mesh(plane, boardFace, board.x, 1.47, board.z + 0.06, 2.15, 1.34, 1);
  const speaker = new THREE.MeshBasicMaterial({color: 0xc87e51});
  block(mat.dark, 1.6, 2.7, -22.9, 0.35, 0.38, 0.28);
  block(speaker, 1.6, 2.7, -22.73, 0.26, 0.26, 0.02);
  const crossWire = new THREE.Group();
  crossWire.position.set(1.25, 1.6, -25.2);
  group.add(crossWire);
  add(crossWire, mat.rust, 0, 0, 0, 0.38, 0.025, 0.03);
  const cabinLamp = new THREE.PointLight(0xd3d7aa, 0, 7);
  cabinLamp.position.set(-4.5, 2.4, -23.8);
  group.add(cabinLamp);
  let boardKey = '';
  function drawBoard(completed, state) {
    const key = JSON.stringify([completed, state.selectedLine, state.heard]);
    if (key === boardKey) return;
    boardKey = key;
    const c = canvas.getContext('2d');
    c.fillStyle = '#293329';
    c.fillRect(0, 0, 960, 600);
    c.strokeStyle = '#9a9979';
    c.lineWidth = 6;
    c.strokeRect(12, 12, 936, 576);
    c.fillStyle = '#e7d6a5';
    c.font = 'bold 43px monospace';
    c.fillText('КОММУТАТОР СМЕНЫ', 55, 76);
    for (let i = 0; i < 3; i++) {
      const x = 210 + i * 270;
      c.fillStyle = completed >= 11 && i === 1 ? '#d4eaa0' : state.heard[i] ? '#ccac6a' : '#666650';
      c.beginPath();
      c.arc(x, 230, 28, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#b6ac8b';
      c.lineWidth = 9;
      c.beginPath();
      c.arc(x, 310, 33, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#121c14';
      c.beginPath();
      c.arc(x, 310, 23, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#dfd4b0';
      c.font = 'bold 35px monospace';
      c.fillText(LINE_RECORDS[i].name, x - 16, 177);
    }
    c.fillStyle = '#d2c49e';
    c.font = '25px monospace';
    c.fillText(completed >= 17 ? 'ГРОМКАЯ СВЯЗЬ ОТКЛЮЧЕНА' : 'КОНТРОЛЬНЫЕ НАУШНИКИ', 55, 535);
    if (state.selectedLine >= 0) {
      const x = 210 + state.selectedLine * 270;
      c.strokeStyle = '#e5ab64';
      c.lineWidth = 15;
      c.beginPath();
      c.moveTo(110, 450);
      c.bezierCurveTo(100, 570, x + 100, 530, x, 310);
      c.stroke();
    }
    texture.needsUpdate = true;
  }
  return {
    items,
    stations,
    doors,
    signalHouse: true,
    boardTexture: texture,
    speaker,
    crossWire,
    completed: 10,
    apply(completed, state, mission, collected, instant = false) {
      this.completed = completed;
      for (const door of doors) {
        door.target = Number(door.name === 'exit' ? state.exitReleased : completed >= door.required);
        if (instant) {
          door.progress = door.target;
          door.pivot.rotation.y = ((door.side ?? 1) * door.progress * Math.PI) / 2;
        }
        door.lamp.color.setHex(door.target ? 0xa8cf85 : 0xc55e3e);
      }
      for (const [id, item] of items) item.visible = id === mission && !collected;
      for (const [id, station] of stations) {
        const done = completed >= id || (id === 20 && state.exitReleased);
        station.changed.visible = done;
        station.face?.color.setHex(done ? 0xa8cf85 : 0xa57e58);
      }
      speaker.color.setHex(completed >= 17 ? 0x313a2f : 0xc87e51);
      crossWire.visible = completed < 17;
      cabinLamp.intensity = completed >= 14 ? 5 : 0;
      drawBoard(completed, state);
    },
    update(dt) {
      for (const door of doors) {
        door.progress = Math.min(door.target, door.progress + dt / 1.25);
        door.pivot.rotation.y = ((door.side ?? 1) * door.progress * Math.PI) / 2;
      }
    },
    blocks(x, z, radius) {
      return doors.some((d) => doorBlocks(d, x, z, radius));
    },
    lineClear(from, to) {
      for (const door of doors.filter((d) => d.axis === 'z')) {
        if ((from.x - door.x) * (to.x - door.x) >= 0) continue;
        const t = (door.x - from.x) / (to.x - from.x),
          z = from.z + (to.z - from.z) * t;
        if (Math.abs(z - door.z) > 3.85) continue;
        if (door.progress < 0.95 || Math.abs(z - door.z) > 0.8) return false;
      }
      return true;
    },
    canRestorePose({x, z}) {
      return !doors.some(
        (d) =>
          !d.target &&
          (d.axis === 'z' ? (d.side ?? 1) * (x - d.x) > 0 && Math.abs(z - d.z) < 3.85 : z < d.hingeZ),
      );
    },
  };
}
