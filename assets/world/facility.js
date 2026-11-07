import * as THREE from '../../vendor/three.module.min.js';
import {labelMaterial, makeSurfaces, palettes, randomSource} from './surfaces.js';

export const CELL = 3.65;
export const HEIGHT = 3.35;
const key = (col, row) => col + ':' + row;
const roomSigns = [
  ['ПРИЁМНАЯ', 'АРХИВ', 'РЕМОНТНАЯ', 'КАРТОТЕКА'],
  ['КОММУТАТОР', 'ТЕЛЕТАЙП', 'УЗЕЛ СВЯЗИ', 'ПРИЁМНАЯ'],
  ['ЧИТАЛЬНЫЙ ЗАЛ', 'КАРТОТЕКА', 'СПЕЦХРАН', 'ПЕРЕПЛЁТНАЯ'],
  ['НАСОСНАЯ', 'ФИЛЬТРЫ', 'МАСТЕРСКАЯ', 'ДРЕНАЖ'],
  ['ПРИЁМНАЯ', 'ПАЛАТА 7', 'ПРОЦЕДУРНАЯ', 'ИЗОЛЯТОР'],
  ['ЧЕРТЁЖНАЯ', 'ОТЛИВКА', 'СБОРКА', 'МОДЕЛЬНАЯ'],
  ['ДЕТСКАЯ', 'КВАРТИРА 7', 'КОРИДОР', 'КУХНЯ'],
  ['ЦИФЕРБЛАТЫ', 'ХРОНОМЕТР', 'ПОВЕРКА', 'ЧАСОВЩИК'],
  ['ОПЕЧАТАНО', 'КАМЕРА 0', 'СТАРЫЙ ПОСТ', 'РЕЕСТР'],
  ['СЕКЦИЯ А', 'СЕКЦИЯ Б', 'КОНТУР', 'НУЛЕВОЙ ПОСТ'],
];

export function layoutFor(id) {
  const chapter = Math.max(0, Math.min(9, Math.floor((id - 1) / 10)));
  const cells = new Map();
  const put = (x, r) => cells.set(key(x, r), [x, r]);
  const end = 10 + (chapter % 2);
  for (let r = 0; r <= end; r++) put(0, r);
  const rooms = [];
  for (let tier = 0; tier < 2; tier++) {
    for (const side of [-1, 1]) {
      const r = 2 + tier * 4 + (side === 1 ? chapter % 2 : 0);
      const span = 2 + ((chapter + tier + (side === 1 ? 1 : 0)) % 2);
      const room = {side, row: r, span, title: roomSigns[chapter][rooms.length]};
      for (let col = 1; col <= span; col++) {
        put(side * col, r);
        put(side * col, r + 1);
      }
      room.x = side * (span + .13) * CELL;
      room.z = -(r + .45) * CELL;
      room.rot = -side * Math.PI / 2;
      rooms.push(room);
    }
  }
  // In the later sectors a service passage loops around one side of the spine.
  if (chapter >= 2) {
    const side = chapter % 2 ? 1 : -1;
    for (let r = 3; r <= 7; r++) put(side * 2, r);
  }

  const itemRoom = (id - 1) % rooms.length;
  const clueRoom = (itemRoom + 1 + Math.floor((id - 1) / 4) % 3) % rooms.length;
  const point = room => ({x: room.x, z: room.z, yaw: room.rot});
  const points = {
    item: point(rooms[itemRoom]),
    clue: point(rooms[clueRoom]),
    station: {x: 0, z: -end * CELL - .22, yaw: 0},
  };
  return {chapter, cells, end, rooms, itemRoom, clueRoom, points,
    has(x, r) {return cells.has(key(x, r));},
    inside(x, z) {return cells.has(key(Math.floor(x / CELL + .5), Math.floor(-z / CELL + .5)));},
  };
}

