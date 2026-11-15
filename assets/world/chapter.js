import * as THREE from '../../vendor/three.module.min.js';
import {missions} from '../../campaign.js';
import {REPAIR} from './repair.js';
import {labelMaterial} from './surfaces.js';

// Coordinates remain fixed throughout the checkpoint chapter.
export const CHAPTER_SITES = {
  3: {
    item: REPAIR.item,
    clue: {x: -10.9, y: 1.12, z: -23.54},
    station: {x: -5.1, y: 1.3, z: -21.15},
    room: 'Ремонтная',
  },
  4: {
    item: {x: 8.9, y: 1.08, z: -6.2},
    clue: {x: 10.9, y: 1.38, z: -9.2},
    station: {x: 6.1, y: 1.3, z: -11.75},
    room: 'Архив',
  },
  5: {
    item: {x: 8.8, y: 1.08, z: -11.6},
    clue: {x: 6, y: 1.38, z: -6.4},
    station: {x: 10.7, y: 1.3, z: -7.1},
    room: 'Архив',
  },
  6: {
    item: {x: 7.65, y: 1.08, z: -21},
    clue: {x: 4.5, y: 1.38, z: -25.9},
    station: {x: 7.5, y: 1.3, z: -25.9},
    room: 'Картотека',
  },
  7: {
    item: {x: -2.65, y: 1.08, z: -34.35},
    clue: {x: 2.75, y: 1.38, z: -34.7},
    station: {x: 3.5, y: 1.3, z: -36.4},
    room: 'Будка дежурного',
  },
  8: {
    item: {x: -6, y: 1.18, z: -11.45},
    clue: {x: -5.1, y: 1.38, z: -6.15},
    station: {x: -8.6, y: 1.3, z: -6.3},
    room: 'Приёмная, окно выдачи',
  },
  9: {
    item: {x: -6, y: 1.18, z: -11.45},
    clue: {x: 1, y: 1.38, z: -32.05},
    station: {x: 1.2, y: 1.3, z: -36.35},
    room: 'Номерок в приёмной / звонок в будке',
  },
  10: {
    item: {x: 2.15, y: 1.035, z: -34.7},
    clue: {x: -3.2, y: 1.38, z: -39.6},
    station: {x: 3.3, y: 1.3, z: -39.6},
    room: 'Будка, релейный пост у выхода',
  },
};
export const ARCHIVE_DOOR = {x: 1.95, y: 1.3, z: -8.94};
export const EXIT_Z = -41.95;

export function restoreChapterPose(p) {
  return p &&
    ['x', 'z', 'yaw', 'pitch'].every((key) => Number.isFinite(p[key])) &&
    Math.abs(p.x) < 14 &&
    p.z > -46 &&
    p.z < 2 &&
    Math.abs(p.pitch) <= 1.08
    ? {x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch}
    : null;
}

export function restoreChapter(raw, completed) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  const pose = restoreChapterPose(saved.pose);
  return {
    archiveOpen: typeof saved.archiveOpen === 'boolean' ? saved.archiveOpen : completed >= 3,
    relayReleased: saved.relayReleased === true && completed >= 9,
    pose,
  };
}

export function doorBlocks(door, x, z, radius = 0.24) {
  const angle = (door.progress * Math.PI) / 2;
  const dx = door.axis === 'z' ? Math.sin(angle) * (door.side ?? 1) : Math.cos(angle);
  const dz = door.axis === 'z' ? Math.cos(angle) : -Math.sin(angle);
  const px = x - door.hingeX,
    pz = z - door.hingeZ;
  const along = Math.max(0, Math.min(door.span, px * dx + pz * dz));
  return Math.hypot(px - along * dx, pz - along * dz) < radius + 0.055;
}

