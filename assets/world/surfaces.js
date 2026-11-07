import * as THREE from '../../vendor/three.module.min.js';

export function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const palettes = [
  ['#b2ac88', '#5e6a58', '#726d5a', '#948f74', '#ffdd94'],
  ['#b9ada0', '#6b5d53', '#6a675e', '#9d9184', '#ffc27d'],
  ['#b6a98a', '#685e4f', '#797266', '#a59c8c', '#efdcaf'],
  ['#adc2c0', '#526461', '#64716d', '#8a9e9a', '#c3e2df'],
  ['#bac6b7', '#7c9586', '#78837b', '#a5b2a5', '#d9f1d4'],
  ['#c0b0a0', '#745c53', '#766b61', '#9b9285', '#ffd09b'],
  ['#bfae97', '#756557', '#827161', '#b1a795', '#edce95'],
  ['#b8af9b', '#676855', '#787265', '#9d9987', '#f6d5ac'],
  ['#b8a5a1', '#735652', '#786a69', '#998987', '#ffb9a9'],
  ['#b7b7ad', '#5c625f', '#757774', '#9c9c92', '#e5eadc'],
];

function surfaceCanvas(width = 384, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function rasterTexture(canvas) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function grain(ctx, size, rand, strength) {
  const pixels = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = (rand() + rand() - 1) * strength;
    pixels.data[i] += v;
    pixels.data[i + 1] += v;
    pixels.data[i + 2] += v;
  }
  ctx.putImageData(pixels, 0, 0);
}

