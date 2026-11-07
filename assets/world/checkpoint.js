import * as THREE from '../../vendor/three.module.min.js';

// Both missions occupy this checkpoint. Coordinates also drive inspection and the 2D renderer.
export const POST = {
  gateZ: -29.2, hingeX: -.65, span: 1.30, spawnZ: -27.6,
  plate: {x: -1.13, y: 1.75, z: -28.55},
  reader: {x: .82, y: 1.20, z: -28.65},
  hand: {x: -2.65, y: 1.06, z: -34.35},
  tape: {x: 2.75, y: 1.31, z: -34.70},
  clock: {x: 0, y: 1.82, z: -36.65},
  phone: {x: 1.13, y: 1.18, z: -36.60},
};

export function gateAngle(progress) {
  return Math.PI / 2 * progress * progress * (3 - 2 * progress);
}

export function gateBlocks(x, z, progress, radius) {
  const angle = gateAngle(progress), dx = x - POST.hingeX, dz = z - POST.gateZ;
  const along = Math.max(0, Math.min(POST.span, dx * Math.cos(angle) - dz * Math.sin(angle)));
  return Math.hypot(dx - along * Math.cos(angle), dz + along * Math.sin(angle)) < radius + .055;
}

function panel(w, h, draw, backlit = false) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  if (backlit) return new THREE.MeshBasicMaterial({map, toneMapped: false});
  return new THREE.MeshStandardMaterial({map, roughness: .8, emissive: 0xffecce, emissiveMap: map, emissiveIntensity: .24});
}

function passPlate() {
  return panel(512, 390, c => {
    c.fillStyle = '#24352e'; c.fillRect(0, 0, 512, 390);
    c.strokeStyle = '#b4ac86'; c.lineWidth = 3; c.strokeRect(9, 9, 494, 372);
    c.fillStyle = '#e2bb7d'; c.font = 'bold 39px monospace';
    c.fillText('МАРКИ ПРОПУСКА', 31, 63);
    for (const [i, label] of ['ГОСТЕВОЙ', 'ГРУЗОВОЙ', 'ДЕЖУРНЫЙ'].entries()) {
      const y = 118 + 99 * i;
      c.fillStyle = '#7d8772'; c.fillRect(26, y - 33, 460, 2);
      c.fillStyle = '#efdfb9'; c.strokeStyle = c.fillStyle; c.lineWidth = 9;
      if (i === 0) { c.beginPath(); c.arc(76, y + 15, 9, 0, Math.PI * 2); c.fill(); }
      if (i === 1) { c.fillRect(54, y + 5, 46, 7); c.fillRect(54, y + 23, 46, 7); }
      if (i === 2) { c.beginPath(); c.moveTo(59, y + 32); c.lineTo(92, y - 3); c.stroke(); }
      c.font = 'bold 44px monospace'; c.fillText(label, 136, y + 29);
    }
  });
}

function clockFace() {
  return panel(512, 512, c => {
    c.fillStyle = '#353c35'; c.fillRect(0, 0, 512, 512);
    c.fillStyle = '#d2c499'; c.beginPath(); c.arc(256, 256, 244, 0, Math.PI * 2); c.fill();
    c.translate(256, 256);
    for (let i = 0; i < 60; i++) {
      c.save(); c.rotate(i * Math.PI / 30);
      c.fillStyle = '#1e2a22'; c.fillRect(i % 5 ? -2 : -5, -225, i % 5 ? 4 : 10, i % 5 ? 9 : 18); c.restore();
    }
    c.fillStyle = '#19221c'; c.font = 'bold 49px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let hour = 1; hour <= 12; hour++) {
      const a = hour * Math.PI / 6;
      c.fillText(String(hour), Math.sin(a) * 181, -Math.cos(a) * 181);
    }
    c.font = '18px monospace'; c.fillText('ТАБЕЛЬНЫЕ', 0, 86);
    c.fillRect(-23, -10, 143, 20);
    c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
  }, true);
}