export function releaseScene(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!mat) continue;
      materials.add(mat);
      if (mat.map) textures.add(mat.map);
    }
  });
  for (const item of [...textures, ...materials, ...geometries]) item.dispose();
}

function itemModel(title, material) {
  const group = new THREE.Group();
  const block = (m, x, y, z, w, h, d) => {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    obj.position.set(x, y, z);
    group.add(obj);
  };
  const disk = (m, x, y, z, r, h, rot = 0) => {
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m);
    obj.position.set(x, y, z);
    obj.rotation.x = rot;
    group.add(obj);
  };
  const t = String(title).toLowerCase();
  if (/жетон|монет|шайб/.test(t)) {
    disk(material.rust, 0, .025, 0, .14, .050);
    disk(material.amber, 0, .055, 0, .115, .012);
    block(material.darkPaper, 0, .066, 0, .12, .005, .014);
  } else if (/ключ|пломб|пропуск|карт[ауыо]|талон|билет/.test(t)) {
    block(material.dark, 0, .02, 0, .39, .04, .24);
    block(material.amber, -.11, .045, 0, .073, .012, .2);
    block(material.paper, .055, .045, 0, .15, .012, .085);
  } else if (/ламп|ампул|колб|фильтр|труб|баллон|предохранит|капсул|элемент|батаре/.test(t)) {
    disk(material.zinc, 0, .17, 0, .09, .33);
    disk(material.dark, 0, .035, 0, .106, .06);
    disk(material.amber, 0, .33, 0, .095, .05);
  } else if (/фото|лист|письм|акт|записк|бланк|схем|отчёт|книг|формуляр|папк|журнал|конверт/.test(t)) {
    block(material.darkPaper, 0, .027, 0, .48, .054, .34);
    block(material.paper, .005, .067, 0, .43, .024, .3);
    for (let j = 0; j < 4; j++) block(material.darkPaper, -.045, .082, -.08 + .036 * j, .19, .005, .009);
  } else {
    block(material.dark, 0, .085, 0, .44, .17, .25);
    block(material.darkPaper, 0, .176, 0, .36, .009, .19);
    for (const x of [-.105, .105]) {
      disk(material.zinc, x, .187, 0, .057, .012);
      disk(material.black, x, .195, 0, .023, .008);
    }
  }
  return group;
}