function concrete(type, colors, seed, chapter) {
  const [canvas, ctx] = surfaceCanvas();
  const s = canvas.width;
  const rand = randomSource(seed);
  ctx.fillStyle = type === 'wall' ? colors[0] : type === 'floor' ? colors[2] : colors[3];
  ctx.fillRect(0, 0, s, s);
  if (type === 'wall') {
    ctx.fillStyle = colors[1];
    ctx.fillRect(0, s * .45, s, s);
    ctx.fillStyle = 'rgba(32,34,25,.57)';
    ctx.fillRect(0, s * .45 - 3, s, 4);
    ctx.fillStyle = 'rgba(214,209,164,.43)';
    ctx.fillRect(0, s * .45 + 5, s, 2);
    if (chapter === 4) {
      ctx.fillStyle = 'rgba(217,224,206,.49)';
      for (let x = 0; x < s; x += s / 13) ctx.fillRect(x, s * .45, 1.4, s);
      for (let y = s * .45; y < s; y += s / 12) ctx.fillRect(0, y, s, 1.4);
    } else if (chapter === 6) {
      for (let x = 0; x < s; x += 16) for (let y = 7; y < s * .45; y += 13) {
        ctx.fillStyle = 'rgba(108,78,65,.11)';
        ctx.fillRect(x + (y % 2) * 7, y, 3, 6);
        ctx.fillRect(x + (y % 2) * 7 - 1, y + 3, 5, 2);
      }
    }
  }

  for (let i = 0; i < 115; i++) {
    const x = rand() * s, y = rand() * s, radius = 8 + rand() * 75;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const alpha = type === 'floor' ? .14 : .11;
    stain.addColorStop(0, 'rgba(46,43,27,' + rand() * alpha + ')');
    stain.addColorStop(1, 'rgba(46,43,27,0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  if (type === 'wall') {
    for (let i = 0; i < 160; i++) {
      const y = rand() < .65 ? rand() * 23 : s * .45;
      const x = rand() * s, length = 1 + Math.pow(rand(), 3) * 105;
      const drip = ctx.createLinearGradient(0, y, 0, y + length);
      drip.addColorStop(0, 'rgba(58,49,28,.16)');
      drip.addColorStop(1, 'rgba(58,49,28,0)');
      ctx.fillStyle = drip;
      ctx.fillRect(x, y, 1 + rand() * 4, length);
    }
  }
  const seg = type === 'ceiling' ? 3 : type === 'floor' ? 4 : 1;
  for (let i = 0; i <= seg; i++) {
    const pos = Math.min(s - 1, Math.floor(i * s / seg));
    ctx.fillStyle = type === 'wall' ? 'rgba(24,26,18,.19)' : 'rgba(24,26,18,.48)';
    ctx.fillRect(pos, 0, 2, s);
    if (type !== 'wall') ctx.fillRect(0, pos, s, 2);
    ctx.fillStyle = 'rgba(220,222,196,.19)';
    ctx.fillRect(pos + 2, 0, 1, s);
    if (type !== 'wall') ctx.fillRect(0, pos + 2, s, 1);
  }
  for (let i = 0; i < 180; i++) {
    const x = rand() * s, y = rand() * s;
    ctx.fillStyle = rand() > .5 ? 'rgba(218,212,180,.25)' : 'rgba(29,33,22,.22)';
    ctx.fillRect(x, y, .6 + rand() * 3.2, .5 + rand() * 1.3);
  }
  if (type === 'wall') {
    const base = ctx.createLinearGradient(0, s * .84, 0, s);
    base.addColorStop(0, 'rgba(18,27,18,0)');
    base.addColorStop(1, 'rgba(18,27,18,.45)');
    ctx.fillStyle = base;
    ctx.fillRect(0, s * .84, s, s * .16);
  }
  grain(ctx, s, rand, type === 'floor' ? 22 : 16);
  return rasterTexture(canvas);
}

export function makeSurfaces(colors, chapter) {
  const seed = chapter + 391;
  const wallMap = concrete('wall', colors, seed + 11, chapter);
  const floorMap = concrete('floor', colors, seed + 79, chapter);
  const ceilingMap = concrete('ceiling', colors, seed + 127, chapter);
  const [enamel, e] = surfaceCanvas(192);
  const rand = randomSource(seed + 452);
  e.fillStyle = '#e6e6e4';
  e.fillRect(0, 0, 192, 192);
  grain(e, 192, rand, 17);
  for (let i = 0; i < 170; i++) {
    const x = rand() * 192, y = rand() * 192;
    e.fillStyle = 'rgba(51,46,37,' + (.06 + rand() * .15) + ')';
    e.fillRect(x, y, 1 + Math.pow(rand(), 4) * 17, .4 + rand() * 1.1);
  }
  for (let i = 0; i < 360; i++) {
    const x = rand() * 192, y = Math.pow(rand(), 3) * 8;
    e.fillStyle = rand() > .6 ? '#787465' : '#b4b1a0';
    e.fillRect(x, i % 2 ? y : 192 - y, rand() * 2.2 + .5, .8);
  }
  const enamelMap = rasterTexture(enamel);
  const [shadow, sh] = surfaceCanvas(64);
  const gradient = sh.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(12,15,8,.56)');
  gradient.addColorStop(.52, 'rgba(12,15,8,.39)');
  gradient.addColorStop(1, 'rgba(12,15,8,0)');
  sh.fillStyle = gradient;
  sh.fillRect(0, 0, 64, 64);
  const standard = (color, roughness = .8, metalness = 0) =>
    new THREE.MeshStandardMaterial({color, map: enamelMap, roughness, metalness});
  const basic = color => new THREE.MeshBasicMaterial({color});
  return {
    ao: new THREE.MeshBasicMaterial({map: rasterTexture(shadow), transparent: true, depthWrite: false}),
    wall: new THREE.MeshStandardMaterial({map: wallMap, roughness: .92}),
    floor: new THREE.MeshStandardMaterial({map: floorMap, roughness: .62}),
    ceiling: new THREE.MeshStandardMaterial({map: ceilingMap, roughness: .94}),
    trim: standard('#383c35'), dark: standard('#222925', .72, .3),
    steel: standard('#535c58', .48, .46), zinc: standard('#8a9282', .48, .5),
    paint: standard(colors[1]), door: standard('#626a5a', .69, .17),
    rust: standard('#795742', .8, .25), case: standard('#8a8774', .72, .15),
    darkPaper: standard('#7d6b4b'), paper: standard('#c9c6aa'),
    amber: basic('#ebae55'), red: basic('#ff4b23'), green: basic('#a7ce72'),
    tube: basic(colors[4]), glass: standard('#25362e', .28, .32),
    black: standard('#181b18'), cloth: standard('#252a27', .95),
  };
}

export function labelMaterial(heading, caption, variant = 'sign') {
  const [canvas, ctx] = surfaceCanvas(512, 192);
  const dark = variant !== 'paper' && variant !== 'stencil';
  ctx.fillStyle = dark ? (variant === 'screen' ? '#15221c' : '#26322d') : '#c8c3a3';
  ctx.fillRect(0, 0, 512, 192);
  const fg = variant === 'screen' ? '#a9d392' : dark ? '#d4d1af' : '#394138';
  ctx.fillStyle = fg;
  if (variant === 'sign') {
    ctx.strokeStyle = '#807f6b';
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, 498, 178);
    ctx.fillStyle = '#c18d4a';
    ctx.fillRect(21, 31, 9, 126);
  }
  const x = variant === 'sign' ? 48 : 24;
  ctx.fillStyle = fg;
  ctx.font = 'bold 58px monospace';
  ctx.fillText(heading, x, 101, 484 - x);
  ctx.font = '25px monospace';
  ctx.fillText(caption, x, 149, 484 - x);
  if (variant === 'screen') {
    ctx.fillStyle = '#ffffff10';
    for (let i = 0; i < 192; i += 6) ctx.fillRect(0, i, 512, 1);
  }
  const map = rasterTexture(canvas);
  if (variant === 'screen') return new THREE.MeshBasicMaterial({map});
  return new THREE.MeshStandardMaterial({map, roughness: .88, emissive: 0xb2ab91, emissiveMap: map, emissiveIntensity: .21});
}
