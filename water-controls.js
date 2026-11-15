import {missions} from './campaign.js';
import {
  WATER_CHANNELS,
  WATER_MODES,
  WATER_SLOTS,
  WATER_VALVES,
  operateWater,
  restoreWater,
} from './assets/world/water.js';

const valveButton = (action, value, label) =>
  `<button type="button" class="wp-valve" data-water-action="${action}" data-value="${value}" aria-pressed="false"><b>${label}</b><span class="wp-wheel" aria-hidden="true"></span><small>Закрыт</small></button>`;
export function mountWaterControls(
  container,
  {state, mode, completed, monitor, onChange, onTurn, onSubmit},
) {
  let current = restoreWater(state, completed),
    selected = mode,
    pointer = null,
    ignoreClick = false;
  const events = new AbortController();
  container.innerHTML = `<section class="water-panel" aria-label="Управление трубами и вентилями">
    ${
      monitor
        ? `<div class="wp-tabs" role="group" aria-label="Приборы водомерного узла">${WATER_MODES.filter(
            (id) => completed >= id,
          )
            .map(
              (id) =>
                `<button type="button" class="secondary" data-water-mode="${id}">${missions[id - 1].station}</button>`,
            )
            .join(
              '',
            )}</div><p class="wp-instruction">Здесь сохранены завершённые настройки. Вернитесь к текущему прибору, чтобы продолжить работу.</p>`
        : ''
    }
    <h3 class="wp-title"></h3><div class="wp-device"></div><p class="wp-state" role="status" aria-live="polite"></p>
    ${monitor ? '' : '<button type="button" class="primary wp-commit">Проверить поток и зафиксировать</button>'}
  </section>`;
  const panel = container.querySelector('.water-panel'),
    device = panel.querySelector('.wp-device');
  const listen = (target, type, fn) => target.addEventListener(type, fn, {signal: events.signal});
  function draw() {
    const drawing = panel.querySelector('.wp-drawing');
    if (!drawing) return;
    if (selected === 31)
      drawing.innerHTML = `<svg viewBox="0 0 400 230" aria-hidden="true"><path class="wp-pipe" d="M20 32H380"/>${current.risers.map((open, i) => `<path class="wp-pipe ${open ? 'wp-flow' : ''}" d="M${50 + i * 100} 32V210"/>`).join('')}<path class="wp-pipe" d="M20 213H380"/></svg>`;
    if (selected === 32)
      drawing.innerHTML = `<svg viewBox="0 0 400 195" aria-hidden="true">${[6 - current.equalizer, 2 + current.equalizer].map((value, i) => `<g transform="translate(${105 + i * 190} 90)"><circle class="wp-gauge" r="73"/><path class="wp-ticks" d="M-57 0H-49M57 0H49M0 -57V-49M-40 -40L-35 -35M40 -40L35 -35"/><path class="wp-needle" d="M0 8V-55" transform="rotate(${-120 + value * 30})"/><circle r="6" class="wp-hub"/><text class="wp-gauge-value" y="43">${value}</text></g>`).join('')}<text class="wp-svg-label" x="105" y="185">СЛЕВА</text><text class="wp-svg-label" x="295" y="185">СПРАВА</text></svg>`;
    if (selected === 34)
      drawing.innerHTML = `<svg viewBox="0 0 400 220" aria-hidden="true">${Object.entries(
        WATER_CHANNELS,
      )
        .map(
          ([name, values], i) =>
            `<path class="wp-pipe ${current.channel === name ? 'wp-flow' : ''}" d="${values.map((v, j) => (j ? 'L' : 'M') + (55 + j * 145) + ' ' + (35 + i * 68 + (8 - v) * 6)).join(' ')}"/>${values.map((v, j) => `<text class="wp-height" x="${55 + j * 145}" y="${22 + i * 68 + (8 - v) * 6}">${v}</text>`).join('')}<text class="wp-svg-label" x="20" y="${43 + i * 68}">${name}</text>`,
        )
        .join('')}</svg>`;
    if (selected === 38) {
      const open = (name) => current.valveOrder.includes(name),
        flowing = open('забор') && open('обход');
      drawing.innerHTML = `<svg viewBox="0 0 400 200" aria-hidden="true"><path class="wp-pipe ${open('забор') ? 'wp-flow' : ''}" d="M18 52H140"/><path class="wp-pipe ${flowing ? 'wp-flow' : ''}" d="M140 52H265"/><path class="wp-pipe ${flowing && open('слив') ? 'wp-flow' : ''}" d="M265 52H382V95"/><path class="wp-hot" d="M140 52V143H270V52"/><path class="wp-shut" d="M182 126L207 157M207 126L182 157"/><text class="wp-svg-label" x="200" y="184">ГОРЯЧИЙ ОТСТОЙНИК ПЕРЕКРЫТ</text></svg>`;
    }
  }
  function refresh() {
    panel
      .querySelectorAll('[data-water-mode]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(Number(button.dataset.waterMode) === selected)),
      );
    panel.querySelectorAll('.wp-valve').forEach((button) => {
      const v = button.dataset.value;
      const open =
        selected === 31
          ? current.risers[Number(v)]
          : selected === 34
            ? current.channel === v
            : current.valveOrder.includes(v);
      button.setAttribute('aria-pressed', String(open));
      button.querySelector('small').textContent = open ? 'Открыт' : 'Закрыт';
      button.disabled = monitor || (selected === 38 && open);
    });
    const transfer = panel.querySelector('[data-water-action=transfer]'),
      reverse = panel.querySelector('[data-water-action=reverse]');
    if (transfer) transfer.disabled = monitor || current.equalizer === 4;
    if (reverse) reverse.disabled = monitor || current.equalizer === 0;
    panel
      .querySelectorAll(
        '[data-water-action=pump],[data-water-action=back],[data-water-action=reset-valves]',
      )
      .forEach((button) => {
        button.disabled = monitor;
      });
    const wheel = panel.querySelector('.wp-wheel--large');
    if (wheel) wheel.style.setProperty('--turn', current.pumpSlot * 90 + 'deg');
    const text =
      selected === 31
        ? 'Открытые стояки: ' +
          (current.risers
            .map((v, i) => (v ? '№ ' + (i + 1) : null))
            .filter(Boolean)
            .join(', ') || 'нет')
        : selected === 32
          ? 'Слева ' +
            (6 - current.equalizer) +
            ' / Справа ' +
            (2 + current.equalizer) +
            ' делений · Перенесено: ' +
            current.equalizer
          : selected === 34
            ? 'Канал ' +
              (current.channel
                ? current.channel + ' · ' + WATER_CHANNELS[current.channel].join(' → ')
                : 'не выбран')
            : selected === 35
              ? 'Указатель: ' + WATER_SLOTS[current.pumpSlot]
              : 'Порядок открытия: ' + (current.valveOrder.join(' → ') || 'все вентили закрыты');
    panel.querySelector('.wp-state').textContent = text;
    draw();
  }
  function build() {
    pointer = null;
    panel.querySelector('.wp-title').textContent = missions[selected - 1].station;
    const illustration = '<div class="wp-drawing"></div>';
    if (selected === 31)
      device.innerHTML = `<div class="wp-network">${illustration}<div class="wp-riser-controls">${[0, 1, 2, 3].map((i) => valveButton('riser', i, '№ ' + (i + 1))).join('')}</div></div><p class="wp-instruction">Откройте нужный стояк. Повторное нажатие закроет вентиль.</p>`;
    if (selected === 32)
      device.innerHTML = `${illustration}<div class="wp-controls"><button type="button" class="secondary" data-water-action="transfer">Ход слева направо</button><button type="button" class="quiet" data-water-action="reverse">Вернуть одно деление</button></div><p class="wp-instruction">Один ход переносит одно деление, сумма показаний сохраняется.</p>`;
    if (selected === 34)
      device.innerHTML = `${illustration}<div class="wp-three">${Object.keys(WATER_CHANNELS)
        .map((name) => valveButton('channel', name, 'Канал ' + name))
        .join(
          '',
        )}</div><p class="wp-instruction">Отметки высоты нанесены на трубы. Распределитель открывает один канал; остальные перекрываются.</p>`;
    if (selected === 35)
      device.innerHTML = `<div class="wp-compass"><span class="wp-north">ВЕРХ</span><span class="wp-east">ПРАВО</span><span class="wp-south">НИЗ</span><span class="wp-west">ЛЕВО</span><button type="button" class="wp-pump" data-water-action="pump" aria-label="Повернуть маховик на один паз по часовой стрелке"><span class="wp-wheel wp-wheel--large" aria-hidden="true"><i></i></span></button></div><div class="wp-controls"><button type="button" class="secondary" data-water-action="pump">По часовой +1 паз</button><button type="button" class="quiet" data-water-action="back">Против часовой</button></div><p class="wp-instruction">Коснитесь маховика или поверните его движением по ободу. Каждый поворот — один паз.</p>`;
    if (selected === 38)
      device.innerHTML = `${illustration}<div class="wp-three">${WATER_VALVES.map((name) => valveButton('valve', name, name[0].toUpperCase() + name.slice(1))).join('')}</div><p class="wp-instruction">Открывайте вентили по очереди. Горячая ветка опломбирована: бумага должна пройти через обход.</p><button type="button" class="quiet" data-water-action="reset-valves">Закрыть группу и начать заново</button>`;
    refresh();
  }
  function change(action, value) {
    if (monitor) return;
    current = operateWater(current, action, value);
    onChange(current);
    onTurn();
    refresh();
  }
  listen(panel, 'click', (event) => {
    const tab = event.target.closest('[data-water-mode]');
    if (tab && monitor) {
      selected = Number(tab.dataset.waterMode);
      build();
      return;
    }
    const button = event.target.closest('[data-water-action]');
    if (!button || button.disabled) return;
    if (ignoreClick && button.classList.contains('wp-pump')) {
      ignoreClick = false;
      return;
    }
    const action = button.dataset.waterAction;
    change(
      action === 'reverse' ? 'transfer' : action === 'back' ? 'pump' : action,
      action === 'riser'
        ? Number(button.dataset.value)
        : action === 'reverse' || action === 'back'
          ? -1
          : action === 'pump' || action === 'transfer'
            ? 1
            : button.dataset.value,
    );
  });
  listen(panel, 'pointerdown', (event) => {
    const button = event.target.closest('.wp-pump');
    if (!button || monitor || !event.isPrimary) return;
    ignoreClick = false;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2,
      y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < 25) return;
    pointer = {
      id: event.pointerId,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      angle: Math.atan2(y, x),
      button,
    };
    button.setPointerCapture(event.pointerId);
  });
  listen(panel, 'pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const p = pointer;
    pointer = null;
    let angle = Math.atan2(event.clientY - p.y, event.clientX - p.x) - p.angle;
    if (angle > Math.PI) angle -= Math.PI * 2;
    if (angle < -Math.PI) angle += Math.PI * 2;
    if (Math.abs(angle) > Math.PI / 4) {
      ignoreClick = true;
      change('pump', angle > 0 ? 1 : -1);
    }
    if (p.button.hasPointerCapture(event.pointerId))
      p.button.releasePointerCapture(event.pointerId);
  });
  listen(panel, 'pointercancel', () => {
    pointer = null;
    ignoreClick = false;
  });
  const commit = panel.querySelector('.wp-commit');
  if (commit) listen(commit, 'click', () => onSubmit(selected));
  build();
  return () => {
    if (pointer?.button.hasPointerCapture(pointer.id))
      pointer.button.releasePointerCapture(pointer.id);
    pointer = null;
    events.abort();
  };
}
