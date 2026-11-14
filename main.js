import {chapters, missions} from './campaign.js';
import {createAudio} from './audio.js';
import {mountInstrument} from './instruments.js';
import {mountToken} from './token.js';
import {restoreChapter} from './assets/world/chapter.js';

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
  collected: raw.collected === true, read: raw.read === true, started: raw.started === true,
  // The original plaque explicitly told the player which mark was on the token.
  tokenInspected: raw.completed === 0 && raw.collected === true &&
    (raw.tokenInspected === true || (raw.tokenInspected === undefined && raw.read === true)),
  encounterPassed: (Number.isFinite(raw.completed) && raw.completed >= 3) ||
    (raw.completed === 2 && raw.encounterPassed === true)
};
const settings = {sound: cfg.sound !== false, volume: range(cfg.volume, 0, 1, .6), sensitivity: range(cfg.sensitivity, .3, 2, 1), grain: cfg.grain !== false};
state.chapter = restoreChapter(raw.chapter, state.completed);
const audio = createAudio();
const dialog = $('#dialog'), body = $('#dialog-body');
let world, playing = false, loading = false, light = true, overlay = '', onDismiss = null;
let hintTimeout, archiveChapter = 1, archiveMission = 1, launchTime = performance.now(), failure = false;
let encounterSheltered = false;
const current = () => missions[Math.min(state.completed, missions.length - 1)];
const chapterOf = mission => chapters.find(ch => ch.id === mission.chapter);
const finished = () => state.completed === missions.length;
function save() {
  if (playing && current().id <= 10) state.chapter.pose = world?.getChapterPose() ?? state.chapter.pose;
  write(saveKey, state); refreshMenu();
}
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
  body.replaceChildren();
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
  if (message && ms > 0) hintTimeout = setTimeout(() => { $('#notice').textContent = ''; }, ms);
}
function focusOn(kind) {
  const m = current();
  const clueName = m.id === 1 ? 'Прочитать табличку' : m.id === 2 ? 'Прочитать контрольную ленту' : state.read ? 'Перечитать улику' : 'Изучить улику';
  const label = {item: m.item, clue: clueName, station: m.station, door: 'Открыть архив ключом смены'}[kind];
  $('#focus-hint').hidden = !label; $('#focus-hint span').textContent = label || '';
  $('#game').classList.toggle('focused', Boolean(label));
}
function objectiveFor(m) {
  if (m.id === 1) {
    if (!state.collected) return 'Найти жетон в приёмной';
    if (!state.tokenInspected) return 'Осмотреть оборот жетона в журнале';
    if (!state.read) return 'Прочитать табличку у турникета';
    return 'Вставить жетон в подходящий приёмник';
  }
  if (m.id === 2) {
    if (!state.collected) return 'Найти стрелку в будке за турникетом';
    if (!state.read) return 'Изучить контрольную ленту в будке';
    return 'Выставить время на табельных часах';
  }
  if (m.id === 3) {
    if (!state.collected) return 'Найти бородку в ключнице у ремонтной';
    if (!state.encounterPassed && world?.getEncounterStatus() === 'waiting') return 'Вернуться к ключнице у ремонтной';
    if (!state.encounterPassed) return encounterSheltered
      ? 'Оставайтесь за дверью, пока Обходчик проходит'
      : 'Укройтесь в ремонтной за открытой дверью';
    return state.read ? 'Собрать ключ на оправке в ремонтной' : 'Найти журнал слесаря в ремонтной';
  }
  if (m.id === 4 && !state.chapter.archiveOpen) return 'Открыть архив собранным ключом';
  if (m.id === 10 && state.chapter.relayReleased) return 'Пройти через открытый шлюз за будкой';
  if (m.id <= 10) {
    const rooms = world?.getLocations() || {};
    if (!state.collected) return {
      4: 'Найти копирку в архиве',
      5: 'Найти план эвакуации в архиве',
      6: 'Найти пробку в картотеке',
      7: 'Взять зеркало на левом столе будки',
      8: 'Взять номерок в открытом шкафу приёмной',
      9: 'Найти кулачок в телефонном чехле',
      10: 'Взять реле у самописца в будке',
    }[m.id];
    if (!state.read) return 'Прочитать запись · ' + rooms.clue;
    return m.station + ' · ' + rooms.station;
  }
  return !state.collected ? 'Найти предмет · ' + m.item : !state.read ? 'Отыскать и изучить улику' : 'Использовать предмет · ' + m.station;
}
function updateHud() {
  const m = current(), objective = objectiveFor(m);
  $('#objective').innerHTML = '<small class="micro">МИССИЯ ' + pad(m.id) + ' / ' + escape(chapterOf(m).title.toUpperCase()) + '</small><strong>' + escape(m.title) + '</strong><span>' + escape(objective) + '</span>';
  $('#light-state').textContent = light ? 'Свет вкл.' : 'Свет выкл.';
}
function pauseWorld() { if (playing) { save(); world?.pause(); } }
function resumeWorld() {
  if (!playing || failure || finished()) return;
  clearSheet(); audio.unlock(); world.resume(); updateHud();
}
function returnHome() {
  if (playing) save();
  playing = false; failure = false; encounterSheltered = false; clearSheet(); world?.pause(); focusOn(null); notice('');
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
        onMove: () => audio.step(),
        onChapterExit: () => {
          if (current().id !== 10 || !state.chapter.relayReleased) return;
          state.completed = 10; state.collected = false; state.read = false;
          save(); launch();
        },
        onEncounter: event => {
          if (!playing) return;
          if (event.phase === 'step') { audio.watcherStep(event.pan, event.distance); return; }
          if (event.phase === 'warning') audio.relay();
          encounterSheltered = event.sheltered === true;
          if (event.message) notice(event.message, event.phase === 'passed' ? 6500 : 0);
          updateHud();
        },
        onEncounterComplete: () => {
          if (current().id !== 3 || state.encounterPassed) return;
          state.encounterPassed = true; save(); updateHud();
        },
        onPhoneRing: (pan, distance) => {
          audio.phoneRing(pan, distance);
          notice('За турникетом один раз звонит телефон. В будке загораются часы.', 4200);
        }
      });
    }
    const firstVisit = !state.started;
    playing = true; failure = false; light = true; encounterSheltered = false; focusOn(null);
    $('#terminal').hidden = true; $('#game').hidden = false;
    world.setSensitivity(settings.sensitivity); world.start(current(), {
      encounterPassed: state.encounterPassed, chapter: state.chapter, completed: state.completed,
    });
    world.setCollected(state.collected); world.setClueRead?.(state.read); world.setFlashlight(light);
    audio.inWorld(true); state.started = true; save(); updateHud();
    if (current().id === 3 && state.collected && !state.encounterPassed) notice('Бородка ключа сохранена. Вернитесь к ключнице у ремонтной.', 0);
    else if (current().id === 4 && !state.chapter.archiveOpen) notice('Собранный ключ с вами. Архив находится справа от входа в проходную.', 5500);
    else if (current().id === 10 && state.chapter.relayReleased) notice('Реле включено. Пройдите через открытый шлюз в Дом связи.', 0);
    else if (current().id === 2) notice('Турникет открыт. Часы горят в будке за ним.', 3900);
    else notice(firstVisit ? (matchMedia('(pointer:coarse)').matches ? 'Слева — ходьба, справа — обзор. Цель и записи доступны в журнале.' : 'WASD — ходьба · Щёлкните в сцене для обзора · E — осмотреть · J — журнал') : 'Полевой журнал восстановлен', firstVisit ? 7500 : 2400);
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
  const clueName = m.id === 1 ? 'Табличка проходов' : m.id === 2 ? 'Контрольная лента' : 'Улика';
  const hasToken = m.id === 1 && state.collected;
  const mark = hasToken ? goal(state.tokenInspected ? 'На обороте одна косая насечка' : 'Осмотреть оборот жетона', state.tokenInspected) : '';
  const inspect = hasToken ? button('inspect-token','Осмотреть жетон','secondary') : '';
  const encounter = m.id === 3 && state.collected ? goal('Переждать обход в ремонтной',state.encounterPassed,'За открытой дверью слева от ключницы') : '';
  const key = m.id >= 4 && m.id <= 10 ? goal('Ключ смены собран',true) + goal('Дверь архива открыта',state.chapter.archiveOpen,'Справа в начале коридора') : '';
  showSheet('journal','ПОЛЕВОЙ ЖУРНАЛ / МИССИЯ ' + pad(m.id),m.title,'<p>' + escape(m.brief) + '</p><ul class="goal-list">' + key + goal(m.item,state.collected,rooms.item) + mark + encounter + goal(clueName,state.read,rooms.clue) + goal(m.station,false,rooms.station) + '</ul>' + note + '<div class="actions">' + inspect + button('resume','Вернуться в корпус '+icon('next')) + '</div>',resumeWorld);
}
function inspectToken(back = resumeWorld) {
  if (current().id !== 1 || !state.collected) return;
  pauseWorld();
  showSheet('token','ПРЕДМЕТ ИЗ ПРИЁМНОЙ',current().item,'<div id="token-inspector"></div><div class="actions">' + button('dismiss','Убрать жетон') + '</div>',back);
  mountToken($('#token-inspector'), () => {
    if (state.tokenInspected) return;
    state.tokenInspected = true;
    save(); updateHud();
  });
}
function interact(kind) {
  if (!playing || dialog.open || failure || finished()) return;
  const m = current();
  if (kind === 'door') {
    if (state.completed < 3) { notice('Замок архива требует собранный ключ смены. Оправка стоит в ремонтной.'); return; }
    state.chapter.archiveOpen = true; save(); world.applyChapter(state.chapter);
    audio.turnstile(); updateHud(); notice('Ключ остался в замке. Дверь архива открывается.', 5000);
    return;
  }
  if (kind === 'item') {
    if (!state.collected) {
      state.collected = true; world.setCollected(true); save(); updateHud(); audio.pickup();
      if (m.id === 1) inspectToken();
      else notice('В инвентаре · ' + m.item);
    }
  } else if (kind === 'clue') {
    pauseWorld(); state.read = true; world.setClueRead?.(true); save(); updateHud(); audio.signal();
    const title = m.id === 1 ? 'Табличка проходов' : m.id === 2 ? 'Контрольная лента' : 'Полевая запись';
    showSheet('clue','УЛИКА / ДЕЛО ' + pad(m.id),title,'<div class="note-paper"><p class="lead">' + escape(m.clue) + '</p></div><div class="actions">' + button('resume','Убрать в журнал '+icon('file')) + '</div>',resumeWorld);
  } else if (kind === 'station') {
    if (m.id === 10 && state.chapter.relayReleased) { notice('Реле уже включено. Выход открыт за будкой.', 0); return; }
    if (m.id === 3 && state.collected && !state.encounterPassed) {
      notice('Обходчик ещё рядом. Переждите его за дверью ремонтной, затем вернитесь к оправке.', 0);
      return;
    }
    if (m.id === 1 && state.collected && !state.tokenInspected) { inspectToken(); return; }
    if (!state.collected || !state.read) {
      notice(m.id <= 2 ? objectiveFor(m) : !state.collected ? 'Нужен предмет · ' + m.item : 'Сначала найдите улику. Ориентир есть в журнале.'); return;
    }
    pauseWorld();
    showSheet('puzzle','УЗЕЛ ДОСТУПА / МИССИЯ ' + pad(m.id),m.station,'<p class="lead">' + escape(m.prompt) + '</p><details class="note-paper"><summary>Свериться с уликой</summary><p>' + escape(m.clue) + '</p></details><div class="options">' + m.options.map((v,i) => '<button class="option" data-answer="' + i + '"><small>' + pad(i+1,2) + '</small> ' + escape(v) + '</button>').join('') + '</div><p class="error" role="status" id="puzzle-status"></p>',resumeWorld);
    mountInstrument(body.querySelector('.options'), m, index => solve(index));
  }
}
function solve(index, target) {
  if (overlay !== 'puzzle') return false;
  const m = current();
  if (index !== m.answer) {
    if (m.id === 1 && index < 0) {
      $('#puzzle-status').textContent = 'Сначала выберите приёмник.';
      return false;
    }
    if (target) target.disabled = true;
    $('#puzzle-status').textContent = m.id === 1
      ? 'Турникет вернул жетон. Сверьте насечку с табличкой проходов.'
      : 'Цепь не замкнулась. Сверьтесь с уликой и попробуйте ещё раз.';
    audio.signal(); return false;
  }
  if (m.id === 10) {
    state.chapter.relayReleased = true; save(); world.applyChapter(state.chapter);
    resumeWorld(); audio.turnstile(); notice('Реле включено. Пройдите через открытый шлюз за будкой.', 0);
    return true;
  }
  state.completed = m.id; state.read = false; state.collected = false; state.tokenInspected = false; save(); notice(''); focusOn(null);
  if (m.id === 1) {
    world.advanceToClock(current()); resumeWorld(); audio.turnstile();
    return true;
  }
  if (m.id < 10) {
    world.advanceChapter(current(), state.completed, state.chapter);
    resumeWorld(); audio.pickup();
    if (m.id === 5 || m.id === 6) audio.relay();
    if (m.id === 9) audio.phoneReply();
    notice(m.resolution + ' ' + objectiveFor(current()) + '.', 8000);
    return true;
  }
  audio.pickup();
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
    case 'inspect-token': inspectToken(journal); break;
    case 'dismiss': dismiss(); break;
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
    case 'reset': Object.assign(state,{completed:0,collected:false,read:false,tokenInspected:false,encounterPassed:false,started:false,chapter:restoreChapter(null,0)}); save(); launch(); break;
  }
}
// During a multi-touch walk Chromium can omit the compatibility click on the HUD.
$('#game').addEventListener('touchend', event => {
  const control = event.target.closest('[data-action], #focus-hint');
  if (!control) return;
  event.preventDefault();
  const finger = event.changedTouches[0];
  if (control.contains(document.elementFromPoint(finger.clientX, finger.clientY))) {
    doAction(control.dataset.action || 'interact');
  }
}, {passive:false});
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
    if (overlay === 'journal' && event.code === 'KeyJ') { event.preventDefault(); dismiss(); }
    return;
  }
  const action = {KeyE:'interact',KeyF:'flashlight',KeyJ:'journal',Tab:'journal',Escape:'pause'}[event.code];
  if (action) { event.preventDefault(); doAction(action); }
});
document.addEventListener('visibilitychange',() => { if (document.hidden && playing && !dialog.open) pauseMenu(); });
applySettings(); refreshMenu(); clock(); setInterval(clock,1000);
setInterval(() => { if (playing && !dialog.open && current().id <= 10) save(); }, 4000);
