import test from 'node:test';
import assert from 'node:assert/strict';
import {
  restoreWater,
  operateWater,
  waterIssue,
  WATER_SITES,
  WATER_VALVES,
} from '../assets/world/water.js';
import {layoutFor} from '../assets/world/facility.js';

test('Водомерный узел восстанавливает незавершённые операции и исправляет старые сохранения', () => {
  const pose = {x: -5, z: -11, yaw: 1, pitch: 0};
  const raw = {
    risers: [false, true, false, false],
    equalizer: 1,
    channel: 'Б',
    pumpSlot: 1,
    valveOrder: ['слив', 'обход'],
    pose,
  };
  const restored = restoreWater(JSON.parse(JSON.stringify(raw)), 30);
  assert.deepEqual(restored, {...raw, exitReleased: false});
  const bad = restoreWater(
    {
      risers: [1, 'true', null],
      equalizer: '2',
      channel: {toString: 'broken'},
      pumpSlot: 4,
      valveOrder: ['__proto__', 'слив', 'слив', null],
      exitReleased: true,
      pose: {x: '1', z: -10, yaw: 0, pitch: 0},
    },
    30,
  );
  assert.deepEqual(bad, {
    risers: [false, false, false, false],
    equalizer: 0,
    channel: null,
    pumpSlot: 0,
    valveOrder: ['слив'],
    exitReleased: false,
    pose: null,
  });
  const legacy = restoreWater(null, 38);
  assert.deepEqual(legacy.risers, [true, false, false, false]);
  assert.equal(legacy.equalizer, 2);
  assert.equal(legacy.channel, 'А');
  assert.equal(legacy.pumpSlot, 2);
  assert.deepEqual(legacy.valveOrder, WATER_VALVES);
  assert.equal(restoreWater({exitReleased: true}, 38).exitReleased, false);
  assert.equal(restoreWater({exitReleased: true}, 39).exitReleased, true);
  assert.equal(restoreWater(null, 40).exitReleased, true);
});

test('Уравнитель переносит деления с сохранением суммы, включая отмену и границы хода', () => {
  let state = restoreWater(null, 31);
  assert.ok(waterIssue(32, state));
  state = operateWater(state, 'transfer', -1);
  assert.equal(state.equalizer, 0);
  state = operateWater(state, 'transfer', 1);
  assert.equal(state.equalizer, 1);
  const resumed = restoreWater(JSON.parse(JSON.stringify(state)), 31);
  state = operateWater(resumed, 'transfer', 1);
  assert.deepEqual([6 - state.equalizer, 2 + state.equalizer], [4, 4]);
  assert.equal(waterIssue(32, state), null);
  for (let i = 0; i < 6; i++) {
    state = operateWater(state, 'transfer', 1);
    assert.equal(6 - state.equalizer + (2 + state.equalizer), 8);
  }
  assert.equal(state.equalizer, 4);
  assert.ok(waterIssue(32, state));
  state = operateWater(operateWater(state, 'transfer', -1), 'transfer', -1);
  assert.equal(waterIssue(32, state), null);
});

test('Поток требует одного правильного стояка, непрерывного уклона и двух пазов маховика', () => {
  let state = restoreWater(null, 30);
  assert.ok(waterIssue(31, state));
  state = operateWater(state, 'riser', 3);
  assert.ok(waterIssue(31, state));
  state = operateWater(state, 'riser', 0);
  assert.ok(waterIssue(31, state));
  state = operateWater(state, 'riser', 3);
  assert.equal(waterIssue(31, state), null);
  for (const route of ['Б', 'В']) assert.ok(waterIssue(34, operateWater(state, 'channel', route)));
  assert.equal(waterIssue(34, operateWater(state, 'channel', 'А')), null);
  state = operateWater(state, 'pump', 1);
  assert.ok(waterIssue(35, state));
  state = operateWater(state, 'pump', 1);
  assert.equal(waterIssue(35, state), null);
  state = operateWater(state, 'pump', -1);
  assert.ok(waterIssue(35, state));
  state = operateWater(state, 'pump', -1);
  state = operateWater(state, 'pump', -1);
  assert.equal(state.pumpSlot, 3);
});

test('Клапаны сохраняют фактический порядок открытия и допускают исправление ошибки', () => {
  let state = restoreWater(null, 37);
  state = operateWater(state, 'valve', 'слив');
  state = operateWater(state, 'valve', 'забор');
  state = operateWater(state, 'valve', 'обход');
  assert.ok(waterIssue(38, state));
  state = operateWater(state, 'reset-valves');
  state = operateWater(state, 'valve', 'забор');
  state = restoreWater(JSON.parse(JSON.stringify(state)), 37);
  assert.deepEqual(state.valveOrder, ['забор']);
  state = operateWater(state, 'valve', 'забор');
  assert.deepEqual(state.valveOrder, ['забор']);
  state = operateWater(state, 'valve', 'обход');
  assert.ok(waterIssue(38, state));
  state = operateWater(state, 'valve', 'слив');
  assert.equal(waterIssue(38, state), null);
});

test('Все задания водомерного узла занимают одну карту без обхода закрытых комнат', () => {
  const first = layoutFor(31);
  for (let id = 31; id <= 40; id++) {
    const layout = layoutFor(id);
    assert.equal(layout.waterWing, true);
    assert.deepEqual(layout.cells, first.cells);
    assert.deepEqual(layout.rooms, first.rooms);
    for (const kind of ['item', 'clue', 'station']) {
      const p = WATER_SITES[id][kind];
      assert.ok(layout.inside(p.x, p.z), id + '/' + kind);
    }
  }
  assert.equal(first.has(2, 5), false);
  assert.equal(first.end, 12);
  assert.equal(layoutFor(30).waterWing, false);
  assert.equal(layoutFor(41).waterWing, false);
});
