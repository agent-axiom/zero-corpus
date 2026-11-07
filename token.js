// Fixed face textures keep moving the token inexpensive on a small screen.
const size = 400;
const center = size / 2;
const radius = center - 7;
let faces;

function makeFace(reverse) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const metal = ctx.createLinearGradient(34, 40, 346, 348);
  for (const [offset, color] of [
    [0, '#6d532e'], [.19, '#b39b63'], [.38, '#d2bb81'],
    [.54, '#ac9156'], [.75, '#897244'], [1, '#5a472a']
  ]) metal.addColorStop(offset, color);
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, size, size);

  let seed = reverse ? 911 : 317;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // The marks left by rolling brass run in one direction on each blank.
  for (let i = 0; i < 450; i++) {
    const x = random() * size, y = random() * size;
    ctx.strokeStyle = random() < .5 ? '#fff0b320' : '#3a30191f';
    ctx.lineWidth = .35 + random() * .8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const length = random() * 90;
    ctx.lineTo(x + length, y + length * .09);
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = random() * size, y = random() * size, r = 6 + random() * 50;
    const tarnish = ctx.createRadialGradient(x, y, 0, x, y, r);
    tarnish.addColorStop(0, '#403e2423'); tarnish.addColorStop(1, '#403e2400');
    ctx.fillStyle = tarnish; ctx.fillRect(x-r, y-r, 2*r, 2*r);
  }

  function ring(r, width, color, offset = 0) {
    ctx.lineWidth = width; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(center, center+offset, r, 0, Math.PI*2); ctx.stroke();
  }
  ring(radius - 2, 4, '#58472b');
  ring(radius - 6, 4, '#e1c78b', -1);
  ring(radius - 9, 2, '#594a31', 1);
  if (reverse) {
    // One blow of a chisel, with a dark recessed flank and a bright burr.
    ctx.save(); ctx.translate(center, center); ctx.rotate(-.83);
    ctx.beginPath(); ctx.moveTo(-118, 0); ctx.lineTo(-77, -7);
    ctx.lineTo(113, -3); ctx.lineTo(119, 0); ctx.lineTo(72, 7);
    ctx.lineTo(-94, 5); ctx.closePath(); ctx.fillStyle = '#382e1f'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-118, 0); ctx.lineTo(111, -2);
    ctx.lineTo(74, 5); ctx.lineTo(-93, 4); ctx.closePath(); ctx.fillStyle = '#786342'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-111, 3); ctx.lineTo(-69, 6.6);
    ctx.lineTo(73, 8); ctx.lineTo(117, 1); ctx.lineWidth = 2;
    ctx.strokeStyle = '#e7cd8b'; ctx.stroke(); ctx.restore();
  } else {
    // Same die as the institute's triangular sign at the start of the game.
    const stamp = new Path2D('M18 2 35 32H1L18 2Zm0 10L9 28h18l-2.4-4.3H16l2.5-4.4h3.6L18 12Z');
    for (const [offset, ink] of [[2.8, '#e1c990'], [-2.2, '#53442b'], [0, '#9c8553']]) {
      ctx.save(); ctx.translate(121, 110 + offset); ctx.scale(4.4, 4.4);
      ctx.fillStyle = ink; ctx.fill(stamp, 'evenodd'); ctx.restore();
      ctx.textAlign = 'center'; ctx.font = 'bold 28px sans-serif'; ctx.fillStyle = ink;
      ctx.fillText('НИИ «КОНТУР»', center, 289 + offset);
    }
  }
  // Crop the blank to its outer edge after adding the die and patina.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI*2); ctx.fill();
  return canvas;
}

export function mountToken(container, onMarkSeen) {
  const panel = document.createElement('div');
  panel.className = 'token-inspector';
  panel.innerHTML = `
    <div class="token-tray"><canvas class="token-object" width="480" height="480" aria-hidden="true"></canvas></div>
    <div class="token-controls">
      <div><span class="token-side" role="status" aria-live="polite" aria-atomic="true"></span>
        <span class="token-instruction">Потяните жетон в сторону.</span></div>
      <button type="button" class="secondary token-flip">Перевернуть</button>
    </div>`;
  container.replaceChildren(panel);
  const canvas = panel.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx && !faces) faces = [makeFace(false), makeFace(true)];
  const caption = panel.querySelector('.token-side');
  const flip = panel.querySelector('.token-flip');
  let angle = 0, frame = 0, pointer = null, startX = 0, startAngle = 0, seen = false;

  function draw() {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    if (ctx) {
      ctx.clearRect(0, 0, 480, 480);
      ctx.save(); ctx.translate(240, 238);
      const r = 201, rx = Math.max(.2, r * Math.abs(cosine));
      const thickness = 16 * Math.abs(sine);
      const faceX = Math.sign(cosine) * sine * 8;
      const edge = ctx.createLinearGradient(0, -r, 0, r);
      edge.addColorStop(0, '#c6b07b'); edge.addColorStop(.21, '#8a7549');
      edge.addColorStop(.45, '#d2b982'); edge.addColorStop(.70, '#776340');
      edge.addColorStop(1, '#3b3221');
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.ellipse(thickness/2, 0, rx, r, 0, -Math.PI/2, Math.PI/2);
      ctx.ellipse(-thickness/2, 0, rx, r, 0, Math.PI/2, 3*Math.PI/2);
      ctx.closePath(); ctx.fill();
      // The face bitmap has a narrow transparent pad outside its rim.
      const h = r * size / radius, w = h * Math.abs(cosine);
      ctx.drawImage(faces[cosine < 0 ? 1 : 0], faceX-w/2, -h/2, w, h);
      if (Math.abs(cosine) > .01) {
        ctx.beginPath(); ctx.ellipse(faceX, 0, rx, r, 0, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(35,29,20,' + (.43 * (1-Math.abs(cosine))) + ')';
        ctx.fill();
      }
      ctx.restore();
    }
    const side = cosine > .52 ? 'Лицевая сторона · клеймо НИИ «Контур»'
      : cosine < -.52 ? 'Оборот · одна косая насечка' : 'Ребро жетона';
    if (caption.textContent !== side) caption.textContent = side;
    if (cosine < -.52 && !seen) { seen = true; onMarkSeen(); }
  }
  function turnTo(target) {
    cancelAnimationFrame(frame);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target-angle) < .015) {
      angle = target; draw(); return;
    }
    const from = angle, begin = performance.now();
    function animate(now) {
      if (!panel.isConnected) return;
      const progress = Math.min(1, (now-begin)/280);
      angle = from + (target-from) * (1-(1-progress)**3);
      draw();
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }
  canvas.addEventListener('pointerdown', event => {
    if (pointer !== null || event.button !== 0) return;
    cancelAnimationFrame(frame);
    pointer = event.pointerId; startX = event.clientX; startAngle = angle;
    canvas.setPointerCapture(pointer);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    angle = startAngle + (event.clientX-startX) * 2*Math.PI/canvas.clientWidth;
    draw();
  });
  function release(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    turnTo(Math.round(angle/Math.PI) * Math.PI);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  flip.addEventListener('click', () => turnTo((Math.round(angle/Math.PI)+1)*Math.PI));
  draw();
}