export function buildChapter({
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
  repair,
  document: mountDocument,
  instrumentLabel,
}) {
  const items = new Map([[3, repair.key]]),
    stations = new Map(),
    doors = [];
  const add = (parent, material, x, y, z, w, h, d, geometry = box) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    parent.add(object);
    return object;
  };
  function branchDoor(name, z, title) {
    const x = 1.95,
      low = -5.475 + (z + 8.94),
      high = low - 7.3;
    for (const [a, b] of [
      [high, z - 0.85],
      [z + 0.85, low],
    ]) {
      block(mat.paint, x, 1.43, (a + b) / 2, 0.15, 2.86, b - a);
      solid(x, (a + b) / 2, 0.15, b - a);
    }
    block(mat.paint, x, 2.74, z, 0.15, 0.52, 1.7);
    sign(title, 'СЛУЖЕБНЫЙ ДОСТУП', x - 0.095, 2.65, z, 1.6, 0.36, -Math.PI / 2);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z - 0.8);
    group.add(pivot);
    add(pivot, mat.door, 0, 1.2, 0.8, 0.1, 2.4, 1.6);
    add(pivot, mat.zinc, -0.08, 1.03, 1.38, 0.14, 0.05, 0.14);
    const lamp = new THREE.MeshBasicMaterial({color: 0xd75b35});
    add(pivot, lamp, -0.06, 1.64, 0.8, 0.025, 0.1, 0.13);
    const door = {
      name,
      x,
      z,
      hingeX: x,
      hingeZ: z - 0.8,
      span: 1.6,
      axis: 'z',
      progress: 0,
      target: 0,
      pivot,
      lamp,
    };
    doors.push(door);
    return door;
  }
  const archiveDoor = branchDoor('archive', ARCHIVE_DOOR.z, 'АРХИВ / КЛЮЧ СМЕНЫ');
  branchDoor('service', -23.54, 'КАРТОТЕКА / ПИТАНИЕ');
  const exitPivot = new THREE.Group();
  exitPivot.position.set(-1.65, 0, EXIT_Z);
  group.add(exitPivot);
  add(exitPivot, mat.door, 1.65, 1.26, 0, 3.3, 2.52, 0.12);
  add(exitPivot, mat.zinc, 2.85, 1.05, 0.1, 0.08, 0.3, 0.1);
  sign('ДОМ СВЯЗИ', 'ВЫХОД ИЗ ПРОХОДНОЙ', 0, 2.85, EXIT_Z + 0.09, 2.5, 0.42);
  const exitLamp = new THREE.MeshBasicMaterial({color: 0xe15d35});
  block(exitLamp, 1.73, 1.85, EXIT_Z + 0.09, 0.08, 0.17, 0.08);
  doors.push({
    name: 'exit',
    hingeX: -1.65,
    hingeZ: EXIT_Z,
    span: 3.3,
    axis: 'x',
    progress: 0,
    target: 0,
    pivot: exitPivot,
    lamp: exitLamp,
  });

  for (const [textId, site] of Object.entries(CHAPTER_SITES)) {
    const id = Number(textId),
      mission = missions[id - 1];
    // Small evidence trays and readable wall plates keep each task at its own place.
    if (id !== 3 && id !== 9) {
      const p = site.item;
      if (id !== 7 && id !== 10) at(p.x, p.z, 0, table);
      const item = new THREE.Group();
      item.position.set(p.x, p.y, p.z);
      group.add(item);
      const paper = id === 4 || id === 5;
      add(item, paper ? mat.paper : mat.amber, 0, 0, 0, paper ? 0.4 : 0.21, 0.055, paper ? 0.27 : 0.16);
      if (id === 7) add(item, mat.zinc, 0, 0.07, 0, 0.27, 0.025, 0.19);
      if (id === 8) add(item, mat.dark, 0, 0.045, 0, 0.055, 0.015, 0.08);
      items.set(id, item);
    }
    if (id === 9) {
      const item = new THREE.Group();
      item.position.set(site.item.x, site.item.y, site.item.z);
      group.add(item);
      add(item, mat.darkPaper, 0, 0, 0, 0.44, 0.1, 0.29);
      add(item, mat.zinc, 0, 0.08, 0, 0.2, 0.03, 0.12);
      items.set(id, item);
    }
    mountDocument(site.clue, id === 3 ? 'ЖУРНАЛ СЛЕСАРЯ' : id === 7 ? 'СЛЕДЫ НА СТЕКЛЕ' : 'ЗАПИСЬ СМЕНЫ', mission.clue);
    const p = site.station;
    if (id !== 9) {
      block(mat.paint, p.x, 0.55, p.z - 0.17, 1.18, 1.1, 0.63);
      solid(p.x, p.z - 0.17, 1.18, 0.63);
      block(mat.steel, p.x, 1.12, p.z - 0.12, 1.34, 0.08, 0.78);
    }
    const face = new THREE.MeshBasicMaterial({color: 0x9b6843});
    mesh(
      plane,
      face,
      p.x,
      id === 9 ? 1.09 : p.y,
      p.z + 0.2,
      id === 9 ? 0.28 : 0.78,
      id === 9 ? 0.1 : 0.38,
      1,
    );
    instrumentLabel(
      mission.station.toUpperCase(),
      'ПОСТ ' + String(id).padStart(2, '0'),
      p.x,
      1.95,
      p.z - 0.12,
      1.6,
      0.37,
    );
    const changed = new THREE.Group();
    changed.position.set(p.x, p.y, p.z + 0.23);
    group.add(changed);
    add(
      changed,
      id === 3 ? mat.amber : mat.paper,
      0,
      id === 3 ? -0.04 : -0.18,
      0.01,
      id === 3 ? 0.37 : 0.52,
      0.07,
      0.08,
    );
    changed.visible = false;
    if (id !== 3) {
      const result = {
        4: '47',
        5: 'СВЯЗЬ',
        6: '5 А',
        7: 'Н',
        8: '17 / ПРАВЫЙ',
        9: 'ВЫЗОВ ПРИНЯТ',
        10: 'ШЛЮЗ ОТКРЫТ',
      }[id];
      add(
        changed,
        labelMaterial(result, 'ЗАФИКСИРОВАНО', 'screen'),
        0,
        0.04,
        0.025,
        0.74,
        0.3,
        1,
        plane,
      );
    }
    stations.set(id, {face, changed, point: p, label: mission.station});
  }
  // The key remains in the archive lock. The locker opens after the inspection.
  const keyInLock = new THREE.Group();
  keyInLock.position.set(-0.11, 1.03, 1.3);
  archiveDoor.pivot.add(keyInLock);
  add(keyInLock, mat.amber, 0, 0, 0, 0.18, 0.035, 0.035);
  keyInLock.visible = false;
  const locker = new THREE.Group();
  locker.position.set(-6, 0.62, -11.55);
  group.add(locker);
  add(locker, mat.door, 0, 0, 0, 0.9, 1.24, 0.13);
  const power = new THREE.PointLight(0xffda92, 0, 12);
  power.position.set(0, 2.55, -34.5);
  group.add(power);
  const initial = new THREE.PointLight(0xffbd78, 0, 5);
  initial.position.set(3.15, 1.8, -35.3);
  group.add(initial);
  const imprint = new THREE.Group();
  imprint.position.set(2.75, 1.45, -34.55);
  group.add(imprint);
  for (const dx of [-0.13, 0, 0.13])
    add(imprint, mat.darkPaper, dx, dx === 0 ? 0.04 : 0, 0, 0.055, 0.19, 0.015);
  const initialN = add(imprint, mat.amber, 0.35, 0, 0, 0.06, 0.27, 0.02);
  initialN.visible = false;
  const chapter = {
    items,
    stations,
    doors,
    keyInLock,
    locker,
    power,
    initial,
    imprint,
    completed: 0,
    mission: 1,
    apply(completed, state, mission, collected, instant = false) {
      chapter.completed = completed;
      chapter.mission = mission;
      for (const door of doors) {
        door.target = Number(
          door.name === 'archive'
            ? state.archiveOpen
            : door.name === 'service'
              ? completed >= 5
              : state.relayReleased,
        );
        if (instant) {
          door.progress = door.target;
          door.pivot.rotation.y = (door.progress * Math.PI) / 2;
        }
        door.lamp.color.setHex(door.target ? 0xa7ce83 : 0xd35c39);
      }
      for (const [id, item] of items)
        item.visible =
          id === mission &&
          !collected &&
          (id !== 8 || completed >= 7) &&
          (id !== 9 || completed >= 8) &&
          (id !== 10 || completed >= 9);
      for (const [id, station] of stations) {
        station.face.color.setHex(
          completed >= id || (id === 10 && state.relayReleased) ? 0xabc987 : 0x9b6843,
        );
        station.changed.visible = completed >= id || (id === 10 && state.relayReleased);
      }
      keyInLock.visible = state.archiveOpen;
      stations.get(3).changed.visible = completed >= 3 && !state.archiveOpen;
      locker.rotation.y = completed >= 7 ? 1.45 : 0;
      power.intensity = completed >= 6 ? 7 : 0;
      initial.intensity = completed >= 7 ? 2 : 0;
      imprint.visible = completed >= 6;
      initialN.visible = completed >= 7;
    },
    update(dt) {
      for (const door of doors) {
        door.progress = Math.min(door.target, door.progress + dt / 1.25);
        door.pivot.rotation.y = (door.progress * Math.PI) / 2;
      }
    },
    blocks(x, z, radius) {
      return doors.some((door) => doorBlocks(door, x, z, radius));
    },
    canRestorePose({x, z}) {
      return !doors.some(
        (door) =>
          !door.target &&
          (door.axis === 'z' ? x > door.x && Math.abs(z - door.z) < 3.85 : z < door.hingeZ),
      );
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
  };
  return chapter;
}
