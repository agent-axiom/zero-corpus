import {
  SPIRO_RECORDS,
  SPIRO_END,
  NINA_RECORD,
  operateSpiro,
  restoreSanitary,
  spiroIntervals,
  paintSpirogram,
} from './assets/world/sanitary.js';

export function mountSpirograph(
  container,
  {state, completed, monitor, onChange, onTurn, onSubmit},
) {
  let current = restoreSanitary(state, completed),
    pointer = null,
    message = '';
  const events = new AbortController();
  container.innerHTML = `<section class="spirograph" aria-label="Спирограф Лидии Сергеевны">
    <div class="sg-cassettes" role="group" aria-label="Выбор записи">${SPIRO_RECORDS.map((record, i) => `<button type="button" class="secondary sg-cassette" data-record="${i}" aria-pressed="false"><span>Кассета ${record.name}</span><small>Вдохов: 0 / 4</small></button>`).join('')}</div>
    <p class="sg-legend">Верхняя кривая — наблюдение. Нижняя — контроль аппарата.</p>
    <div class="sg-paper"><canvas class="sg-chart" width="1000" height="560" aria-hidden="true"></canvas></div>
    <label class="sg-seek-label" for="sg-position">Положение ленты <output class="sg-position"></output></label>
    <input id="sg-position" class="sg-seek" type="range" min="0" max="${SPIRO_END}" step="1" value="0" aria-label="Прокрутка записи в секундах">
    <div class="sg-transport"><button type="button" class="secondary" data-spiro-action="back" aria-label="Прокрутить на секунду назад">−1 с</button><button type="button" class="sg-roller" data-spiro-action="forward" aria-label="Повернуть валик на секунду вперёд"><i aria-hidden="true"></i><span>+1 с</span></button></div>
    <p class="sg-instruction">Прокручивайте ленту валиком, ползунком или движением по графику. На вершине каждого вдоха поставьте метку.</p>
    <div class="sg-measure"><button type="button" class="secondary" data-spiro-action="mark">Отметить вдох</button><button type="button" class="quiet" data-spiro-action="clear">Снять метки</button></div>
    <p class="sg-cursor" role="status" aria-live="polite"></p>
    <div class="sg-reading"><small class="micro">ИНТЕРВАЛЫ МЕЖДУ ВДОХАМИ</small><output class="sg-intervals">—</output><p class="sg-marks"></p></div>
    ${monitor ? '<p class="sg-found">Запись Нины закреплена в журнале. Остальные кассеты можно продолжить исследовать.</p>' : '<button type="button" class="primary sg-commit">Сохранить запись Нины</button>'}
  </section>`;
  const panel = container.querySelector('.spirograph'),
    chart = panel.querySelector('.sg-chart'),
    paper = panel.querySelector('.sg-paper'),
    seek = panel.querySelector('.sg-seek'),
    commit = panel.querySelector('.sg-commit');
  const listen = (target, type, fn) => target.addEventListener(type, fn, {signal: events.signal});
  function refresh() {
    const index = current.selected,
      t = current.positions[index],
      marks = current.marks[index],
      record = SPIRO_RECORDS[index];
    panel.querySelectorAll('[data-record]').forEach((button) => {
      const i = Number(button.dataset.record),
        count = current.marks[i].length;
      button.setAttribute('aria-pressed', String(index === i));
      button.querySelector('small').textContent =
        (completed >= 42 && i === NINA_RECORD ? 'Нина · ' : '') + 'Вдохов: ' + count + ' / 4';
    });
    seek.value = String(t);
    panel.querySelector('.sg-position').textContent = t + ' с';
    panel.querySelector('[data-spiro-action=back]').disabled = t === 0;
    panel.querySelector('[data-spiro-action=forward]').disabled = t === SPIRO_END;
    const locked = monitor && index === NINA_RECORD;
    panel.querySelector('[data-spiro-action=clear]').disabled = locked || marks.length === 0;
    panel.querySelector('[data-spiro-action=mark]').disabled = locked;
    if (commit) commit.disabled = marks.length !== 4;
    panel.querySelector('.sg-cursor').textContent =
      message ||
      (record.peaks.includes(t)
        ? 'У отметки ' + t + ' с — вершина вдоха.'
        : 'У отметки ' + t + ' с — участок между вдохами.');
    const intervals = spiroIntervals(marks);
    panel.querySelector('.sg-intervals').textContent = intervals.length
      ? intervals.join(' · ') + ' с'
      : '—';
    panel.querySelector('.sg-marks').textContent =
      'Отмечено: ' +
      (marks.length ? marks.map((value) => value + ' с').join(', ') : 'пока нет меток') +
      '. Нужно четыре последовательных вдоха.';
    panel.querySelector('.sg-roller i').style.setProperty('--turn', t * 36 + 'deg');
    paintSpirogram(
      chart.getContext('2d'),
      current,
      chart.width,
      chart.height,
      completed >= 42 && index === NINA_RECORD,
    );
  }
  function change(action, value) {
    if (monitor && current.selected === NINA_RECORD && (action === 'clear' || action === 'mark'))
      return;
    message = '';
    if (action === 'mark') {
      const t = current.positions[current.selected];
      message = !SPIRO_RECORDS[current.selected].peaks.includes(t)
        ? 'Здесь нет вершины вдоха. Совместите курсор с пиком кривой.'
        : current.marks[current.selected].includes(t)
          ? 'Этот вдох уже отмечен.'
          : 'Вдох у ' + t + ' с отмечен.';
    }
    current = operateSpiro(current, action, value);
    onChange(current);
    if (action !== 'seek') onTurn();
    refresh();
  }
  listen(panel, 'click', (event) => {
    const cassette = event.target.closest('[data-record]');
    if (cassette) {
      change('select', Number(cassette.dataset.record));
      return;
    }
    const button = event.target.closest('[data-spiro-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.spiroAction;
    change(
      action === 'back' || action === 'forward' ? 'step' : action,
      action === 'back' ? -1 : action === 'forward' ? 1 : undefined,
    );
  });
  listen(seek, 'input', () => change('seek', Number(seek.value)));
  const seekAt = (x) => {
    const rect = chart.getBoundingClientRect(),
      time = Math.max(
        0,
        Math.min(
          SPIRO_END,
          Math.round((((x - rect.left) / rect.width - 0.065) / 0.87) * SPIRO_END),
        ),
      );
    if (time !== current.positions[current.selected]) change('seek', time);
  };
  listen(paper, 'pointerdown', (event) => {
    if (event.isPrimary)
      pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, drag: false};
  });
  listen(paper, 'pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (
      !pointer.drag &&
      Math.abs(event.clientX - pointer.x) > 6 &&
      Math.abs(event.clientX - pointer.x) > Math.abs(event.clientY - pointer.y) * 1.3
    ) {
      pointer.drag = true;
      paper.setPointerCapture(event.pointerId);
    }
    if (pointer.drag) seekAt(event.clientX);
  });
  listen(paper, 'pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.drag || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 8)
      seekAt(event.clientX);
    pointer = null;
    if (paper.hasPointerCapture(event.pointerId)) paper.releasePointerCapture(event.pointerId);
  });
  listen(paper, 'pointercancel', () => {
    pointer = null;
  });
  if (commit)
    listen(commit, 'click', () => {
      if (!commit.disabled) onSubmit();
    });
  refresh();
  return () => {
    if (pointer && paper.hasPointerCapture(pointer.id)) paper.releasePointerCapture(pointer.id);
    pointer = null;
    events.abort();
  };
}
