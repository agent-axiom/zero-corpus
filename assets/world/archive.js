import * as THREE from '../../vendor/three.module.min.js';
import {missions} from '../../campaign.js';
import {restoreChapterPose} from './chapter.js';
import {buildAccess} from './access.js';
import {labelMaterial} from './surfaces.js';

export const ARCHIVE_CAROUSEL = {x: -6.5, y: 1.3, z: -10.1};
export const ARCHIVE_FUNDS = ['К', 'Л', 'Т'];
export const ARCHIVE_DRAWERS = [9, 11, 14];
export const ARCHIVE_RECORDS = {
  'К/9': {
    title: 'План крыльца',
    text: 'Наружная лестница. У северной двери отмечен козырёк. В бумаге нет колонок: уголок сюда не подходит.',
  },
  'К/11': {
    title: 'План коридора',
    text: 'Проход между архивом и водомерным узлом. На плане стоят размеры дверей, но нет отметок прихода и ухода.',
  },
  'К/14': {
    title: 'Карта насосной',
    text: 'Четыре трубопровода уходят под пол. Четвёртый подписан карандашом; конец подписи размыт водой.',
  },
  'Л/9': {
    title: 'Личное дело охранника',
    text: 'Приказ о назначении на ночной пост. На обороте: «За Обходчика не расписываться».',
  },
  'Л/11': {
    title: 'Личное дело Семёна',
    text: 'Архивариус Семён. Фамилия на титуле вырезана вместе с печатью. Последняя выданная папка — табель ночной смены.',
  },
  'Л/14': {
    title: 'Личное дело телефонистки',
    text: 'Нина, внутренняя связь. В графе «Уволена» пусто. Подпись ответственного обведена дважды.',
  },
  'Т/9': {
    title: 'Табель дневной смены',
    text: 'Колонки прихода и ухода заполнены синими чернилами. Край листа цел, водяной знак не совпадает с найденным уголком.',
  },
  'Т/11': {
    title: 'Табель ночи исчезновения',
    text: 'Оборванный водяной знак совпал с уголком. В колонке ухода нет подписи Нины. Папка тёплая: за ящиком работает вентилятор. На корешке — «Переплётная / повторная прошивка».',
  },
  'Т/14': {
    title: 'Табель внешнего обхода',
    text: 'Обходчик отмечен на каждом посту в одну и ту же минуту. Все листы целые; уголок от другого табеля.',
  },
};

export const ARCHIVE_SITES = {
  21: {
    item: {x: -4.5, y: 1.06, z: -6.3},
    clue: {x: -3.4, y: 1.38, z: -11.7},
    station: ARCHIVE_CAROUSEL,
    room: 'Читальный зал',
  },
  22: {
    item: {x: 6.8, y: 1.06, z: -6.2},
    clue: {x: 10.3, y: 1.38, z: -11.6},
    station: {x: 6, y: 1.3, z: -11.6},
    room: 'Переплётная',
  },
  23: {
    item: {x: 10, y: 1.06, z: -6.3},
    clue: {x: 4.5, y: 1.38, z: -6.4},
    station: {x: 10.5, y: 1.3, z: -9},
    room: 'Переплётная',
  },
  24: {
    item: {x: -4.2, y: 1.06, z: -21.1},
    clue: {x: -10.4, y: 1.38, z: -25.8},
    station: {x: -4.7, y: 1.3, z: -25.7},
    room: 'Учёт смены',
  },
  25: {
    item: {x: -10.3, y: 1.06, z: -21.1},
    clue: {x: -7, y: 1.38, z: -25.8},
    station: {x: -7.5, y: 1.3, z: -21.2},
    room: 'Учёт смены',
  },
  26: {
    item: {x: -4.2, y: 1.06, z: -21.1},
    clue: {x: -9.5, y: 1.38, z: -24},
    station: {x: -10.1, y: 1.3, z: -25.7},
    room: 'Учёт смены',
  },
  27: {
    item: {x: 4.5, y: 1.06, z: -21.1},
    clue: {x: 7.5, y: 1.38, z: -25.8},
    station: {x: 4.7, y: 1.3, z: -25.7},
    room: 'Спецхран',
  },
  28: {
    item: {x: 7.5, y: 1.06, z: -21.1},
    clue: {x: 3.1, y: 1.38, z: -21.3},
    station: {x: 7.6, y: 1.3, z: -23.6},
    room: 'Спецхран',
  },
  29: {
    item: {x: 7.5, y: 1.06, z: -21.1},
    clue: {x: 6.3, y: 1.38, z: -25.9},
    station: {x: 6, y: 1.3, z: -21.2},
    room: 'Спецхран',
  },
  30: {
    item: {x: 4.3, y: 1.06, z: -23.5},
    clue: {x: -1.3, y: 1.38, z: -37.2},
    station: {x: 0, y: 1.3, z: -39.1},
    room: 'Спецхран / световой стол у выхода',
  },
};

