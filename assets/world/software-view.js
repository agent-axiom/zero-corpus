// A low-resolution raycast view also runs on devices without a WebGL 2 context.
import {CELL, HEIGHT} from './facility.js';

function shade(rgb, light) {
  const word = Math.min(255, rgb[0] * light) | (Math.min(255, rgb[1] * light) << 8) | (Math.min(255, rgb[2] * light) << 16);
  return (0xff000000 | word) >>> 0;
}
function rgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

export function softwareView(canvas) {
  const ctx = canvas.getContext('2d', {alpha: false});
  let wall, ground, ceiling, buffer, pixels, depths;
  let previousColor = '';
  function cast(layout, x, z, dx, dz) {
    let col = Math.floor(x / CELL + .5), row = Math.floor(-z / CELL + .5);
    const sx = dx >= 0 ? 1 : -1, sr = dz < 0 ? 1 : -1;
    const stepX = CELL / Math.max(.00001, Math.abs(dx));
    const stepR = CELL / Math.max(.00001, Math.abs(dz));
    let crossX = Math.abs(((col + sx * .5) * CELL - x) / (dx || .00001));
    let crossR = Math.abs((-(row + sr * .5) * CELL - z) / (dz || .00001));
    for (let i = 0; i < 48; i++) {
      const vertical = crossX < crossR;
      const distance = vertical ? crossX : crossR;
      if (vertical) { col += sx; crossX += stepX; }
      else { row += sr; crossR += stepR; }
      if (!layout.has(col, row)) {
        const along = (vertical ? z + distance * dz : x + distance * dx) / CELL + .5;
        return {distance, vertical, u: along - Math.floor(along)};
      }
    }
    return {distance: 60, vertical: false, u: 0};
  }

  return function draw({camera, layout, facility, flashlight, watcher, collected}) {
    const w = canvas.width, h = canvas.height;
    const eye = camera.position;
    const yaw = camera.rotation.y, pitch = camera.rotation.x;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const f = h / (2 * Math.tan(camera.fov * Math.PI / 360));
    const horizon = h / 2 + f * Math.tan(pitch);
    if (previousColor !== facility.colors[0]) {
      previousColor = facility.colors[0];
      wall = [rgb(facility.colors[0]), rgb(facility.colors[1])];
      ground = rgb(facility.colors[2]); ceiling = rgb(facility.colors[3]);
    }
    if (!buffer || buffer.width !== w || buffer.height !== h) {
      buffer = ctx.createImageData(w, h);
      pixels = new Uint32Array(buffer.data.buffer);
      depths = new Float32Array(w);
    }
    // Draw the entire world in one raster upload. Per-column canvas draw
    // commands become costly on the same software GPUs this view targets.
    for (let y = 0; y < h; y++) {
      const floor = y > horizon, color = floor ? ground : ceiling;
      const distance = (floor ? eye.y : HEIGHT - eye.y) * f / Math.max(.01, Math.abs(y - horizon));
      const light = (floor ? .88 : .83) / (1 + .06 * distance) + .085;
      const tile = shade(color, light), seam = shade(color, light * .73);
      const spacing = CELL / (floor ? 4 : 3);
      const dx = cs * distance / f, dz = -sn * distance / f;
      let wx = eye.x - sn * distance - dx * w / 2;
      let wz = eye.z - cs * distance - dz * w / 2;
      for (let x = 0, index = y * w; x < w; x++, index++, wx += dx, wz += dz) {
        const ux = wx / spacing, uz = wz / spacing;
        const joint = distance < 15 && (ux - Math.floor(ux) < .032 || uz - Math.floor(uz) < .032);
        pixels[index] = joint ? seam : tile;
      }
    }
    for (let i = 0; i < w; i++) {
      const right = (i - w / 2) / f;
      const hit = cast(layout, eye.x, eye.z, -sn + cs * right, -cs - sn * right);
      const depth = Math.max(.11, hit.distance);
      depths[i] = depth;
      const y = horizon - (HEIGHT - eye.y) * f / depth;
      const hWall = HEIGHT * f / depth;
      let amount = (.74 + (flashlight ? .32 * Math.max(0, 1 - Math.abs(right * 1.4)) : 0)) / (1 + .049 * depth);
      if (hit.vertical) amount *= .86;
      if (hit.u < .012 || hit.u > .994) amount *= .76;
      amount *= .97 + .03 * Math.sin(hit.u * 149 + Math.floor(hit.u * 15));
      const top = shade(wall[0], amount), lower = shade(wall[1], amount), trim = shade(wall[1], amount * .46);
      const start = Math.max(0, Math.floor(y)), end = Math.min(h, Math.ceil(y + hWall));
      for (let line = start, off = start * w + i; line < end; line++, off += w) {
        const t = (line - y) / hWall;
        pixels[off] = t < .45 ? top : t < .465 || t > .94 ? trim : lower;
      }
    }
    ctx.putImageData(buffer, 0, 0);

    const sprites = [];
    function project(x, z) {
      const dx = x - eye.x, dz = z - eye.z;
      const d = -dx * sn - dz * cs;
      if (d < .20) return null;
      return {cx: w / 2 + (dx * cs - dz * sn) * f / d, scale: f / d, d};
    }
    function sprite(x, y, z, width, height, color, label = '') {
      const p = project(x, z);
      if (!p) return;
      const top = horizon - (y + height - eye.y) * p.scale;
      sprites.push({x: p.cx - width * p.scale / 2, y: top, w: width * p.scale,
        h: height * p.scale, d: p.d, color, label});
    }
    for (const room of layout.rooms) {
      const x = room.side * .99, z = -(room.row - .50) * CELL;
      const text = room.side < 0 ? '← ' + room.title : room.title + ' →';
      sprite(x, 2.38, z, 1.42, .42, '#30392e', text);
    }
    for (const o of facility.obstacles) {
      const isTable = Object.values(layout.points).some(p => Math.hypot(p.x - o.x, p.z - o.z) < .85);
      if (isTable) continue;
      const tall = Math.max(o.w, o.d) >= .57;
      const width = Math.max(.45, o.w * 1.7 + o.d * .55);
      sprite(o.x, .03, o.z, width, tall ? 1.65 : .60, tall ? '#485348' : '#686450');
      sprite(o.x, tall ? 1.22 : .59, o.z, width * .5, .09, '#8c8b70');
    }
    for (const lamp of facility.lights) sprite(lamp.x, HEIGHT - .09, lamp.z, 1.4, .085, '#d7cc9d');
    for (const kind of ['item', 'clue', 'station']) {
      const p = layout.points[kind];
      const width = kind === 'station' ? 1.30 : 1.65;
      sprite(p.x, .04, p.z, width * .84, .86, '#414941');
      sprite(p.x, .9, p.z, width, .12, '#898574');
      if (kind === 'item' && !collected) sprite(p.x, 1.05, p.z, .33, .18, '#e2b067');
      if (kind === 'clue') sprite(p.x, 1.02, p.z, .52, .57, '#d5cbae');
      if (kind === 'station') {
        sprite(p.x, 1.04, p.z, .86, .68, '#827e6a');
        sprite(p.x, 1.20, p.z + .06, .62, .37, '#7eaa78');
      }
    }
    if (watcher.visible) {
      const p = watcher.position;
      sprite(p.x, .02, p.z, .34, 2.22, '#181d19');
      sprite(p.x, 1.28, p.z, .55, .73, '#272b23');
    }
    sprites.sort((a, b) => b.d - a.d);
    for (const s of sprites) {
      const first = Math.max(0, Math.floor(s.x)), last = Math.min(w, Math.ceil(s.x + s.w));
      ctx.fillStyle = s.color;
      for (let i = first; i < last; i++) if (depths[i] + .03 > s.d) ctx.fillRect(i, s.y, 1, s.h);
      const center = Math.round(s.x + s.w / 2);
      if (s.label && s.w >= 22 && center >= 0 && center < w && depths[center] + .03 > s.d) {
        ctx.font = 'bold ' + Math.max(4, Math.round(s.h * .47)) + 'px monospace';
        ctx.textAlign = 'center'; ctx.fillStyle = '#d5cdb2';
        ctx.fillText(s.label, center, s.y + s.h * .68, s.w * .89);
      }
    }
  };
}
