import * as THREE from '../../vendor/three.module.min.js';
import {doorBlocks} from './chapter.js';

// Branch doors share collision, sight lines, animation and save restoration.
export function buildAccess(
  {group, mat, box, block, sign, solid},
  specs,
  {exitTitle, exitSubtitle, exitRequired, accessLabel = 'ЛИНЕЙНЫЙ ДОСТУП'},
) {
  const doors = [];
  const add = (parent, material, x, y, z, w, h, d) => {
    const object = new THREE.Mesh(box, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    parent.add(object);
    return object;
  };
  for (const [name, x, z, required, title] of specs) {
    const side = Math.sign(x);
    for (const [a, b] of [
      [z - 3.835, z - 0.85],
      [z + 0.85, z + 3.465],
    ]) {
      block(mat.paint, x, 1.43, (a + b) / 2, 0.15, 2.86, b - a);
      solid(x, (a + b) / 2, 0.15, b - a);
    }
    block(mat.paint, x, 2.64, z, 0.15, 0.48, 1.7);
    sign(title, accessLabel, x - side * 0.09, 2.65, z, 1.6, 0.35, (-side * Math.PI) / 2);
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
  sign(exitTitle, exitSubtitle, 0, 2.85, -41.86, 2.5, 0.4);
  doors.push({
    name: 'exit',
    required: exitRequired,
    hingeX: -1.65,
    hingeZ: -41.95,
    axis: 'x',
    span: 3.3,
    progress: 0,
    target: 0,
    pivot: exit,
    lamp: exitLamp,
  });

  return {
    doors,
    apply(completed, exitReleased, instant = false) {
      for (const door of doors) {
        door.target = Number(door.name === 'exit' ? exitReleased : completed >= door.required);
        if (instant) {
          door.progress = door.target;
          door.pivot.rotation.y = ((door.side ?? 1) * door.progress * Math.PI) / 2;
        }
        door.lamp.color.setHex(door.target ? 0xa8cf85 : 0xc55e3e);
      }
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
          (d.axis === 'z'
            ? (d.side ?? 1) * (x - d.x) > 0 && Math.abs(z - d.z) < 3.85
            : z < d.hingeZ),
      );
    },
  };
}
