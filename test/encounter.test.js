import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFirstEncounter, createFirstEncounter, FIRST_PATROL} from '../assets/world/encounter.js';

const byCabinet = {collected: true, nearCabinet: true, sheltered: false, playerZ: -21.35};
function tick(state, seconds, player = byCabinet) {
  const events = [];
  for (let time = 0; time < seconds; time += .02) events.push(...advanceFirstEncounter(state, .02, player));
  return events;
}

test('Первый обход начинается у найденного ключа и оставляет десять секунд на укрытие', () => {
  const state = createFirstEncounter();
  tick(state, 90, {...byCabinet, collected: false});
  tick(state, 90, {...byCabinet, nearCabinet: false});
  assert.equal(state.phase, 'waiting');
  assert.deepEqual(tick(state, .02), ['warning']);
  const events = tick(state, 9.9);
  assert.ok(events.includes('shadow'));
  assert.equal(state.phase, 'warning');
  assert.equal(tick(state, .2).filter(phase => phase === 'patrol').length, 1);
  assert.equal(state.phase, 'patrol');
});

test('Пройденная встреча сохраняется только после укрытия рядом с проходящим Обходчиком', () => {
  const state = createFirstEncounter();
  tick(state, 10.1);
  const events = tick(state, 21, {...byCabinet, sheltered: true, playerZ: -25.5});
  assert.equal(state.phase, 'passed');
  assert.equal(events.filter(phase => phase === 'passed').length, 1);
  assert.equal(tick(state, 60).filter(phase => phase === 'passed').length, 0);
  assert.equal(createFirstEncounter(true).phase, 'passed');
  assert.equal(createFirstEncounter(false).phase, 'waiting');
});

test('Побег к входу и дальняя комната оставляют возможность повторить встречу у ключницы', () => {
  for (const sheltered of [false, true]) {
    const state = createFirstEncounter();
    tick(state, 10.1);
    tick(state, 21, {...byCabinet, nearCabinet: false, sheltered, playerZ: 8});
    assert.equal(state.phase, 'waiting');
    assert.equal(state.witnessed, false);
    assert.deepEqual(tick(state, .02), ['warning']);
    assert.equal(state.time, 0);
    assert.ok(FIRST_PATROL.warning >= 10);
  }
});

test('Остановка игрового времени сохраняет оставшееся время предупреждения', () => {
  const state = createFirstEncounter();
  tick(state, 4);
  const before = state.time;
  for (let frame = 0; frame < 1000; frame++) advanceFirstEncounter(state, 0, byCabinet);
  assert.equal(state.time, before);
  assert.equal(state.phase, 'warning');
  tick(state, 5);
  assert.equal(state.phase, 'warning');
});