export function buildFacility(mission, layout) {
  const group = new THREE.Group();
  const colors = palettes[layout.chapter];
  const mat = makeSurfaces(colors, layout.chapter);
  const rand = randomSource(mission.id * 37 + 51);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const round = new THREE.CylinderGeometry(.5, .5, 1, 10);
  const plane = new THREE.PlaneGeometry(1, 1);
  const batches = new Map();
  const lights = [], obstacles = [];
  const transform = new THREE.Object3D();
  const scope = {x: 0, z: 0, yaw: 0};
  const place = (x, z) => [scope.x + x * Math.cos(scope.yaw) + z * Math.sin(scope.yaw),
    scope.z - x * Math.sin(scope.yaw) + z * Math.cos(scope.yaw)];
  function at(x, z, yaw, fn) {
    const old = {...scope};
    Object.assign(scope, {x, z, yaw});
    fn();
    Object.assign(scope, old);
  }
  function mesh(geometry, material, x, y, z, w, h, d, yaw = 0, tilt = 0, roll = 0) {
    const [wx, wz] = place(x, z);
    transform.position.set(wx, y, wz);
    transform.rotation.set(tilt, scope.yaw + yaw, roll, 'YXZ');
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    const name = geometry.uuid + ':' + material.uuid;
    if (!batches.has(name)) batches.set(name, {geometry, material, matrices: []});
    batches.get(name).matrices.push(transform.matrix.clone());
  }
  const block = (m, x, y, z, w, h, d, yaw = 0) => mesh(box, m, x, y, z, w, h, d, yaw);
  function sign(text, sub, x, y, z, w, h, yaw = 0, type = 'sign') {
    mesh(plane, labelMaterial(text, sub, type), x, y, z, w, h, 1, yaw);
  }
  function solid(x, z, w, d) {
    mesh(plane, mat.ao, x, .006, z, w + .73, d + .73, 1, 0, -Math.PI / 2);
    const [wx, wz] = place(x, z);
    const flipped = Math.abs(Math.sin(scope.yaw)) > .5;
    obstacles.push({x: wx, z: wz, w: (flipped ? d : w) / 2, d: (flipped ? w : d) / 2});
  }
  function lamp(x, z, w = 1.7) {
    block(mat.dark, x, HEIGHT - .055, z, w + .24, .11, .47);
    block(mat.zinc, x, HEIGHT - .12, z, w + .14, .04, .38);
    for (const offset of [-.09, .09]) {
      block(mat.tube, x, HEIGHT - .153, z + offset, w, .053, .047);
    }
    const [wx, wz] = place(x, z);
    lights.push(new THREE.Vector3(wx, HEIGHT - .35, wz));
  }
  function table() {
    block(mat.case, 0, .93, 0, 1.65, .11, .82);
    block(mat.dark, 0, .865, 0, 1.55, .075, .73);
    block(mat.paint, .48, .78, 0, .54, .17, .69);
    block(mat.zinc, .48, .79, .367, .14, .023, .035);
    for (const x of [-.70, .70]) for (const z of [-.30, .30])
      block(mat.steel, x, .42, z, .055, .84, .055);
    block(mat.dark, 0, .22, -.29, 1.42, .05, .045);
    solid(0, 0, 1.57, .77);
  }
  function lightBox(x, y, z, m) {
    block(mat.dark, x, y, z, .19, .21, .105);
    block(m, x, y, z + .065, .105, .12, .04);
  }

  function dial(x, y, z, diameter, angle = .7) {
    mesh(round, mat.dark, x, y, z, diameter, .10, diameter, 0, Math.PI / 2);
    mesh(round, mat.paper, x, y, z + .06, diameter * .90, .02, diameter * .90, 0, Math.PI / 2);
    const hand = diameter * .29;
    mesh(box, mat.black, x + Math.sin(angle) * hand / 2, y + Math.cos(angle) * hand / 2,
      z + .079, .024, hand, .012, 0, 0, -angle);
  }
  function cupboard(x, w = 1.25) {
    block(mat.door, x, .79, -.49, w, 1.58, .60);
    block(mat.trim, x, .07, -.49, w + .05, .14, .64);
    solid(x, -.49, w, .62);
  }
  function roomEquipment(chapter, x, i) {
    switch (chapter) {
      case 0: {
        // The shift supervisor's chair and wall clock.
        block(mat.darkPaper, x, .54, -.3, .61, .10, .55);
        block(mat.darkPaper, x, .94, -.52, .58, .59, .08);
        for (const dx of [-.24, .24]) for (const dz of [-.5, -.09])
          block(mat.steel, x + dx, .26, dz, .045, .52, .045);
        solid(x, -.30, .58, .54);
        dial(x, 2.10, -1.16, .49, i * .8);
        break;
      }
      case 1: {
        cupboard(x, 1.44);
        block(mat.dark, x, 1.31, -.15, 1.32, 1.55, .21);
        for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) {
          const xp = x - .48 + col * .24, yp = .75 + row * .26;
          mesh(round, mat.zinc, xp, yp, -.031, .088, .02, .088, 0, Math.PI / 2);
          mesh(round, mat.dark, xp, yp, -.015, .049, .02, .049, 0, Math.PI / 2);
          block(mat.paper, xp, yp + .078, -.040, .12, .028, .013);
        }
        break;
      }
      case 2: {
        cupboard(x, 1.15);
        for (let row = 0; row < 4; row++) {
          const y = .23 + row * .39;
          block(mat.steel, x, y, -.17, 1.03, .33, .075);
          block(mat.paper, x, y + .068, -.123, .22, .059, .014);
          block(mat.dark, x, y - .045, -.098, .27, .035, .048);
        }
        break;
      }
      case 3: {
        for (const dx of [-.48, .48]) {
          mesh(round, mat.rust, x + dx, 1.62, -.69, .23, 3.23, .23);
          for (const y of [.26, .99, 2.32]) mesh(round, mat.steel, x + dx, y, -.69, .34, .06, .34);
          dial(x + dx, 1.62, -.45, .34, i + dx);
          const z = -.42;
          mesh(round, mat.rust, x + dx, .82, z, .10, .42, .10, 0, Math.PI / 2);
          for (let arm = 0; arm < 3; arm++)
            mesh(box, mat.rust, x + dx, .82, -.20, .052, .44, .052, 0, 0, Math.PI * arm / 3);
        }
        solid(x, -.62, 1.22, .36);
        break;
      }
      case 4:
      case 6: {
        const bed = chapter === 4 ? mat.zinc : mat.darkPaper;
        block(bed, x, .37, .14, .85, .17, 1.89);
        block(mat.paper, x, .52, .14, .81, .15, 1.81);
        block(chapter === 4 ? mat.paint : mat.rust, x, .63, .48, .80, .08, 1.05);
        block(mat.case, x, .66, -.53, .61, .16, .36);
        for (const dx of [-.37, .37]) for (const dz of [-.74, 1.02])
          block(bed, x + dx, .31, dz, .055, .62, .055);
        solid(x, .14, .85, 1.89);
        if (chapter === 4) {
          mesh(round, mat.zinc, x + .64, 1.04, -.66, .035, 2.08, .035);
          block(mat.zinc, x + .55, 2.08, -.66, .22, .032, .032);
          mesh(round, mat.case, x + .48, 1.94, -.66, .105, .23, .105);
        } else {
          block(mat.darkPaper, x, 1.50, -1.12, .55, .69, .065);
          sign('1986', 'НОЯБРЬ', x, 1.50, -1.07, .45, .59, 0, 'paper');
        }
        break;
      }
      case 5: {
        block(mat.darkPaper, x, .5, -.28, 1.50, 1.0, .87);
        block(mat.paper, x, 1.03, -.28, 1.40, .05, .77);
        for (let k = 0; k < 3; k++) {
          const bx = x - .43 + k * .40;
          block(mat.case, bx, 1.18 + .05 * k, -.28, .30, .25 + .10 * k, .32);
          for (let q = 0; q < 3; q++) block(mat.dark, bx - .08 + q * .084, 1.2, -.112, .044, .075, .015);
        }
        solid(x, -.28, 1.50, .87);
        break;
      }
      case 7: {
        cupboard(x, 1.53);
        for (let k = 0; k < 3; k++) dial(x - .50 + k * .50, 1.32, -.15, .41, (i + k) * 1.72);
        for (const dx of [-.43, .43])
          mesh(round, mat.rust, x + dx, .70, -.14, .13, .46, .13);
        break;
      }
      case 8: {
        cupboard(x, 1.43);
        for (const dx of [-.34, .34]) {
          block(mat.case, x + dx, 1.81, -.43, .60, .47, .47);
          block(mat.black, x + dx, 1.81, -.18, .51, .36, .025);
          sign(dx < 0 ? 'ПОСТ 1' : 'ПОСТ 2', 'ОЖИДАНИЕ', x + dx, 1.81, -.16, .46, .29, 0, 'screen');
        }
        break;
      }
      case 9: {
        cupboard(x, 1.24);
        block(mat.dark, x, 1.06, -.16, .57, .85, .08);
        mesh(box, mat.zinc, x, 1.03, .02, .06, .53, .06, 0, -.6);
        block(mat.rust, x, 1.24, -.105, .37, .08, .09);
        lightBox(x, 1.38, -.1, mat.red);
        break;
      }
    }
  }

  for (const [col, row] of layout.cells.values()) {
    const x = col * CELL, z = -row * CELL;
    block(mat.floor, x, -.09, z, CELL, .18, CELL);
    block(mat.ceiling, x, HEIGHT + .09, z, CELL, .18, CELL);
    for (const [dx, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (layout.has(col + dx, row + dr)) continue;
      const yaw = dx ? Math.PI / 2 : 0;
      const wx = x + dx * CELL / 2, wz = z - dr * CELL / 2;
      block(mat.wall, wx, HEIGHT / 2, wz, CELL + .08, HEIGHT, .14, yaw);
      block(mat.trim, wx, .095, wz, CELL + .12, .19, .21, yaw);
      block(mat.paint, wx, HEIGHT - .1, wz, CELL + .09, .17, .2, yaw);
    }
    if (col === 0) {
      // The service pipes form a continuous line back to the central passage.
      for (const [offset, radius, m] of [[-1.54, .12, mat.rust], [-1.34, .07, mat.zinc]]) {
        mesh(round, m, x + offset, 3.07, z, radius, CELL + .025, radius, 0, Math.PI / 2);
        mesh(round, mat.steel, x + offset, 3.07, z + 1.2, radius * 1.42, .07, radius * 1.42, 0, Math.PI / 2);
      }
      block(mat.steel, x - 1.45, 3.15, z + 1.2, .55, .04, .07);
      if (row % 2 === 1 || row === 0) lamp(x, z, 1.48);
      if (row % 3 === 1) {
        block(mat.paint, x, 3.15, z, CELL, .36, .29);
        for (const side of [-1, 1]) {
          block(mat.paint, x + side * 1.75, 1.56, z, .13, 3.12, .30);
          block(mat.trim, x + side * 1.75, .17, z, .15, .34, .32);
        }
      }
    }
  }

  for (const [i, room] of layout.rooms.entries()) {
    const {x, z, side, row, span, rot, title} = room;
    // Wayfinding can be read before taking a turn and from inside the branch.
    const roomCode = 'БЛОК ' + String(layout.chapter + 1).padStart(2, '0') + ' / ' + (i + 1);
    const entryZ = -(row - .50) * CELL;
    const signX = side * .99;
    for (const dx of [-.47, .47]) block(mat.steel, signX + dx, 3.05, entryZ, .025, .60, .025);
    block(mat.dark, signX, 2.61, entryZ, 1.47, .45, .065);
    const direction = side < 0 ? '← ' + title : title + ' →';
    sign(direction, roomCode, signX, 2.61, entryZ + .037, 1.42, .42);
    lamp(side * (span - .3) * CELL, z, 1.35);
    at(x, z, rot, () => {
      const back = -CELL * .35 + .09;
      sign(title, roomCode, 0, 2.28, back, 1.56, .57);
      if (i === layout.itemRoom || i === layout.clueRoom) {
        table();
        block(mat.dark, -.64, 1.01, -.14, .23, .06, .20);
        block(mat.steel, -.64, 1.25, -.15, .035, .47, .035);
        block(mat.door, -.55, 1.50, -.15, .30, .12, .18);
        block(mat.tube, -.53, 1.433, -.15, .20, .014, .10);
        mesh(plane, mat.ao, -.63, .99, -.15, .45, .34, 1, 0, -Math.PI / 2);
        if (i === layout.itemRoom) mesh(plane, mat.ao, 0, .99, 0, .58, .45, 1, 0, -Math.PI / 2);
        if (i === layout.clueRoom) {
          block(mat.steel, .09, 1.03, .02, .57, .08, .38);
          block(mat.door, .09, 1.33, -.04, .67, .58, .065);
          sign('СВОДКА', 'ДЕЖУРНОЙ СМЕНЫ', .09, 1.35, .0, .58, .42, 0, 'paper');
          block(mat.amber, .09, 1.63, -.03, .15, .025, .05);
        }
      }
      // Distinct silhouettes in the evidence rooms keep the sectors recognizable.
      const sideX = side === -1 ? 2.0 : -2.0;
      if ((layout.chapter + i) % 2 === 0) {
        for (let k = 0; k < 2; k++) {
          const px = sideX + (k - .5) * .66;
          block(mat.door, px, 1.02, -.62, .62, 2.04, .59);
          block(mat.paint, px, 1.0, -.30, .56, 1.88, .06);
          for (let j = 0; j < 3; j++) block(mat.dark, px, 1.64 + .062 * j, -.262, .28, .023, .009);
          block(mat.zinc, px + .19, 1.04, -.24, .036, .14, .04);
        }
        solid(sideX, -.62, 1.28, .66);
      } else {
        for (const px of [-.63, .63]) for (const pz of [-.81, -.16])
          block(mat.steel, sideX + px, 1.04, pz, .05, 2.08, .05);
        for (let k = 0; k < 4; k++) {
          block(mat.steel, sideX, .17 + k * .5, -.5, 1.42, .055, .77);
          const width = .35 + rand() * .31;
          block(mat.darkPaper, sideX + rand() * .25 - .21, .34 + k * .5, -.51, width, .29, .44);
          block(mat.paper, sideX + .02, .36 + k * .5, -.28, .13, .06, .01);
        }
        solid(sideX, -.49, 1.42, .75);
      }
      roomEquipment(layout.chapter, -sideX, i);
      if (i !== layout.clueRoom && i !== layout.itemRoom) {
        // A locked, inset fire door with a wheel and a faded inspection plate.
        block(mat.trim, 0, 1.16, back, 1.44, 2.32, .11);
        block(mat.door, 0, 1.12, back + .07, 1.29, 2.22, .07);
        block(mat.glass, 0, 1.62, back + .11, .48, .35, .027);
        block(mat.zinc, .42, 1.04, back + .13, .19, .045, .07);
        lightBox(.89, 1.43, back, mat.red);
      }
    });
  }

  const item = itemModel(mission.item, mat);
  item.position.set(layout.points.item.x, .995, layout.points.item.z);
  item.rotation.y = layout.points.item.yaw - .18;
  group.add(item);

  const station = layout.points.station;
  at(station.x, station.z, 0, () => {
    const stationName = String(mission.station || 'Контроль');
    if (/турникет/.test(stationName.toLowerCase())) {
      // An old tripod turnstile still stands across the entry checkpoint.
      for (const side of [-1, 1]) {
        const x = side * .64;
        block(mat.trim, x, .08, 0, .41, .16, .71);
        block(mat.paint, x, .63, 0, .32, 1.08, .60);
        block(mat.zinc, x, 1.205, 0, .38, .07, .65);
        block(side < 0 ? mat.red : mat.green, x, 1.246, .11, .06, .012, .11);
      }
      mesh(round, mat.steel, -.33, 1.01, -.02, .27, .33, .27, 0, 0, Math.PI / 2);
      for (let k = 0; k < 3; k++) {
        const a = k * 2 * Math.PI / 3 + .28;
        mesh(round, mat.zinc, -.02, 1.01 + Math.cos(a) * .19, -.02 + Math.sin(a) * .19,
          .065, .75, .065, 0, a, -1.02);
      }
      solid(0, 0, 1.68, .74);
    } else if (/час|циферблат|хронометр|метроном/i.test(stationName)) {
      table();
      block(mat.darkPaper, 0, 1.42, -.08, .85, .88, .27);
      mesh(round, mat.zinc, 0, 1.45, .081, .74, .08, .74, 0, Math.PI / 2);
      mesh(round, mat.paper, 0, 1.45, .131, .68, .02, .68, 0, Math.PI / 2);
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        mesh(box, mat.dark, Math.sin(a) * .28, 1.45 + Math.cos(a) * .28, .148,
          .012, .054, .01, 0, 0, -a);
      }
      mesh(box, mat.dark, .068, 1.47, .163, .15, .028, .009, 0, 0, .24);
      mesh(box, mat.black, .052, 1.57, .16, .022, .26, .009, 0, 0, -.42);
    } else {
      block(mat.dark, 0, .08, 0, 1.46, .16, .80);
      block(mat.paint, 0, .63, 0, 1.31, 1.04, .72);
      block(mat.steel, 0, 1.18, .08, 1.51, .1, .96);
      block(mat.case, 0, 1.56, -.16, .98, .71, .56);
      block(mat.dark, -.025, 1.575, .13, .82, .54, .045);
      sign('ГОТОВ', 'ПРИЁМ ДАННЫХ', -.025, 1.575, .158, .73, .41, 0, 'screen');
      block(mat.dark, -.16, 1.25, .38, .72, .042, .24);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++)
        block(mat.case, -.44 + i * .069, 1.279, .30 + .063 * j, .052, .017, .043);
      for (let i = 0; i < 3; i++) block(i ? mat.green : mat.red, .41 + .055 * i, 1.25, .39, .027, .028, .028);
      solid(0, .02, 1.5, .9);
    }
    sign(stationName.toUpperCase(), 'КОНТРОЛЬНЫЙ ПОСТ', 0, 2.46, -1.42, 1.83, .61);
  });

  at(0, CELL / 2 - .09, Math.PI, () => {
    block(mat.dark, 0, 1.18, .01, 1.70, 2.36, .09);
    for (const s of [-1, 1]) {
      block(mat.door, s * .39, 1.13, .066, .75, 2.24, .07);
      block(mat.zinc, s * .14, 1.05, .13, .035, .27, .045);
      block(mat.glass, s * .39, 1.66, .12, .30, .31, .015);
    }
    sign('ШЛЮЗ', 'БЛОКИРОВКА', 0, 2.65, .10, 1.13, .35);
  });

  // Pipes, wall cupboards and radiator fins give the sightline a human scale.
  for (let row = 1; row < layout.end; row += 2) {
    for (const side of [-1, 1]) {
      if (layout.has(side, row)) continue;
      at(side * (CELL / 2 - .11), -row * CELL + .08, -side * Math.PI / 2, () => {
        if (row % 4 === 1) {
          block(mat.dark, 0, .56, .04, 1.24, .48, .08);
          for (let i = 0; i < 12; i++) block(mat.zinc, -.56 + i * .102, .60, .1, .07, .60, .16);
          block(mat.rust, 0, .54, .13, 1.48, .06, .06);
        } else {
          block(mat.steel, 0, 1.52, .03, .48, .66, .14);
          block(mat.door, 0, 1.52, .12, .43, .60, .06);
          block(mat.amber, 0, 1.63, .156, .11, .1, .012);
          block(mat.rust, .12, 2.59, .02, .047, 1.5, .047);
        }
      });
    }
  }

  for (const {geometry, material, matrices} of batches.values()) {
    const instance = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => instance.setMatrixAt(i, matrix));
    instance.computeBoundingSphere();
    group.add(instance);
  }
  return {group, item, obstacles, lights, colors, mat};
}

export function buildWatcher(materials) {
  const group = new THREE.Group();
  const limbs = [];
  function part(parent, m, x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  part(group, materials.cloth, 0, 1.58, 0, .38, .83, .22);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.171, 12, 10), materials.black);
  head.position.y = 2.14;
  head.scale.set(.85, 1.32, .87);
  group.add(head);
  for (const side of [-1, 1]) {
    for (const arm of [false, true]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (arm ? .22 : .105), arm ? 1.93 : 1.20, .01);
      const length = arm ? 1.02 : 1.19;
      part(pivot, materials.cloth, 0, -length / 2, 0, arm ? .079 : .13, length, .12);
      group.add(pivot);
      limbs.push({pivot, sign: side * (arm ? -1 : 1)});
    }
  }
  part(group, materials.amber, -.10, 1.76, .12, .057, .012, .004);
  return {group, limbs};
}