function recorderTape() {
  return panel(512, 270, c => {
    c.fillStyle = '#dacfb2'; c.fillRect(0, 0, 512, 270);
    c.fillStyle = '#ad9f86';
    for (let y = 70; y < 270; y += 30) c.fillRect(0, y, 512, 1);
    for (let x = 15; x < 512; x += 29) c.fillRect(x, 70, 1, 200);
    c.fillStyle = '#38413a'; c.font = 'bold 31px monospace'; c.fillText('КОНТРОЛЬНАЯ ЛЕНТА', 24, 44);
    c.fillRect(23, 145, 201, 5); c.fillRect(220, 105, 5, 45);
    for (const x of [279, 337]) { c.beginPath(); c.arc(x, 146, 7, 0, Math.PI * 2); c.fill(); }
    c.font = 'bold 42px monospace'; c.fillText('03:15', 146, 224);
  });
}

export function buildCheckpoint({group, mat, box, round, plane, block, mesh, sign, solid, lamp, at, table}) {
  const {gateZ, hingeX, span, plate, reader, tape, hand, clock, phone} = POST;
  const plateFace = passPlate(), dial = clockFace(), slip = recorderTape();
  const indicator = new THREE.MeshBasicMaterial({color: 0xff6b35});
  const glow = new THREE.PointLight(0xffcf81, 0, 7);
  glow.position.set(clock.x, 2.1, clock.z + .75);
  group.add(glow);

  const hinge = new THREE.Group();
  hinge.position.set(hingeX, 0, gateZ); group.add(hinge);
  const part = (parent, geo, material, x, y, z, w, h, d) => {
    const object = new THREE.Mesh(geo, material);
    object.position.set(x, y, z); object.scale.set(w, h, d);
    parent.add(object); return object;
  };
  for (const y of [.54, 1.05]) part(hinge, box, mat.zinc, span / 2, y, 0, span, .059, .071);
  for (const x of [.06, span - .08]) part(hinge, round, mat.steel, x, .80, 0, .048, .55, .048);
  part(hinge, box, mat.dark, span / 2, .80, 0, .38, .17, .037);
  for (const x of [-.09, .09]) part(hinge, box, mat.amber, span / 2 + x, .8, .024, .095, .14, .014).rotation.z = -.32;
  for (const side of [-1, 1]) {
    const x = side * 1.24;
    for (const y of [.54, 1.05]) block(mat.steel, x, y, gateZ, 1.17, .063, .075);
    for (const end of [.65, 1.70]) {
      mesh(round, mat.zinc, side * end, .61, gateZ, .10, 1.18, .10);
      block(mat.trim, side * end, .045, gateZ, .19, .09, .19);
    }
    solid(x, gateZ, 1.17, .12);
  }
  block(mat.steel, plate.x, 1.03, plate.z - .08, .085, 2.03, .085);
  block(mat.dark, plate.x, plate.y, plate.z - .055, 1.05, .81, .08);
  mesh(plane, plateFace, plate.x, plate.y, plate.z, 1.02, .777, 1);
  solid(plate.x, plate.z - .07, .14, .14);

  block(mat.paint, reader.x, .58, reader.z - .19, .30, 1.14, .43);
  block(mat.steel, reader.x, 1.13, reader.z - .21, .40, .14, .54);
  block(mat.dark, reader.x, 1.26, reader.z - .04, .41, .26, .10);
  block(mat.black, reader.x, 1.26, reader.z + .015, .19, .028, .008);
  block(indicator, reader.x + .14, 1.26, reader.z + .018, .04, .045, .012);
  sign('ЖЕТОН', 'ПРИЁМНИК 02', reader.x, .93, reader.z + .033, .26, .13);
  solid(reader.x, reader.z - .17, .36, .46);

  // The booth entrance frames the back wall. Beyond the gate the floor widens
  // into separate work areas for the loose hand, the recorder and the clock.
  const lintelZ = -31.02;
  for (const x of [-1.63, 1.63]) {
    block(mat.paint, x, 1.35, lintelZ, .12, 2.70, .16);
    solid(x, lintelZ, .12, .16);
  }
  block(mat.trim, 0, 2.81, lintelZ, 3.36, .29, .18);
  sign('БУДКА ДЕЖУРНОГО', 'УЧЁТ РАБОЧЕГО ВРЕМЕНИ', 0, 2.79, lintelZ + .10, 1.9, .37);
  sign('ТУРНИКЕТ № 2', 'КОНТРОЛЬ ПРОПУСКОВ', .65, 2.63, gateZ, 1.32, .43);
  for (const x of [.18, 1.10]) block(mat.steel, x, 3.05, gateZ - .016, .018, .42, .018);
  // Worn painted route, interrupted where boots cross the threshold.
  for (const z of [-29.95, -30.75, -31.55, -32.35]) block(mat.darkPaper, 0, .011, z, .10, .012, .55);
  for (const side of [-1, 1]) block(mat.darkPaper, side * .12, .011, -32.72, .085, .012, .37, -side * .75);

  at(hand.x, hand.z, 0, table);
  block(mat.darkPaper, hand.x, 1.005, hand.z, .69, .035, .43);
  const looseHand = new THREE.Group();
  looseHand.position.set(hand.x, 1.035, hand.z); looseHand.rotation.y = -.40;
  part(looseHand, box, mat.zinc, .052, 0, 0, .44, .025, .055);
  part(looseHand, round, mat.zinc, -.147, .01, 0, .128, .035, .128);
  part(looseHand, round, mat.black, -.147, .032, 0, .047, .006, .047);
  group.add(looseHand);
  at(tape.x, tape.z - .16, 0, table);
  block(mat.paint, tape.x, 1.21, tape.z - .04, .83, .45, .29);
  mesh(plane, slip, tape.x, tape.y, tape.z + .112, .73, .385, 1);
  for (const x of [-.36, .36]) mesh(round, mat.dark, tape.x + x, 1.51, tape.z - .08, .12, .11, .12);

  block(mat.paint, 0, .53, clock.z - .12, 3.16, 1.04, .82);
  block(mat.case, 0, 1.04, clock.z - .12, 3.28, .092, .96);
  solid(0, clock.z - .12, 3.18, .88);
  block(mat.dark, 0, 1.65, clock.z - .12, .89, 1.15, .35);
  mesh(plane, dial, 0, clock.y, clock.z + .063, .80, .80, 1);
  sign('ТАБЕЛЬ', 'ПОСТ 02', 0, 1.25, clock.z + .063, .44, .13);
  block(mat.black, phone.x, 1.15, phone.z, .46, .13, .31);
  mesh(round, mat.zinc, phone.x, 1.225, phone.z + .06, .17, .035, .17);
  block(mat.dark, phone.x, 1.32, phone.z - .075, .44, .068, .10);
  for (const side of [-1, 1]) {
    block(mat.black, phone.x + side * .195, 1.29, phone.z - .05, .14, .13, .15);
    block(mat.black, phone.x + side * .195, 1.24, phone.z - .04, .17, .05, .17);
  }
  for (let i = 0; i < 9; i++) block(mat.black, phone.x - .27, 1.18 - .043 * i,
    phone.z + .08 + (i % 2) * .035, .037, .05, .065);
  lamp(hand.x, hand.z, .89); lamp(tape.x, tape.z, .89);

  const cp = {progress: 0, active: false, looseHand, plateFace, dial, slip, pulse: 0,
    setProgress(progress) {
      cp.progress = progress;
      hinge.rotation.y = gateAngle(progress);
      const lit = progress >= .58, pulse = lit ? Math.max(0, 1 - (progress - .58) / .32) : 0;
      cp.pulse = pulse;
      // The illuminated dial has opaque ink. Keep its markings legible even
      // when the flashlight is close and the booth light is at full intensity.
      dial.color.setScalar(lit ? .91 + .09 * pulse : .38);
      glow.intensity = lit ? 5.5 + 19 * pulse : 0;
      indicator.color.setHex(cp.active ? 0xa9d889 : 0xff6b35);
    },
  };
  cp.setProgress(0);
  return cp;
}
