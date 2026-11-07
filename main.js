import {chapters, missions} from './campaign.js';
import {createAudio} from './audio.js';
import {mountInstrument} from './instruments.js';

const $ = selector => document.querySelector(selector);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const pad = (value, length = 3) => String(value).padStart(length, '0');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const button = (action, label, cls = 'primary') => '<button class="' + cls + '" data-action="' + action + '">' + label + '</button>';
const range = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const saveKey = 'kontur.campaign.v1', settingsKey = 'kontur.settings.v1';
function read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
const raw = read(saveKey), cfg = read(settingsKey);
const state = {
  completed: Math.floor(range(raw.completed, 0, missions.length, 0)),
  collected: raw.collected === true, read: raw.read === true, started: raw.started === true
};
const settings = {sound: cfg.sound !== false, volume: range(cfg.volume, 0, 1, .6), sensitivity: range(cfg.sensitivity, .3, 2, 1), grain: cfg.grain !== false};
const audio = createAudio();
const dialog = $('#dialog'), body = $('#dialog-body');
let world, playing = false, loading = false, light = true, overlay = '', onDismiss = null;
let hintTimeout, archiveChapter = 1, archiveMission = 1, launchTime = performance.now(), failure = false;
const current = () => missions[Math.min(state.completed, missions.length - 1)];
const chapterOf = mission => chapters.find(ch => ch.id === mission.chapter);
const finished = () => state.completed === missions.length;
function save() { write(saveKey, state); refreshMenu(); }
function refreshMenu() {
  $('#mission-number').textContent = pad(current().id);
  $('#mission-title').textContent = finished() ? 'Корпус отключён' : current().title;
  $('#progress-count').innerHTML = pad(state.completed) + ' <i>/ ' + missions.length + '</i>';
  $('#progress-fill').style.width = state.completed / missions.length * 100 + '%';
  $('#launch-label').textContent = finished() ? 'Открыть финал' : state.started ? 'Продолжить' : 'Войти в корпус';
}
function applySettings() {
  audio.settings(settings.sound, settings.volume);
  world?.setSensitivity(settings.sensitivity);
  document.body.classList.toggle('no-grain', !settings.grain);
  const sound = $('.sound'), action = settings.sound ? 'Выключить звук' : 'Включить звук';
  sound.innerHTML = icon(settings.sound ? 'wave' : 'muted');
  sound.title = action; sound.setAttribute('aria-label', action);
  write(settingsKey, settings);
}
function clock() {
  const sec = Math.floor((performance.now() - launchTime) / 1000);
  const stamp = [Math.floor(sec / 3600) % 24, Math.floor(sec / 60) % 60, sec % 60].map(x => pad(x, 2)).join(':');
  $('#timer').textContent = stamp; $('#game-clock').textContent = stamp;
}
function clearSheet() {
  onDismiss = null; overlay = '';
  if (dialog.open) dialog.close();
}
function dismiss() {
  const next = onDismiss;
  if (!next) return;
  clearSheet(); next();
}
function showSheet(type, kicker, title, html, back = () => {}) {
  overlay = type; onDismiss = back;
  dialog.classList.toggle('archive', type === 'archive');
  $('#dialog-kicker').textContent = kicker;
  $('#dialog-close').hidden = !back;
  body.innerHTML = '<h2 id="dialog-title">' + escape(title) + '</h2>' + html;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
dialog.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
dialog.addEventListener('click', e => { if (e.target === dialog && (e.clientX < dialog.getBoundingClientRect().left || e.clientX > dialog.getBoundingClientRect().right || e.clientY < dialog.getBoundingClientRect().top || e.clientY > dialog.getBoundingClientRect().bottom)) dismiss(); });
$('#dialog-close').addEventListener('click', dismiss);
function notice(message, ms = 4400) {
  clearTimeout(hintTimeout); $('#notice').textContent = message || '';
  if (message) hintTimeout = setTimeout(() => { $('#notice').textContent = ''; }, ms);
}
function focusOn(kind) {
  const m = current();
  const label = {item: m.item, clue: state.read ? 'Перечитать улику' : 'Изучить улику', station: m.station}[kind];
  $('#focus-hint').hidden = !label; $('#focus-hint span').textContent = label || '';
  $('#game').classList.toggle('focused', Boolean(label));
}
function updateHud() {
  const m = current();
  const objective = !state.collected ? 'Найти предмет · ' + m.item : !state.read ? 'Отыскать и изучить улику' : 'Использовать предмет · ' + m.station;
  $('#objective').innerHTML = '<small class="micro">МИССИЯ ' + pad(m.id) + ' / ' + escape(chapterOf(m).title.toUpperCase()) + '</small><strong>' + escape(m.title) + '</strong><span>' + escape(objective) + '</span>';
  $('#light-state').textContent = light ? 'Свет вкл.' : 'Свет выкл.';
}
function pauseWorld() { if (playing) world?.pause(); }
function resumeWorld() {
  if (!playing || failure || finished()) return;
  clearSheet(); world.resume(); updateHud();
}
function returnHome() {
  playing = false; failure = false; clearSheet(); world?.pause(); focusOn(null); notice('');
  $('#game').hidden = true; $('#terminal').hidden = false;
  audio.inWorld(false); refreshMenu(); $('.launch').focus({preventScroll:true});
}
async function launch() {
  if (loading) return;
  if (finished()) { ending(); return; }
  loading = true; clearSheet(); audio.unlock();
  $('#launch-label').textContent = 'Открываем шлюз…';
  try {
    if (!world) {
      const {createWorld} = await import('./world.js');
      world = createWorld($('#world'), {
        onInteract: interact, onFocus: focusOn,
        onThreat: message => { if (playing && message) { if (message.startsWith('Шаги стихли')) audio.signal(); else audio.threat(); notice(message, 6200); } },
        onFail: lost, onPause: () => { if (playing && !dialog.open && !failure) pauseMenu(); },
        onMove: () => audio.step()
      });
    }
    const firstVisit = !state.started;
    playing = true; failure = false; light = true; focusOn(null);
    $('#terminal').hidden = true; $('#game').hidden = false;
    world.setSensitivity(settings.sensitivity); world.start(current());
    world.setCollected(state.collected); world.setClueRead?.(state.read); world.setFlashlight(light);
    audio.inWorld(true); state.started = true; save(); updateHud();
    notice(firstVisit ? (matchMedia('(pointer:coarse)').matches ? 'Слева — ходьба, справа — обзор. Цель и записи доступны в журнале.' : 'WASD — ходьба · Щёлкните в сцене для обзора · E — осмотреть · J — журнал') : 'Полевой журнал восстановлен', firstVisit ? 7500 : 2400);
  } catch (error) {
    console.error(error); world?.dispose(); world = null; returnHome();
    showSheet('error', 'СИСТЕМА НАБЛЮДЕНИЯ', 'Камера недоступна', '<p>Не удалось открыть трёхмерную сцену. Обновите страницу или попробуйте другой браузер.</p>' + button('launch','Повторить'));
  } finally { loading = false; refreshMenu(); }
}
function pauseMenu() {
  if (!playing || failure || finished()) return;
  pauseWorld();
  showSheet('pause', 'ПОЛЕВАЯ КАМЕРА / ОЖИДАНИЕ', 'Запись на паузе', '<p>Миссия ' + pad(current().id) + ' · ' + escape(current().title) + '</p><div class="actions">' + button('resume','Продолжить '+icon('next')) + button('journal','Журнал','secondary') + button('settings','Настройки','quiet') + button('home','В главное меню','quiet') + '</div>', resumeWorld);
}
function controls(back) {
  const rows = [
    ['Передвижение', ['W','A','S','D']], ['Обзор после щелчка в сцене', ['Мышь','←','→']], ['Ускорить шаг', ['Shift']], ['Осмотреть или подобрать', ['E']],
    ['Фонарь', ['F']], ['Полевой журнал', ['J','Tab']], ['Пауза', ['Esc']]
  ];
  const list = rows.map(([label, keys]) => '<li>' + label + '<span class="keys">' + keys.map(k => '<kbd>' + k + '</kbd>').join('') + '</span></li>').join('');
  showSheet('controls', 'СПРАВОЧНИК ОПЕРАТОРА', 'Управление', '<ul class="control-list">' + list + '</ul><p>На сенсорном экране ведите пальцем слева, чтобы идти, и справа, чтобы осмотреться. Кнопка «Осмотреть» действует на объект в прицеле.</p>', back);
}
function settingsPanel(back) {
  const toggle = (k, label) => '<div class="setting-row"><label id="label-' + k + '">' + label + '</label><button role="switch" class="switch" aria-labelledby="label-' + k + '" aria-checked="' + settings[k] + '" data-toggle="' + k + '"></button></div>';
  const slider = (k, label, min, max, step) => '<div class="setting-row"><label for="set-' + k + '">' + label + '</label><input id="set-' + k + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + settings[k] + '" data-setting="' + k + '"><output class="value" for="set-' + k + '">' + formatSetting(k) + '</output></div>';
  showSheet('settings', 'АППАРАТНАЯ / ПАРАМЕТРЫ', 'Настройки', toggle('sound','Звук') + slider('volume','Громкость',0,1,.05) + slider('sensitivity','Чувствительность обзора',.3,2,.05) + toggle('grain','Строки видеозаписи') + '<div class="actions">' + button('controls','Управление','secondary') + '</div>', back);
}
function formatSetting(k) { return k === 'volume' ? Math.round(settings.volume * 100) + '%' : settings.sensitivity.toFixed(2) + '×'; }
function archive(chId = current().chapter, id = current().id) {
  archiveChapter = chId; archiveMission = id;
  const ch = chapters.find(c => c.id === chId), m = missions.find(v => v.id === id);
  const tabs = chapters.map(c => '<button class="' + (chId === c.id ? 'current' : '') + '" data-chapter="' + c.id + '" aria-pressed="' + (chId === c.id) + '"><small>' + pad(c.id,2) + '</small>' + escape(c.title) + '</button>').join('');
  const list = missions.filter(v => v.chapter === chId).map(v => '<li><button class="mission-row' + (v.id === id ? ' selected' : '') + '" data-mission="' + v.id + '" aria-pressed="' + (v.id === id) + '"><small>' + pad(v.id) + '</small>' + escape(v.title) + '</button></li>').join('');
  const status = m.id <= state.completed ? 'ЗАВЕРШЕНО' : m.id === state.completed + 1 ? 'ТЕКУЩАЯ МИССИЯ' : 'ПРЕДСТОИТ';
  showSheet('archive','КАРТОТЕКА / 100 ДЕЛ','Архив миссий','<div class="archive-layout"><div class="chapter-list" aria-label="Главы">' + tabs + '</div><div><h3 class="archive-heading">Глава ' + pad(ch.id,2) + ' · ' + escape(ch.title) + '</h3><ul class="record-list">' + list + '</ul><article class="archive-detail"><small class="micro">' + status + ' / ' + pad(m.id) + '</small><h3>' + escape(m.title) + '</h3><p>' + escape(m.brief) + '</p></article></div></div>');
}
function journal() {
  if (!playing) { archive(); return; }
  pauseWorld();
  const m = current(), rooms = world.getLocations?.() || {};
  const goal = (name, done, room) => '<li class="' + (done ? 'done' : '') + '"><i class="mark">' + (done ? icon('check') : '') + '</i><span>' + escape(name) + (room ? ' <small class="micro"> / ' + escape(room) + '</small>' : '') + '</span></li>';
  const note = state.read ? '<div class="note-paper"><span class="micro">ЗАПИСАННАЯ УЛИКА</span><p>' + escape(m.clue) + '</p></div>' : '';
  showSheet('journal','ПОЛЕВОЙ ЖУРНАЛ / МИССИЯ ' + pad(m.id),m.title,'<p>' + escape(m.brief) + '</p><ul class="goal-list">' + goal(m.item,state.collected,rooms.item) + goal('Улика',state.read,rooms.clue) + goal(m.station,false,rooms.station) + '</ul>' + note + '<div class="actions">' + button('resume','Вернуться в корпус '+icon('next')) + '</div>',resumeWorld);
}
function interact(kind) {
  if (!playing || dialog.open || failure || finished()) return;
  const m = current();
  if (kind === 'item') {
    if (!state.collected) {
      state.collected = true; world.setCollected(true); save(); updateHud(); audio.pickup();
      notice('В инвентаре · ' + m.item);
    }
  } else if (kind === 'clue') {
    pauseWorld(); state.read = true; world.setClueRead?.(true); save(); updateHud(); audio.signal();
    showSheet('clue','УЛИКА / ДЕЛО ' + pad(m.id),'Полевая запись','<div class="note-paper"><p class="lead">' + escape(m.clue) + '</p></div><div class="actions">' + button('resume','Убрать в журнал '+icon('file')) + '</div>',resumeWorld);
  } else if (kind === 'station') {
    if (!state.collected || !state.read) {
      notice(!state.collected ? 'Нужен предмет · ' + m.item : 'Сначала найдите улику. Ориентир есть в журнале.'); return;
    }
    pauseWorld();
    showSheet('puzzle','УЗЕЛ ДОСТУПА / МИССИЯ ' + pad(m.id),m.station,'<p class="lead">' + escape(m.prompt) + '</p><details class="note-paper"><summary>Свериться с уликой</summary><p>' + escape(m.clue) + '</p></details><div class="options">' + m.options.map((v,i) => '<button class="option" data-answer="' + i + '"><small>' + pad(i+1,2) + '</small> ' + escape(v) + '</button>').join('') + '</div><p class="error" role="status" id="puzzle-status"></p>',resumeWorld);
    mountInstrument(body.querySelector('.options'), m, index => solve(index));
  }
}
function solve(index, target) {
  if (overlay !== 'puzzle') return false;
  const m = current();
  if (index !== m.answer) { if (target) target.disabled = true; $('#puzzle-status').textContent = 'Цепь не замкнулась. Сверьтесь с уликой и попробуйте ещё раз.'; audio.signal(); return false; }
  state.completed = m.id; state.read = false; state.collected = false; save(); audio.pickup(); notice(''); focusOn(null);
  if (finished()) { ending(); return true; }
  showSheet('success','ПРОТОКОЛ ЗАКРЫТ / ' + pad(m.id) + ' ИЗ ' + missions.length,m.title,'<p class="lead">' + escape(m.resolution) + '</p><div class="note-paper"><span class="micro">СЛЕДУЮЩАЯ МИССИЯ / ' + pad(current().id) + '</span><h3>' + escape(current().title) + '</h3><p>' + escape(current().brief) + '</p></div><div class="actions">' + button('launch','Продолжить '+icon('next')) + button('home','В главное меню','quiet') + '</div>',null);
  return true;
}
function lost() {
  if (!playing || failure || dialog.open) return;
  failure = true; pauseWorld(); audio.threat(); focusOn(null);
  showSheet('lost','ОБРЫВ ВИДЕОСИГНАЛА','Обходчик рядом','<p>Плёнку зажевало. Можно вернуться ко входу в сектор. Найденные предметы и записи останутся в журнале.</p><div class="actions">' + button('launch','Ко входу '+icon('next')) + button('home','В главное меню','quiet') + '</div>',null);
}
function ending() {
  pauseWorld(); audio.inWorld(false);
  showSheet('ending','АРХИВ ЗАКРЫТ / 100 ИЗ 100','Конец записи','<p class="lead">' + escape(missions[missions.length-1].resolution) + '</p><p>Все сто протоколов расследования сохранены в архиве.</p><div class="actions">' + button('home','В главное меню') + button('new','Начать заново','quiet') + '</div>',returnHome);
}
function doAction(action) {
  const back = playing ? pauseMenu : () => {};
  switch (action) {
    case 'home': returnHome(); break;
    case 'launch': launch(); break;
    case 'pause': pauseMenu(); break;
    case 'resume': resumeWorld(); break;
    case 'journal': journal(); break;
    case 'archive': case 'dossier': archive(); break;
    case 'controls':
      if (overlay === 'settings') controls(() => settingsPanel(back)); else controls(back);
      break;
    case 'settings': if (playing) pauseWorld(); settingsPanel(back); break;
    case 'sound': settings.sound = !settings.sound; applySettings(); audio.unlock(); audio.signal(); break;
    case 'flashlight': if (playing && !dialog.open) {light = !light; world.setFlashlight(light); updateHud();} break;
    case 'interact': if (playing && !dialog.open && !world.interact()) notice('Подойдите ближе и направьте прицел на предмет.',1800); break;
    case 'new': showSheet('reset','НОВАЯ КАССЕТА','Стереть прохождение?','<p>Прогресс всех 100 миссий будет сброшен.</p><div class="actions">' + button('reset','Стереть и войти') + button('ending','Отмена','quiet') + '</div>',ending); break;
    case 'ending': ending(); break;
    case 'reset': Object.assign(state,{completed:0,collected:false,read:false,started:false}); save(); launch(); break;
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('#focus-hint')) { doAction('interact'); return; }
  const el = event.target.closest('button'); if (!el) return;
  if (el.dataset.action) doAction(el.dataset.action);
  else if (el.dataset.toggle) {
    const key = el.dataset.toggle; settings[key] = !settings[key]; applySettings(); audio.unlock();
    el.setAttribute('aria-checked',settings[key]);
  } else if (el.dataset.chapter) {
    const ch = Number(el.dataset.chapter); archive(ch,missions.find(m => m.chapter === ch).id);
    const active = document.querySelector('[data-chapter="' + ch + '"]');
    active.focus({preventScroll:true}); active.scrollIntoView({block:'nearest',inline:'nearest'});
  } else if (el.dataset.mission) {
    archive(archiveChapter,Number(el.dataset.mission));
    document.querySelector('[data-mission="' + archiveMission + '"]').focus({preventScroll:true});
  } else if (el.dataset.answer !== undefined) solve(Number(el.dataset.answer),el);
});
document.addEventListener('input', event => {
  const el = event.target, key = el.dataset.setting; if (!key) return;
  settings[key] = Number(el.value); applySettings(); el.nextElementSibling.textContent = formatSetting(key); audio.unlock();
});
document.addEventListener('keydown', event => {
  if (!playing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (dialog.open) {
    if (overlay === 'journal' && (event.code === 'Tab' || event.code === 'KeyJ')) { event.preventDefault(); dismiss(); }
    return;
  }
  const action = {KeyE:'interact',KeyF:'flashlight',KeyJ:'journal',Tab:'journal',Escape:'pause'}[event.code];
  if (action) { event.preventDefault(); doAction(action); }
});
document.addEventListener('visibilitychange',() => { if (document.hidden && playing && !dialog.open) pauseMenu(); });
applySettings(); refreshMenu(); clock(); setInterval(clock,1000);
