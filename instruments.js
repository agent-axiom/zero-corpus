// Instruments keep the campaign's answer indices as their only contract with game state.
const numericUnits = new Map([
  [4, '№'], [6, 'А'], [13, 'м'], [18, ''], [22, '№'], [23, '№'], [24, 'чел.'],
  [27, 'место'], [29, 'шт.'], [31, '№'], [32, 'ход.'], [33, 'мм'], [37, 'мин'],
  [40, 'с'], [51, 'см'], [58, 'мм'], [60, '№'], [63, 'год'], [66, 'об/с'],
  [70, 'лет'], [73, 'с'], [75, ''], [78, '№'], [88, 'год'], [92, 'чел.'], [98, 'с']
]);
const spokenNumbers = new Map([
  ['ноль', 0], ['один', 1], ['два', 2], ['вторым', 2], ['три', 3], ['третий', 3],
  ['третьим', 3], ['четыре', 4], ['четвёртая секунда', 4], ['четвёртым', 4],
  ['четвёртый', 4], ['пятая секунда', 5], ['пятый', 5], ['шестая секунда', 6],
  ['восьмой', 8], ['девятой', 9], ['десятой', 10], ['двенадцать', 12]
]);
const sequences = new Map([
  [3, ', '], [5, ', '], [7, ', '], [9, ', '], [20, ' и '], [25, ', '], [30, ' '],
  [38, ', '], [39, ', '], [44, '–'], [61, ', '], [83, ', '], [87, ' и ']
]);
// These particular stations route a single physical signal or passage to a destination.
const terminals = new Map([
  [1, 'Турникет'], [10, 'Линия'], [14, 'Вызов'], [34, 'Поток'], [36, 'Ловитель'],
  [42, 'Считыватель'], [48, 'Клемма'], [56, 'Считыватель'], [71, 'Эталон'],
  [79, 'Ввод'], [81, 'Вызов'], [82, 'Передатчик'], [95, 'Привод'], [100, 'Часы']
]);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(caption, action, label) {
  const node = el('button', 'inst-key', caption);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', action);
  return node;
}
function numberFor(value) {
  const digits = /\d+/.exec(value);
  return digits ? Number(digits[0]) : spokenNumbers.get(value.toLocaleLowerCase('ru'));
}

function keypad(panel, mission, unit) {
  const values = mission.options.map(numberFor);
  if (values.some(v => v === undefined)) return;
  const width = Math.max(...values.map(v => String(v).length));
  const window = el('div', 'inst-meter');
  const input = el('input', 'inst-digits');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.maxLength = width;
  input.placeholder = '–'.repeat(width);
  input.setAttribute('aria-label', unit ? 'Показание, ' + unit : 'Показание');
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, width); });
  window.append(input, el('span', 'inst-unit', unit));
  const keys = el('div', 'inst-keypad');
  for (const digit of '123456789') {
    keys.append(button(digit, () => { if (input.value.length < width) input.value += digit; }));
  }
  keys.append(
    button('Сброс', () => { input.value = ''; }),
    button('0', () => { if (input.value.length < width) input.value += '0'; }),
    button('⌫', () => { input.value = input.value.slice(0, -1); }, 'Стереть последнюю цифру')
  );
  panel.append(window, keys);
  return {label: 'Набор показания', get: () => input.value ? values.indexOf(Number(input.value)) : -1};
}

function drum(panel, mission, date) {
  const separator = date ? '.' : ':';
  const labels = date ? ['День', 'Месяц'] : ['Часы', 'Минуты', 'Секунды'];
  const maxima = date ? [31, 12] : [23, 59, 59];
  const count = mission.options[0].split(separator).length;
  const row = el('div', 'inst-drums');
  const inputs = [];
  for (let i = 0; i < count; i++) {
    if (i) row.append(el('span', 'inst-colon', separator));
    const cell = el('div', 'inst-drum');
    const input = el('input', 'inst-wheel');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = 2;
    input.value = date ? '01' : '00';
    input.setAttribute('aria-label', labels[i]);
    const min = date ? 1 : 0;
    const max = maxima[i];
    function turn(step) {
      const old = Number(input.value);
      const current = input.value && old >= min && old <= max ? old : min;
      const size = max - min + 1;
      input.value = String(min + (current - min + step + size) % size).padStart(2, '0');
    }
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 2); });
    input.addEventListener('focus', () => input.select());
    input.addEventListener('blur', () => {
      if (input.value) input.value = input.value.padStart(2, '0');
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        turn(e.key === 'ArrowUp' ? 1 : -1);
      }
    });
    cell.append(el('span', 'inst-engraving', labels[i]),
      button('+', () => turn(1), 'Увеличить: ' + labels[i]), input,
      button('−', () => turn(-1), 'Уменьшить: ' + labels[i]));
    inputs.push(input);
    row.append(cell);
  }
  panel.append(row);
  function get() {
    const value = inputs.map(input => input.value ? input.value.padStart(2, '0') : '').join(separator);
    return mission.options.indexOf(value);
  }
  return {label: date ? 'Календарный барабан' : 'Установка времени', get};
}

