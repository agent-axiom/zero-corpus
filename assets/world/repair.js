import * as THREE from '../../vendor/three.module.min.js';

export const REPAIR = {
  item: {x: -1.47, y: 1.35, z: -21.35, yaw: Math.PI / 2},
  wallX: -1.95, doorZ: -23.55, windowZ: -26.15,
  panels: [[-21.4125, 2.675], [-24.9625, 1.225], [-27.1, .55]],
};

export function buildRepair({group, mat, box, round, block, mesh, sign, solid}) {
  const {wallX, doorZ, windowZ, item} = REPAIR;
  // The side room has one open entrance and a glazed observation panel.
  for (const [z, depth] of REPAIR.panels) {
    block(mat.paint, wallX, 1.44, z, .15, 2.88, depth);
    solid(wallX, z, .15, depth);
  }
  block(mat.paint, wallX, 2.82, doorZ, .15, .36, 1.60);
  block(mat.paint, wallX, .54, windowZ, .15, 1.08, 1.25);
  block(mat.paint, wallX, 2.71, windowZ, .15, .34, 1.25);
  solid(wallX, windowZ, .15, 1.25);
  for (const z of [-24.37, -22.73]) block(mat.trim, wallX, 1.29, z, .22, 2.58, .095);
  block(mat.trim, wallX, 2.61, doorZ, .22, .12, 1.74);
  sign('РЕМОНТНАЯ', 'ДВЕРЬ ДЕРЖАТЬ ПРИОТКРЫТОЙ', wallX + .125, 2.91, doorZ, 1.80, .40, Math.PI / 2);

  const glass = new THREE.MeshBasicMaterial({
    color: 0xb5c6b8, transparent: true, opacity: .18,
    side: THREE.DoubleSide, depthWrite: false,
  });
  mesh(box, glass, wallX, 1.80, windowZ, .035, 1.38, 1.20);
  for (const z of [windowZ - .625, windowZ + .625]) block(mat.trim, wallX, 1.80, z, .21, 1.50, .06);
  for (const y of [1.09, 2.51]) block(mat.trim, wallX, y, windowZ, .21, .065, 1.30);
  // Scratched horizontal bands give the translucent pane a frosted surface.
  const frost = new THREE.MeshBasicMaterial({color: 0xd2d5bd, transparent: true, opacity: .05, depthWrite: false});
  for (let y = 1.16; y < 2.49; y += .045) mesh(box, frost, wallX, y, windowZ, .042, .012, 1.18);

  // The leaf swings into the room, leaving a full body-width route beside it.
  const leaf = new THREE.Group();
  leaf.position.set(wallX, 0, -24.35); leaf.rotation.y = -1.30;
  group.add(leaf);
  function part(parent, material, x, y, z, w, h, d, geo = box) {
    const obj = new THREE.Mesh(geo, material);
    obj.position.set(x, y, z); obj.scale.set(w, h, d); parent.add(obj);
    return obj;
  }
  part(leaf, mat.door, 0, .57, .74, .095, 1.14, 1.48);
  part(leaf, mat.door, 0, 2.25, .74, .095, .40, 1.48);
  for (const z of [.065, 1.415]) part(leaf, mat.door, 0, 1.60, z, .095, .98, .13);
  part(leaf, glass, 0, 1.60, .74, .04, .94, 1.25);
  part(leaf, mat.zinc, .10, 1.05, 1.22, .15, .045, .18);
  // Collision follows the almost folded-back leaf, with a generous entrance.
  solid(-2.65, -24.16, 1.4, .18);
  for (const z of [-24.22, -23.07]) block(mat.zinc, wallX + .09, .018, z, .35, .025, .05);
  block(mat.darkPaper, wallX - .3, .014, doorZ + .2, .55, .02, .095);

  // The key is on a hook at eye level, where the repair-room door is visible.
  block(mat.dark, -1.71, 1.34, item.z, .28, .94, .68);
  block(mat.paint, -1.55, 1.34, item.z, .065, .85, .61);
  block(mat.darkPaper, -1.51, 1.35, item.z, .02, .68, .47);
  for (const z of [item.z - .15, item.z + .15]) {
    block(mat.zinc, -1.47, 1.49, z, .10, .045, .04);
    block(mat.paper, -1.47, 1.63, z, .012, .08, .15);
  }
  sign('КЛЮЧНИЦА', 'СМЕНА 03', -1.46, 1.93, item.z, .72, .25, Math.PI / 2);
  solid(-1.71, item.z, .29, .68);
  const key = new THREE.Group();
  key.position.set(item.x, item.y, item.z); group.add(key);
  part(key, mat.amber, .025, .035, -.015, .035, .25, .06);
  part(key, mat.amber, .027, -.07, .055, .035, .05, .17);
  for (const [z, height] of [[.015, .06], [.065, .11], [.115, .085]]) {
    part(key, mat.zinc, .03, -.09 - height / 2, z, .042, height, .035);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.063, .012, 5, 14), mat.zinc);
  ring.rotation.y = Math.PI / 2; ring.position.set(.028, .20, -.015); key.add(ring);

  const bulb = new THREE.MeshBasicMaterial({color: 0x736145});
  block(mat.dark, -1.51, 2.25, item.z, .20, .22, .22);
  mesh(round, bulb, -1.375, 2.25, item.z, .18, .08, .18, 0, 0, Math.PI / 2);
  const warning = new THREE.PointLight(0xff9d4f, 0, 5.2);
  warning.position.set(-1.14, 2.24, item.z); group.add(warning);
  const shelterLight = new THREE.PointLight(0xe4d5a8, 3.2, 4);
  shelterLight.position.set(-2.30, 2.51, doorZ); group.add(shelterLight);
  block(mat.dark, wallX - .15, 2.50, doorZ, .33, .12, .72);
  block(mat.tube, wallX - .15, 2.43, doorZ, .25, .025, .57);

  // A first movement is seen through the frosted pane before the patrol enters.
  const shadow = new THREE.Group(), ink = new THREE.MeshBasicMaterial({
    color: 0x151a16, transparent: true, opacity: .64, side: THREE.DoubleSide, depthWrite: false,
  });
  shadow.position.set(wallX + .12, 0, windowZ); shadow.visible = false; group.add(shadow);
  part(shadow, ink, 0, 1.57, 0, .025, .72, .43);
  part(shadow, ink, 0, 2.04, 0, .025, .30, .30, new THREE.SphereGeometry(.5, 12, 8));
  for (const z of [-.13, .13]) part(shadow, ink, 0, .64, z, .025, 1.15, .12);
  const repair = {
    phase: 'waiting', time: 0, key, shadow,
    setPhase(phase, time = 0) {
      repair.phase = phase; repair.time = time;
      const warningPhase = phase === 'warning', patrol = phase === 'patrol';
      const pulse = .5 + .5 * Math.cos(time * 7);
      bulb.color.setHex(warningPhase ? 0xffb65c : patrol ? 0xef7549 : 0x736145);
      warning.color.setHex(warningPhase ? 0xffa44e : 0xff6640);
      warning.intensity = warningPhase ? 5 + pulse * 9 : patrol ? 4.5 : 0;
      shadow.visible = warningPhase && time > .4 && time < 2.6;
      shadow.position.z = windowZ + (time - 1.5) * .72;
    },
  };
  return repair;
}