const validRecord = (key) => typeof key === 'string' && Object.hasOwn(ARCHIVE_RECORDS, key);
export function restoreArchive(raw, completed) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  const inspected = Array.isArray(saved.inspected)
    ? [...new Set(saved.inspected.filter(validRecord))]
    : [];
  if (completed >= 21 && !inspected.includes('Т/11')) inspected.push('Т/11');
  return {
    fund: ARCHIVE_FUNDS.includes(saved.fund) ? saved.fund : completed >= 21 ? 'Т' : 'К',
    drawer: ARCHIVE_DRAWERS.includes(saved.drawer) ? saved.drawer : 11,
    opened: validRecord(saved.opened) ? saved.opened : null,
    inspected,
    exitReleased: completed >= 30 || (saved.exitReleased === true && completed >= 29),
    pose: restoreChapterPose(saved.pose),
  };
}

export function buildArchiveWing({
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
      ['bindery', 1.95, -8.94, 21, 'ПЕРЕПЛЁТНАЯ'],
      ['register', -1.95, -23.54, 23, 'ОТДЕЛ 24 / УЧЁТ СМЕНЫ'],
      ['vault', 1.95, -23.54, 26, 'СПЕЦХРАН / ПЕЧАТЬ ЧИЖОВА'],
    ],
    {
      exitTitle: 'ВОДОМЕРНЫЙ УЗЕЛ',
      exitSubtitle: 'ВЫХОД ИЗ АРХИВА',
      exitRequired: 30,
      accessLabel: 'ДОПУСК ПО ДЕЛУ',
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
    22: 'ВСТАВЛЕН ЛИСТ 6',
    23: 'ОТДЕЛ 24',
    24: 'НЕТ ПОДПИСИ НИНЫ',
    25: 'Б → А → В',
    26: 'ЧИЖОВ',
    27: 'ШКАФ 19 ОТКРЫТ',
    28: 'СНЯТА ЗЕЛЁНАЯ ПЕЧАТЬ',
    29: 'НЕ ХВАТАЕТ 1 БЛАНКА',
    30: 'ЧЕТВЁРТАЯ ТРУБА ВНИЗ',
  };
  for (const [textId, site] of Object.entries(ARCHIVE_SITES)) {
    const id = Number(textId),
      mission = missions[id - 1],
      p = site.item,
      s = site.station;
    if (![26, 29].includes(id)) at(p.x, p.z, 0, table);
    const item = new THREE.Group();
    item.position.set(p.x, p.y, p.z);
    group.add(item);
    add(
      item,
      id === 23 ? mat.glass : id === 28 ? mat.rust : mat.paper,
      0,
      0.02,
      0,
      0.34,
      0.045,
      0.23,
    );
    if ([24, 26, 29, 30].includes(id)) add(item, mat.dark, 0, 0.055, 0, 0.22, 0.025, 0.06);
    items.set(id, item);
    block(mat.dark, site.clue.x, site.clue.y, site.clue.z - 0.04, 0.9, 0.64, 0.07);
    sign(
      'ЗАПИСЬ АРХИВАРИУСА',
      mission.clue,
      site.clue.x,
      site.clue.y,
      site.clue.z,
      0.86,
      0.6,
      0,
      'paper',
    );
    const changed = new THREE.Group();
    changed.position.set(s.x, s.y, s.z + 0.27);
    group.add(changed);
    const face = id === 21 ? null : new THREE.MeshBasicMaterial({color: 0xa57e58});
    if (id !== 21) {
      block(mat.paint, s.x, 0.56, s.z - 0.18, 1.3, 1.12, 0.65);
      solid(s.x, s.z - 0.18, 1.3, 0.65);
      block(mat.steel, s.x, 1.15, s.z - 0.12, 1.4, 0.08, 0.8);
      mesh(plane, face, s.x, s.y, s.z + 0.21, 0.94, 0.4, 1);
      sign(mission.station.toUpperCase(), 'АРХИВ / ' + id, s.x, 2.1, s.z - 0.12, 1.8, 0.37);
      add(
        changed,
        labelMaterial(labels[id], 'ВНЕСЕНО В ДЕЛО', 'screen'),
        0,
        0,
        0.02,
        0.92,
        0.36,
        1,
        plane,
      );
    }
    changed.visible = false;
    stations.set(id, {point: s, label: mission.station, face, changed});
  }

  // A triangular carousel has a real rack on each face. Drawer positions are
  // reconstructed from the same state as the close-up interaction.
  const carousel = new THREE.Group(),
    rotor = new THREE.Group(),
    drawers = new Map();
  carousel.position.set(ARCHIVE_CAROUSEL.x, 0, ARCHIVE_CAROUSEL.z - 0.7);
  group.add(carousel);
  add(carousel, mat.dark, 0, 0.12, 0, 1.75, 0.24, 1.75, round);
  add(carousel, mat.zinc, 0, 1.1, 0, 0.14, 2.1, 0.14, round);
  carousel.add(rotor);
  solid(ARCHIVE_CAROUSEL.x, ARCHIVE_CAROUSEL.z - 0.7, 2.2, 2.2);
  ARCHIVE_FUNDS.forEach((fund, i) => {
    const rack = new THREE.Group();
    rack.rotation.y = (i * Math.PI * 2) / 3;
    rotor.add(rack);
    add(rack, mat.paint, 0, 1.25, 0.43, 1.5, 1.75, 0.36);
    add(
      rack,
      labelMaterial('ФОНД ' + fund, 'КАРТОТЕКА', 'sign'),
      0,
      2.02,
      0.625,
      1.4,
      0.3,
      1,
      plane,
    );
    ARCHIVE_DRAWERS.forEach((number, j) => {
      const drawer = new THREE.Group();
      drawer.position.set(0, 1.59 - j * 0.43, 0.65);
      rack.add(drawer);
      add(drawer, mat.door, 0, 0, 0, 1.35, 0.36, 0.14);
      add(drawer, mat.zinc, 0, -0.07, 0.1, 0.3, 0.04, 0.06);
      add(
        drawer,
        labelMaterial('ДЕЛО ' + number, '', 'paper'),
        0,
        0.035,
        0.081,
        0.48,
        0.14,
        1,
        plane,
      );
      const paper = add(drawer, mat.paper, 0, 0.04, -0.18, 1.15, 0.025, 0.5);
      paper.visible = false;
      drawers.set(fund + '/' + number, {drawer, paper});
    });
  });
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Keep the fallback texture owned by the scene so releaseScene disposes it.
  const stamp = add(
    carousel,
    new THREE.MeshBasicMaterial({map: texture}),
    0,
    2.3,
    0,
    1.3,
    0.5,
    1,
    plane,
  );
  stamp.visible = false;
  let textureKey = '';
  function updateCarousel(state) {
    rotor.rotation.y = (-ARCHIVE_FUNDS.indexOf(state.fund) * Math.PI * 2) / 3;
    for (const [key, {drawer, paper}] of drawers) {
      drawer.position.z = state.opened === key ? 1 : 0.65;
      paper.visible = state.opened === key;
    }
    const key = JSON.stringify([state.fund, state.drawer, state.opened, state.inspected]);
    if (textureKey === key) return;
    textureKey = key;
    const c = canvas.getContext('2d');
    c.fillStyle = '#384638';
    c.fillRect(0, 0, 640, 640);
    c.fillStyle = '#e0d2a8';
    c.font = 'bold 51px monospace';
    c.fillText('ФОНД ' + state.fund, 80, 83);
    ARCHIVE_DRAWERS.forEach((n, i) => {
      const y = 125 + i * 155,
        k = state.fund + '/' + n;
      c.fillStyle = state.opened === k ? '#826e4f' : state.drawer === n ? '#66745c' : '#253126';
      c.fillRect(35, y, 570, 130);
      c.strokeStyle = '#a29672';
      c.lineWidth = 4;
      c.strokeRect(35, y, 570, 130);
      c.fillStyle = '#e0d2a8';
      c.font = '35px monospace';
      c.fillText('ДЕЛО ' + n, 77, y + 58);
      c.font = '24px monospace';
      c.fillText(
        state.inspected.includes(k)
          ? 'ПРОЧИТАНО'
          : state.opened === k
            ? 'ЯЩИК ОТКРЫТ'
            : 'ОПИСЬ СМЕНЫ',
        77,
        y + 101,
      );
    });
    texture.needsUpdate = true;
    stamp.material.color.setHex(0xffffff);
  }

  const lamp = new THREE.PointLight(0x7ba6e5, 0, 6);
  lamp.position.set(10.5, 1.9, -9);
  group.add(lamp);
  const sheet = add(stations.get(22).changed, mat.paper, 0, -0.49, 0.15, 0.6, 0.3, 0.02);
  sheet.rotation.z = -0.13;
  // The cabinet opens when its number has been resolved; the envelope stays on
  // its support until it is used. Both states survive reloads via completion.
  const cabinet = new THREE.Group();
  cabinet.position.set(10.4, 0, -25.7);
  group.add(cabinet);
  solid(10.4, -25.7, 1.2, 0.72);
  add(cabinet, mat.dark, 0, 1, 0.0, 1.2, 2, 0.72);
  const cabinetDoor = new THREE.Group();
  cabinetDoor.position.set(-0.6, 0, 0.4);
  cabinet.add(cabinetDoor);
  add(cabinetDoor, mat.door, 0.6, 1, 0, 1.2, 2, 0.08);
  add(cabinetDoor, labelMaterial('19', 'СПЕЦХРАН', 'sign'), 0.6, 1.5, 0.05, 0.7, 0.3, 1, plane);
  const envelope = add(cabinet, mat.paper, 0, 1.02, 0.25, 0.55, 0.03, 0.3);
  const trays = ['А', 'Б', 'В'].map((letter, i) => {
    const tray = new THREE.Group();
    tray.position.set(-0.4 + i * 0.4, -0.42, 0.16);
    stations.get(25).changed.add(tray);
    add(tray, mat.paper, 0, 0, 0, 0.34, 0.22, 0.04);
    add(tray, labelMaterial(letter, '', 'paper'), 0, 0, 0.03, 0.28, 0.19, 1, plane);
    return tray;
  });
  const seals = [0x668aaa, 0xaa6045, 0x759958].map((color, i) =>
    add(
      stations.get(28).changed,
      new THREE.MeshBasicMaterial({color}),
      -0.22 + i * 0.22,
      -0.08,
      0.06,
      0.16,
      0.13,
      0.025,
      round,
    ),
  );
  return {
    ...access,
    items,
    stations,
    archiveWing: true,
    carouselTexture: texture,
    completed: 20,
    cabinetDoor,
    envelope,
    seals,
    apply(completed, state, mission, collected, instant = false) {
      this.completed = completed;
      access.apply(completed, state.exitReleased, instant);
      for (const [id, item] of items) item.visible = id === mission && !collected;
      for (const [id, station] of stations) {
        const done = completed >= id || (id === 30 && state.exitReleased);
        station.changed.visible = done;
        station.face?.color.setHex(done ? 0xa8cf85 : 0xa57e58);
      }
      updateCarousel(state);
      lamp.intensity = completed >= 23 ? 2.8 : 0;
      cabinetDoor.rotation.y = completed >= 27 ? -Math.PI * 0.55 : 0;
      envelope.visible = completed >= 27 && completed < 28;
      trays.forEach((tray, i) => {
        tray.position.x = -0.4 + [1, 0, 2][i] * 0.4;
      });
      seals[2].position.y = completed >= 28 ? 0.17 : -0.08;
    },
  };
}
