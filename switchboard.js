import {LINE_RECORDS} from './assets/world/signals.js';

export function mountSwitchboard(container, {state, monitor, onChange, onListen, onSubmit}) {
  container.innerHTML = `
    <section class="switchboard" aria-label="Коммутатор смены">
      <div class="sw-face">
        <canvas class="sw-cable" aria-hidden="true"></canvas>
        <div class="sw-lines" role="group" aria-label="Линейные гнёзда">
          ${LINE_RECORDS.map((record, index) => `<button type="button" class="sw-jack" data-line="${index}" aria-pressed="false"><span class="sw-lamp"></span><b>Линия ${record.name}</b><i class="sw-socket"></i><small>Не проверена</small></button>`).join('')}
        </div>
        <button type="button" class="sw-plug" aria-label="Перетащить штекер гарнитуры"><span></span>Гарнитура</button>
      </div>
      <p class="sw-instruction">Коснитесь гнезда или перетащите к нему штекер.</p>
      <div class="sw-screen"><canvas class="sw-wave" width="640" height="130" aria-hidden="true"></canvas><p class="sw-status" role="status" aria-live="polite"></p></div>
      <div class="sw-controls"><button type="button" class="secondary sw-listen">Прослушать</button>${monitor ? '' : '<button type="button" class="primary sw-commit">Зафиксировать линию</button>'}<button type="button" class="quiet sw-unplug">Снять штекер</button></div>
    </section>`;
  const panel = container.querySelector('.switchboard'),
    face = panel.querySelector('.sw-face');
  const jacks = [...panel.querySelectorAll('.sw-jack')],
    plug = panel.querySelector('.sw-plug');
  const cable = panel.querySelector('.sw-cable'),
    wave = panel.querySelector('.sw-wave'),
    status = panel.querySelector('.sw-status');
  const listen = panel.querySelector('.sw-listen'),
    unplug = panel.querySelector('.sw-unplug'),
    commit = panel.querySelector('.sw-commit');
  let selected = state.selectedLine,
    heard = [...state.heard],
    pointer = null,
    drag = null,
    animation = 0,
    timer = 0,
    stopAudio = null,
    listening = false;

  function drawCable() {
    if (!panel.isConnected) return;
    const rect = face.getBoundingClientRect(),
      start = plug.getBoundingClientRect(),
      end = selected >= 0 ? jacks[selected].getBoundingClientRect() : null;
    const ratio = Math.min(2, devicePixelRatio || 1);
    cable.width = Math.ceil(rect.width * ratio);
    cable.height = Math.ceil(rect.height * ratio);
    const ctx = cable.getContext('2d');
    ctx.scale(ratio, ratio);
    const sx = start.left + start.width / 2 - rect.left,
      sy = start.top + 10 - rect.top;
    const ex = drag ? drag.x - rect.left : end ? end.left + end.width / 2 - rect.left : sx + 37;
    const ey = drag ? drag.y - rect.top : end ? end.top + end.height * 0.62 - rect.top : sy - 30;
    ctx.strokeStyle = '#171b12';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx - 44, sy + 18, ex + 43, sy + 25, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = '#c6975e';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  function drawWave(progress = 0) {
    const ctx = wave.getContext('2d'),
      w = wave.width,
      h = wave.height;
    ctx.fillStyle = '#111d13';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#28452b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#b7cc8f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = x / w;
      let amplitude = 0;
      if (selected === 0) amplitude = (Math.sin(x * 2.1) + Math.sin(x * 0.73)) * 19;
      if (selected === 1)
        amplitude =
          Math.sin(x * 0.38) * Math.exp(-(((t - 0.32) / 0.037) ** 2)) * 45 +
          Math.sin(x * 1.7) * Math.exp(-(((t - 0.68) / 0.16) ** 2)) * 17;
      if (selected === 2) amplitude = Math.sin(x * 0.9) * Math.exp(-((t * 5) % 1) / 0.08) * 48;
      if (!heard[selected] && !listening) amplitude = 0;
      if (listening && t > progress) amplitude = 0;
      if (x === 0) ctx.moveTo(x, h / 2 - amplitude);
      else ctx.lineTo(x, h / 2 - amplitude);
    }
    ctx.stroke();
  }
  function refresh() {
    jacks.forEach((jack, index) => {
      jack.setAttribute('aria-pressed', String(index === selected));
      jack.classList.toggle('sw-heard', heard[index]);
      jack.querySelector('small').textContent = heard[index] ? 'Прослушана' : 'Не проверена';
    });
    listen.disabled = selected < 0 || listening;
    unplug.disabled = selected < 0;
    if (commit) commit.disabled = selected < 0 || !heard[selected] || listening;
    status.textContent =
      selected < 0
        ? 'Подключите гарнитуру к линии.'
        : heard[selected]
          ? LINE_RECORDS[selected].text
          : 'Линия ' + LINE_RECORDS[selected].name + ' подключена. Прослушайте сигнал.';
    drawCable();
    drawWave();
  }
  function cancelListening() {
    clearTimeout(timer);
    cancelAnimationFrame(animation);
    stopAudio?.();
    stopAudio = null;
    listening = false;
  }
  function select(index) {
    cancelListening();
    selected = index;
    drag = null;
    onChange({selectedLine: selected, heard: [...heard]});
    refresh();
  }
  jacks.forEach((jack, index) => jack.addEventListener('click', () => select(index)));
  unplug.addEventListener('click', () => select(-1));
  listen.addEventListener('click', () => {
    if (selected < 0 || listening) return;
    listening = true;
    const line = selected,
      started = performance.now();
    stopAudio = onListen(line);
    refresh();
    status.textContent = 'Линия ' + LINE_RECORDS[line].name + ' · идёт прослушивание';
    function animate(now) {
      if (!panel.isConnected) return;
      drawWave(Math.min(1, (now - started) / 1300));
      animation = requestAnimationFrame(animate);
    }
    animation = requestAnimationFrame(animate);
    timer = setTimeout(() => {
      if (!panel.isConnected || selected !== line) return;
      cancelListening();
      heard[line] = true;
      onChange({selectedLine: selected, heard: [...heard]});
      refresh();
    }, 1350);
  });
  commit?.addEventListener('click', () => {
    if (selected >= 0 && heard[selected] && !listening) onSubmit(selected);
  });
  plug.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    plug.setPointerCapture(pointer);
    event.preventDefault();
  });
  plug.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    drag = {x: event.clientX, y: event.clientY};
    drawCable();
  });
  function release(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sw-jack');
    if (target && panel.contains(target)) select(Number(target.dataset.line));
    else {
      drag = null;
      drawCable();
    }
  }
  plug.addEventListener('pointerup', release);
  plug.addEventListener('pointercancel', () => {
    pointer = null;
    drag = null;
    drawCable();
  });
  const resize = new ResizeObserver(drawCable);
  resize.observe(face);
  refresh();
  return () => {
    cancelListening();
    resize.disconnect();
  };
}