function sequencer(panel, mission, separator) {
  const normalize = value => value.toLocaleLowerCase('ru').replace('два длинных', 'длинный, длинный').split(separator);
  const recipes = mission.options.map(normalize);
  const size = recipes[0].length;
  if (!recipes.every(recipe => recipe.length === size)) return;
  const vocabulary = [...new Set(recipes.flat())].sort((a, b) => a.localeCompare(b, 'ru'));
  const selected = [];
  const rack = el('ol', 'inst-rack');
  rack.setAttribute('aria-label', 'Набранная последовательность');
  rack.setAttribute('aria-live', 'polite');
  const bank = el('div', 'inst-switchbank');
  const edit = el('div', 'inst-edit');
  const erase = button('Шаг назад', () => { selected.pop(); refresh(); });
  const reset = button('Сброс', () => { selected.length = 0; refresh(); });
  edit.append(erase, reset);
  const switches = vocabulary.map(word => button(word, () => {
    if (selected.length < size) selected.push(word);
    refresh();
  }));
  bank.append(...switches);
  const slots = Array.from({length: size}, (_, i) => {
    const socket = el('li', 'inst-slot');
    const name = el('span');
    socket.append(el('small', '', String(i + 1).padStart(2, '0')), name);
    rack.append(socket);
    return name;
  });
  function refresh() {
    slots.forEach((slot, i) => { slot.textContent = selected[i] ?? '—'; });
    switches.forEach(key => { key.disabled = selected.length === size; });
    erase.disabled = reset.disabled = selected.length === 0;
  }
  refresh();
  panel.append(rack, bank, edit);
  return {
    label: 'Набор последовательности',
    get: () => recipes.findIndex(recipe => selected.length === size && recipe.every((value, i) => value === selected[i]))
  };
}

function patchboard(panel, mission, inlet) {
  let selected = -1;
  const isGate = mission.id === 1;
  const outlets = el('div', 'inst-outlets');
  let diagram;
  if (isGate) {
    outlets.classList.add('inst-token-slots');
  } else {
    diagram = el('div', 'inst-junction');
    const route = el('span', 'inst-wire');
    route.setAttribute('aria-hidden', 'true');
    diagram.append(el('span', 'inst-inlet', inlet), route);
    panel.append(diagram);
  }
  const keys = mission.options.map((name, index) => {
    const key = button(name, () => {
      selected = index;
      keys.forEach((key, i) => key.setAttribute('aria-pressed', String(i === index)));
      if (diagram) {
        diagram.style.setProperty('--route', ((index + 0.5) * 100 / keys.length) + '%');
        diagram.classList.add('inst-patched');
      }
    });
    key.setAttribute('aria-pressed', 'false');
    return key;
  });
  outlets.style.gridTemplateColumns = 'repeat(' + keys.length + ', minmax(0, 1fr))';
  outlets.append(...keys);
  panel.append(outlets);
  return {label: isGate ? 'Жетоноприёмник' : 'Коммутационная панель', get: () => selected};
}

export function mountInstrument(container, mission, onSubmit) {
  const body = el('div', 'inst-body');
  const id = mission.id;
  let device;
  if (mission.options.every(value => /^\d{2}:\d{2}(:\d{2})?$/.test(value))) {
    device = drum(body, mission, false);
  } else if (id === 67) {
    device = drum(body, mission, true);
  } else if (numericUnits.has(id)) {
    device = keypad(body, mission, numericUnits.get(id));
  } else if (sequences.has(id)) {
    device = sequencer(body, mission, sequences.get(id));
  } else if (terminals.has(id)) {
    device = patchboard(body, mission, terminals.get(id));
  }
  if (!device) return false;

  const panel = el('section', 'kontur-instrument');
  panel.setAttribute('aria-label', device.label);
  const bar = el('div', 'inst-plate', device.label);
  const footer = el('div', 'inst-footer');
  const lamp = el('span', 'inst-lamp', 'Ожидание');
  lamp.setAttribute('role', 'status');
  const confirm = button(id === 1 ? 'Вставить жетон' : 'Подтвердить', () => {
    const selection = device.get();
    const accepted = onSubmit(selection);
    lamp.textContent = accepted ? 'Принято' : 'Нет контакта';
    if (!accepted && id === 1) lamp.textContent = selection < 0 ? 'Ожидание' : 'Жетон возвращён';
    lamp.classList.toggle('inst-ok', accepted);
    lamp.classList.toggle('inst-bad', !accepted);
  });
  confirm.classList.add('inst-confirm');
  footer.append(lamp, confirm);
  panel.append(bar, body, footer);
  container.replaceChildren(panel);
  return true;
}
