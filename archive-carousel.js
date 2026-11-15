import {ARCHIVE_DRAWERS, ARCHIVE_FUNDS, ARCHIVE_RECORDS} from './assets/world/archive.js';

export function mountArchiveCarousel(container, {state, monitor, onChange, onTurn, onSubmit}) {
  container.innerHTML = `
    <section class="carousel" aria-label="Картотечная карусель">
      <div class="cr-funds" role="group" aria-label="Выбор фонда">${ARCHIVE_FUNDS.map((fund) => `<button type="button" class="secondary" data-fund="${fund}" aria-pressed="false">Фонд ${fund}</button>`).join('')}</div>
      <div class="cr-machine">
        <div class="cr-heading"><button type="button" class="quiet cr-prev" aria-label="Предыдущий фонд">←</button><b class="cr-fund"></b><button type="button" class="quiet cr-next" aria-label="Следующий фонд">→</button></div>
        <div class="cr-drawers" role="group" aria-label="Номер дела">${ARCHIVE_DRAWERS.map((number) => `<button type="button" class="cr-drawer" data-drawer="${number}" aria-pressed="false"><span>Дело ${number}</span><small></small><i aria-hidden="true"></i></button>`).join('')}</div>
      </div>
      <p class="cr-instruction">Поверните карусель стрелками или смахните в сторону. Выберите номер дела и выдвиньте ящик.</p>
      <div class="cr-controls"><button type="button" class="secondary cr-open">Открыть ящик</button><button type="button" class="secondary cr-read">Осмотреть документ</button></div>
      <article class="cr-document note-paper" aria-live="polite"><small class="micro cr-address"></small><h3 class="cr-title"></h3><p class="cr-text"></p></article>
      ${monitor ? '' : '<button type="button" class="primary cr-commit">Передать папку на стол</button>'}
      <p class="cr-history micro" role="status"></p>
    </section>`;
  const panel = container.querySelector('.carousel'),
    machine = panel.querySelector('.cr-machine');
  const funds = [...panel.querySelectorAll('[data-fund]')],
    drawers = [...panel.querySelectorAll('[data-drawer]')];
  const open = panel.querySelector('.cr-open'),
    read = panel.querySelector('.cr-read'),
    commit = panel.querySelector('.cr-commit');
  let fund = state.fund,
    drawer = state.drawer,
    opened = state.opened,
    inspected = [...state.inspected],
    pointer = null;
  const key = () => fund + '/' + drawer;
  function refresh() {
    funds.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.fund === fund)),
    );
    panel.querySelector('.cr-fund').textContent = 'ФОНД ' + fund;
    drawers.forEach((button) => {
      const number = Number(button.dataset.drawer),
        address = fund + '/' + number;
      button.setAttribute('aria-pressed', String(number === drawer));
      button.classList.toggle('cr-opened', opened === address);
      button.querySelector('small').textContent =
        opened === address ? 'Открыт' : inspected.includes(address) ? 'Прочитано' : 'Опись';
    });
    const isOpen = opened === key(),
      wasRead = inspected.includes(key());
    open.textContent = isOpen ? 'Закрыть ящик' : 'Открыть ящик';
    read.disabled = !isOpen;
    if (commit) commit.disabled = !isOpen || !wasRead;
    panel.querySelector('.cr-address').textContent = 'ФОНД ' + fund + ' / ДЕЛО ' + drawer;
    panel.querySelector('.cr-title').textContent = isOpen
      ? ARCHIVE_RECORDS[key()].title
      : 'Ящик закрыт';
    panel.querySelector('.cr-text').textContent =
      isOpen && wasRead
        ? ARCHIVE_RECORDS[key()].text
        : isOpen
          ? 'Папка на направляющих. Осмотрите документ и сравните его с найденным уголком.'
          : 'Выдвиньте ящик, чтобы достать папку.';
    panel.querySelector('.cr-history').textContent =
      'Просмотрено дел: ' + inspected.length + ' / ' + Object.keys(ARCHIVE_RECORDS).length;
  }
  function persist() {
    onChange({fund, drawer, opened, inspected: [...inspected]});
    refresh();
  }
  function selectFund(value) {
    if (value === fund) return;
    fund = value;
    onTurn();
    persist();
  }
  function turn(direction) {
    selectFund(ARCHIVE_FUNDS[(ARCHIVE_FUNDS.indexOf(fund) + direction + 3) % 3]);
  }
  funds.forEach((button) =>
    button.addEventListener('click', () => selectFund(button.dataset.fund)),
  );
  drawers.forEach((button) =>
    button.addEventListener('click', () => {
      drawer = Number(button.dataset.drawer);
      persist();
    }),
  );
  panel.querySelector('.cr-prev').addEventListener('click', () => turn(-1));
  panel.querySelector('.cr-next').addEventListener('click', () => turn(1));
  open.addEventListener('click', () => {
    opened = opened === key() ? null : key();
    onTurn();
    persist();
  });
  read.addEventListener('click', () => {
    if (opened !== key()) return;
    if (!inspected.includes(key())) inspected.push(key());
    persist();
  });
  commit?.addEventListener('click', () => {
    if (opened === key() && inspected.includes(key())) onSubmit();
  });
  // Vertical gestures continue scrolling the sheet; horizontal gestures turn
  // one face. Local listeners disappear when the sheet is replaced.
  machine.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  machine.addEventListener('pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) turn(dx < 0 ? 1 : -1);
  });
  machine.addEventListener('pointercancel', () => {
    pointer = null;
  });
  refresh();
  return () => {
    pointer = null;
  };
}
