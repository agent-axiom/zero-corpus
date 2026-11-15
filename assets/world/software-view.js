// A low-resolution raycast view also runs on devices without a WebGL 2 context.
import {CELL, HEIGHT} from './facility.js';
import {gateAngle, POST} from './checkpoint.js';
import {REPAIR} from './repair.js';
import {CHAPTER_SITES} from './chapter.js';
import {SIGNAL_BOARD, SIGNAL_SITES} from './signals.js';
import {ARCHIVE_CAROUSEL, ARCHIVE_SITES} from './archive.js';
import {WATER_SITES} from './water.js';
import {SANITARY_SITES} from './sanitary.js';

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
    function sprite(x, y, z, width, height, color, label = '', face = null, dim = 0) {
      const p = project(x, z);
      if (!p) return;
      const top = horizon - (y + height - eye.y) * p.scale;
      sprites.push({x: p.cx - width * p.scale / 2, y: top, w: width * p.scale,
        h: height * p.scale, d: p.d, color, label, face, dim});
    }
    function panel(x1, z1, x2, z2, bottom, height, color) {
      const a = project(x1, z1),
        b = project(x2, z2);
      if (!a || !b) return;
      const topA = horizon - (bottom + height - eye.y) * a.scale;
      const topB = horizon - (bottom + height - eye.y) * b.scale;
      sprites.push({
        x: Math.min(a.cx, b.cx),
        w: Math.abs(a.cx - b.cx),
        y: Math.min(topA, topB),
        h: height * Math.max(a.scale, b.scale),
        d: (a.d + b.d) / 2,
        color,
        quad: [
          [a.cx, topA],
          [b.cx, topB],
          [b.cx, topB + height * b.scale],
          [a.cx, topA + height * a.scale],
        ],
      });
    }
    for (const room of layout.rooms) {
      const x = room.side * .99, z = -(room.row - .50) * CELL;
      const text = room.side < 0 ? '← ' + room.title : room.title + ' →';
      sprite(x, 2.38, z, 1.42, .42, '#30392e', text);
    }
    for (const o of facility.obstacles) {
      const isTable = Object.values(layout.points).some(p => Math.hypot(p.x - o.x, p.z - o.z) < .85);
      const reception = layout.opening && o.x === layout.rooms[0].x && o.z === layout.rooms[0].z;
      if (isTable || reception || o.checkpoint || o.repair || o.chapterProp) continue;
      const tall = Math.max(o.w, o.d) >= .57;
      const width = Math.max(.45, o.w * 1.7 + o.d * .55);
      sprite(o.x, .03, o.z, width, tall ? 1.65 : .60, tall ? '#485348' : '#686450');
      sprite(o.x, tall ? 1.22 : .59, o.z, width * .5, .09, '#8c8b70');
    }
    for (const lamp of facility.lights) sprite(lamp.x, HEIGHT - .09, lamp.z, 1.4, .085, '#d7cc9d');
    const checkpoint = facility.checkpoint;
    if (checkpoint) {
      const {gateZ, hingeX, span, plate, reader, hand, tape, clock, phone} = POST;
      const angle = gateAngle(checkpoint.progress);
      for (const y of [.54, 1.05]) {
        for (let d = .04; d < span; d += .08) {
          sprite(hingeX + d * Math.cos(angle), y, gateZ - d * Math.sin(angle), .115, .068, '#a5a58e');
        }
      }
      for (const d of [.06, span - .08]) sprite(hingeX + d * Math.cos(angle), .54,
        gateZ - d * Math.sin(angle), .068, .53, '#7b8473');
      sprite(hingeX + span * .5 * Math.cos(angle), .71, gateZ - span * .5 * Math.sin(angle),
        .35, .17, '#9f8652');
      for (const side of [-1, 1]) {
        for (const d of [.65, 1.70]) sprite(side * d, .03, gateZ, .1, 1.18, '#929885');
        for (const y of [.54, 1.05]) sprite(side * 1.24, y, gateZ, 1.17, .064, '#727b6b');
        sprite(side * 1.63, .02, -31.02, .13, 2.69, '#596654');
      }
      sprite(0, 2.67, -31.02, 3.30, .29, '#3e4b41', 'БУДКА ДЕЖУРНОГО');
      sprite(.65, 2.42, gateZ, 1.32, .43, '#354437', 'ТУРНИКЕТ № 2');
      sprite(plate.x, .02, plate.z - .08, .085, 1.81, '#6c7869');
      sprite(plate.x, plate.y - .39, plate.z, 1.03, .78, '#3b493d', '', checkpoint.plateFace.map.image);
      sprite(reader.x, .03, reader.z - .10, .34, 1.11, '#596557');
      sprite(reader.x, 1.14, reader.z - .04, .42, .25, '#41473b', 'ЖЕТОН');
      sprite(reader.x + .14, 1.24, reader.z + .02, .035, .042, checkpoint.active ? '#afde89' : '#ee673a');
      const desk = layout.rooms[0];
      for (const point of [desk, hand, tape]) {
        sprite(point.x, .04, point.z, 1.39, .87, '#485348');
        sprite(point.x, .89, point.z, 1.65, .12, '#8b8975');
      }
      if (layout.id === 1 && !collected) sprite(desk.x, 1.005, desk.z, .27, .1, '#d6aa69');
      sprite(hand.x, .99, hand.z + .01, .65, .068, '#756346');
      if (checkpoint.looseHand.visible) {
        sprite(hand.x, 1.052, hand.z + .02, .44, .055, '#c0c1a7');
        sprite(hand.x - .15, 1.046, hand.z + .03, .11, .077, '#a1a593');
      }
      sprite(tape.x, 1.02, tape.z - .08, .83, .47, '#596557');
      sprite(tape.x, tape.y - .19, tape.z + .11, .73, .38, '#c8c3a2', '', checkpoint.slip.map.image);
      sprite(clock.x, .02, clock.z - .12, 3.18, 1.02, '#535f51');
      sprite(clock.x, 1.03, clock.z - .12, 3.28, .08, '#8a8871');
      sprite(clock.x, 1.10, clock.z - .09, .90, 1.15, '#42483c');
      if (checkpoint.progress >= .58) sprite(clock.x, 1.40, clock.z + .04, .84, .84,
        checkpoint.pulse > .3 ? '#ffda90' : '#c8b080');
      sprite(clock.x, clock.y - .40, clock.z + .07, .8, .8, '#c5bc9d', '', checkpoint.dial.map.image, checkpoint.progress < .58 ? .42 : 0);
      if(checkpoint.minuteHand.visible) for(let length=.03;length<.29;length+=.025) {
        sprite(clock.x+Math.sin(17*Math.PI/30)*length,clock.y+Math.cos(17*Math.PI/30)*length,
          clock.z+.08,.018,.025,'#283027');
      }
      sprite(phone.x, 1.09, phone.z, .47, .13, '#242b24');
      sprite(phone.x, 1.29, phone.z - .075, .45, .08, '#1d241e');
      for (const side of [-1, 1]) sprite(phone.x + side * .19, 1.22, phone.z - .05, .14, .115, '#202820');
      for (const z of [-29.95, -30.75, -31.55, -32.35]) sprite(0, .01, z, .10, .035, '#a48e60');
    } else if (!facility.chapterScene) for (const kind of ['item', 'clue', 'station']) {
      if (facility.repair && kind === 'item') continue;
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
    if (facility.chapterScene) {
      const chapter = facility.chapterScene;
      for (const door of chapter.doors) {
        if (door.axis === 'z') {
          const high = door.z - 3.835,
            low = door.z + 3.465;
          panel(door.x, high, door.x, door.z - 0.85, 0, 2.86, '#5c6956');
          panel(door.x, door.z + 0.85, door.x, low, 0, 2.86, '#5c6956');
          panel(door.x, door.z - 0.85, door.x, door.z + 0.85, 2.4, 0.46, '#5c6956');
        }
        const angle = (door.progress * Math.PI) / 2;
        const dx = (door.axis === 'z' ? Math.sin(angle) * (door.side ?? 1) : Math.cos(angle)) * door.span;
        const dz = (door.axis === 'z' ? Math.cos(angle) : -Math.sin(angle)) * door.span;
        panel(door.hingeX, door.hingeZ, door.hingeX + dx, door.hingeZ + dz, 0, 2.4, '#435340');
        sprite(door.hingeX + dx * 0.65, 1.05, door.hingeZ + dz * 0.65, 0.09, 0.18, '#b4b39a');
        sprite(
          door.hingeX + dx * 0.5,
          1.6,
          door.hingeZ + dz * 0.5,
          0.08,
          0.1,
          door.target ? '#b9d18f' : '#dc6740',
        );
      }
      for (const [id, station] of chapter.stations) {
        const p = station.point,
          site = CHAPTER_SITES[id] || SIGNAL_SITES[id] || ARCHIVE_SITES[id] || WATER_SITES[id] || SANITARY_SITES[id],
          item = chapter.items.get(id);
        if (id !== 9) {
          sprite(p.x, 0.03, p.z - 0.17, 1.18, 1.1, '#505d4c');
          sprite(p.x, 1.12, p.z - 0.12, 1.34, 0.08, '#858976');
        }
        sprite(
          p.x,
          id === 9 ? 1.04 : p.y - 0.19,
          p.z + 0.2,
          id === 9 ? 0.28 : 0.78,
          id === 9 ? 0.1 : 0.38,
          station.changed.visible ? '#abc987' : '#9b6843',
        );
        sprite(p.x, 1.76, p.z - 0.12, 1.6, 0.37, '#344532', station.label);
        sprite(site.clue.x, site.clue.y - 0.3, site.clue.z, 0.86, 0.6, '#c9c1a4', 'ЗАПИСЬ');
        if (item?.visible && id !== 3)
          sprite(site.item.x, site.item.y, site.item.z, 0.3, 0.11, id === 9 ? '#454431' : '#d5b47c');
        if (station.changed.visible) sprite(p.x, p.y - 0.04, p.z + 0.24, 0.4, 0.06, '#dccb92');
        if (station.texture) sprite(p.x,id===42?1.0:1.2,p.z+.25,id===31?2.13:id===42?1.8:1.23,id===42?1:.82,'#213c36','',station.texture.image);
      }
      if (chapter.sanitaryWing) {
        sprite(-6.5,.02,-11.6,1.25,2.2,'#c1c7ab',chapter.completed>=41?'ШКАФ ОТКРЫТ':'НАБЛЮДЕНИЯ');
        sprite(5.5,.4,-23.2,1.3,.4,'#a4b69b','ПУСТАЯ КОЙКА');
        sprite(7.95,1.94,-23.3,.08,.08,'#'+chapter.pulseLamp.color.getHexString());
        sprite(7.6,1.475,-23.3,.98,.35,'#1c3427','',chapter.pulseTexture.image);
        if(chapter.decoded.visible) sprite(-10.1,1.55,-25.42,.65,.3,'#d4cdb0','ЦЕХ');
        if(chapter.projection.visible) sprite(3.8,1.45,-26.2,1.2,.7,'#52745a','НИНА ВЫШЛА');
        if(chapter.completed>=48) sprite(7.5,.49,-20.82,1.1,.38,'#babfa2','ЛИЧНАЯ КАРТА');
        if(chapter.dispatchKey.visible) sprite(0,1.2,-38.77,.35,.05,'#d4c08f','КЛЮЧ');
      }
      if (chapter.waterWing) {
        if(chapter.flooded) sprite(0,.018,-23.8,3.2,.06,'#547c76');
        else for(let i=0;i<10;i++) sprite(i%2?.17:-.17,.024,-24-i*.52,.12,.025,'#27372e');
        sprite(-6.7,.05,-25.4,.85,1.4,'#23392f','БАК');
        sprite(-6.7,.22,-25.35,.6,chapter.completed>=37?.28:.85,'#78a3a0');
        if(chapter.firstFragment.visible) sprite(4.7,1.2,-14.98,.2,.07,'#ded2ad');
        if(chapter.secondFragment.visible) sprite(10.3,1.2,-29.48,.22,.08,'#ded2ad');
      }
      if (chapter.archiveWing) {
        sprite(ARCHIVE_CAROUSEL.x,.45,ARCHIVE_CAROUSEL.z+.07,1.6,1.9,'#384638','',chapter.carouselTexture.image);
        sprite(10.4,.02,-25.7,1.2,2,'#314233',chapter.completed>=27?'19 / ОТКРЫТ':'19');
        if(chapter.envelope.visible) sprite(10.4,1.02,-25.25,.55,.06,'#d5c8a6');
      }
      if (chapter.signalHouse) {
        sprite(SIGNAL_BOARD.x,.63,SIGNAL_BOARD.z+.07,2.15,1.34,'#2c382c','',chapter.boardTexture.image);
        sprite(1.6,2.51,-22.73,.35,.38,'#'+chapter.speaker.color.getHexString());
        if(chapter.crossWire.visible) sprite(1.25,1.6,-25.18,.38,.025,'#b67e53');
      }
      if (chapter.keyInLock?.visible) {
        const archive = chapter.doors[0],
          angle = (archive.progress * Math.PI) / 2;
        sprite(
          archive.hingeX - 0.11 * Math.cos(angle) + 1.3 * Math.sin(angle),
          1.01,
          archive.hingeZ + 0.11 * Math.sin(angle) + 1.3 * Math.cos(angle),
          0.2,
          0.05,
          '#d9b16f',
        );
      }
      if (chapter.completed < 7) sprite(-6, 0.02, -11.55, 0.9, 1.24, '#485641');
    }
    if (watcher.visible) {
      const p = watcher.position;
      sprite(p.x, .02, p.z, .34, 2.22, '#181d19');
      sprite(p.x, 1.28, p.z, .55, .73, '#272b23');
    }
    if (facility.repair) {
      const {wallX, doorZ, windowZ, item} = REPAIR, repair = facility.repair;
      // Side-facing panels preserve the doorway sightline while walking past.
      function partition(z, width, bottom, height, color, alpha = 1) {
        const a = project(wallX, z - width / 2), b = project(wallX, z + width / 2);
        if (!a || !b) return;
        const topA = horizon - (bottom + height - eye.y) * a.scale;
        const topB = horizon - (bottom + height - eye.y) * b.scale;
        sprites.push({x:Math.min(a.cx,b.cx),w:Math.abs(a.cx-b.cx),y:Math.min(topA,topB),
          h:height * Math.max(a.scale,b.scale),d:(a.d+b.d)/2,color,alpha,
          quad:[[a.cx,topA],[b.cx,topB],[b.cx,topB+height*b.scale],[a.cx,topA+height*a.scale]]});
      }
      for (const [z, width] of REPAIR.panels) partition(z,width,0,2.88,'#64705b');
      partition(doorZ,1.60,2.64,.36,'#64705b');
      partition(windowZ,1.25,0,1.08,'#64705b'); partition(windowZ,1.25,2.54,.34,'#64705b');
      partition(windowZ,1.20,1.11,1.38,'#b9c7b7',.18);
      for (let y = 1.16; y < 2.49; y += .045) partition(windowZ,1.18,y,.012,'#d2d5bd',.05);
      for (const z of [windowZ-.625,windowZ+.625]) partition(z,.06,1.05,1.5,'#454d3e');
      for (const y of [1.09,2.51]) partition(windowZ,1.3,y-.03,.065,'#454d3e');
      for (const z of [-24.37,-22.73]) partition(z,.095,0,2.58,'#454d3e');
      partition(doorZ,1.74,2.55,.12,'#454d3e');
      sprite(-2.65,.02,-24.16,1.4,2.38,'#495442');
      sprite(-2.65,1.13,-24.14,1.18,.88,'#a3b4a1');
      sprite(wallX,2.70,doorZ,1.8,.36,'#354535','РЕМОНТНАЯ');
      sprite(-1.71,.87,item.z,.65,.94,'#344236');
      sprite(-1.55,1.0,item.z+.02,.52,.68,'#1f2a21');
      sprite(-1.46,1.80,item.z+.03,.72,.25,'#384533','КЛЮЧНИЦА');
      if (facility.repair.key.visible) {
        sprite(item.x,1.19,item.z+.07,.18,.31,'#c5ad71');
        sprite(item.x,1.48,item.z+.08,.11,.10,'#aeb69a');
      }
      sprite(-1.44,2.16,item.z,.18,.18,
        repair.phase === 'warning' ? (Math.cos(repair.time*7) > 0 ? '#ffd394' : '#b66f36')
        : repair.phase === 'patrol' ? '#ef7549' : '#736145');
      if (repair.shadow.visible) {
        const p = repair.shadow.position;
        sprite(p.x, .02, p.z, .28, 2.15, '#29342b');
        sprite(p.x, 1.26, p.z, .46, .66, '#29342b');
      }
    }
    sprites.sort((a, b) => b.d - a.d);
    for (const s of sprites) {
      const first = Math.max(0, Math.floor(s.x)), last = Math.min(w, Math.ceil(s.x + s.w));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha ?? 1;
      for (let i = first; i < last;) {
        if (depths[i] + .03 <= s.d) { i++; continue; }
        const begin = i++;
        while (i < last && depths[i] + .03 > s.d) i++;
        if (s.quad) {
          ctx.save(); ctx.beginPath(); ctx.rect(begin, s.y, i - begin, s.h); ctx.clip();
          ctx.beginPath(); ctx.moveTo(...s.quad[0]);
          for (const point of s.quad.slice(1)) ctx.lineTo(...point);
          ctx.closePath(); ctx.fill(); ctx.restore();
        } else if (s.face) {
          ctx.save(); ctx.beginPath(); ctx.rect(begin, s.y, i - begin, s.h); ctx.clip();
          ctx.drawImage(s.face, s.x, s.y, s.w, s.h);
          if (s.dim) {
            ctx.fillStyle = 'rgba(25,28,22,' + s.dim + ')'; ctx.fillRect(s.x, s.y, s.w, s.h);
          }
          ctx.restore();
        } else ctx.fillRect(begin, s.y, i - begin, s.h);
      }
      ctx.globalAlpha = 1;
      const center = Math.round(s.x + s.w / 2);
      if (s.label && s.w >= 22 && center >= 0 && center < w && depths[center] + .03 > s.d) {
        ctx.font = 'bold ' + Math.max(4, Math.round(s.h * .47)) + 'px monospace';
        ctx.textAlign = 'center'; ctx.fillStyle = '#d5cdb2';
        ctx.fillText(s.label, center, s.y + s.h * .68, s.w * .89);
      }
    }
  };
}
