import test from 'node:test';
import assert from 'node:assert/strict';
import {
  restoreSanitary,
  operateSpiro,
  spiroIssue,
  spiroIntervals,
  SPIRO_RECORDS,
  SANITARY_SITES,
} from '../assets/world/sanitary.js';
import {layoutFor} from '../assets/world/facility.js';

test('Санитарный этаж сохраняет частичное измерение и восстанавливает старую найденную запись', () => {
  const pose = {x: 5, z: -10, yaw: 1, pitch: 0};
  const state = restoreSanitary(
    {selected: 1, positions: [6, 7, 12], marks: [[0, 3], [0, 3], []], pose},
    41,
  );
  assert.deepEqual(restoreSanitary(JSON.parse(JSON.stringify(state)), 41), state);
  const bad = restoreSanitary(
    {
      selected: '1',
      positions: [-1, '7', 13],
      marks: [[0, 0, '3', 2, 3], {}, ['constructor', 12]],
      exitReleased: true,
      pose: {x: '0', z: 0},
    },
    40,
  );
  assert.deepEqual(bad, {
    selected: 0,
    positions: [0, 0, 0],
    marks: [[0, 3], [], [12]],
    exitReleased: false,
    pose: null,
  });
  const legacy = restoreSanitary(null, 45);
  assert.equal(legacy.selected, 1);
  assert.deepEqual(legacy.marks[1], [0, 3, 7, 10]);
  assert.equal(restoreSanitary({exitReleased: true}, 48).exitReleased, false);
  assert.equal(restoreSanitary({exitReleased: true}, 49).exitReleased, true);
  assert.equal(restoreSanitary(null, 50).exitReleased, true);
});

test('Метки принимаются только на вдохах, не дублируются и дают измеренные интервалы', () => {
  let state = restoreSanitary(null, 41);
  state = operateSpiro(state, 'seek', 1);
  state = operateSpiro(state, 'mark');
  assert.deepEqual(state.marks[0], []);
  state = operateSpiro(state, 'select', 1);
  for (const t of [7, 0, 3]) {
    state = operateSpiro(state, 'seek', t);
    state = operateSpiro(state, 'mark');
  }
  assert.deepEqual(state.marks[1], [0, 3, 7]);
  assert.ok(spiroIssue(state));
  const previous = state;
  state = operateSpiro(operateSpiro(state, 'seek', 10), 'mark');
  state = operateSpiro(state, 'mark');
  assert.deepEqual(previous.marks[1], [0, 3, 7]);
  assert.deepEqual(state.marks[1], [0, 3, 7, 10]);
  assert.deepEqual(spiroIntervals(state.marks[1]), [3, 4, 3]);
  assert.equal(spiroIssue(state), null);
  state = operateSpiro(state, 'clear');
  assert.deepEqual(state.marks[1], []);
  assert.ok(spiroIssue(state));
});

test('Периодические записи отклоняются, положения трёх кассет независимы', () => {
  for (const index of [0, 2]) {
    let state = operateSpiro(restoreSanitary(null, 41), 'select', index);
    for (const time of SPIRO_RECORDS[index].peaks)
      state = operateSpiro(operateSpiro(state, 'seek', time), 'mark');
    assert.ok(spiroIssue(state));
  }
  let state = restoreSanitary(null, 41);
  state = operateSpiro(state, 'step', -1);
  assert.equal(state.positions[0], 0);
  state = operateSpiro(state, 'seek', 6);
  state = operateSpiro(state, 'select', 2);
  for (let i = 0; i < 15; i++) state = operateSpiro(state, 'step', 1);
  assert.deepEqual(state.positions, [6, 0, 12]);
  state = operateSpiro(state, 'seek', '3');
  state = operateSpiro(state, 'seek', 13);
  assert.equal(state.positions[2], 12);
  state = operateSpiro(state, 'select', 0);
  assert.equal(state.positions[state.selected], 6);
});

test('Миссии санитарного этажа занимают одну карту без обхода процедурной', () => {
  const first = layoutFor(41);
  for (let id = 41; id <= 50; id++) {
    const layout = layoutFor(id);
    assert.equal(layout.sanitaryWing, true);
    assert.deepEqual(layout.cells, first.cells);
    assert.deepEqual(layout.rooms, first.rooms);
    for (const kind of ['item', 'clue', 'station']) {
      const p = SANITARY_SITES[id][kind];
      assert.ok(layout.inside(p.x, p.z), id + '/' + kind);
    }
  }
  assert.equal(first.has(-2, 4), false);
  assert.equal(first.end, 12);
  assert.equal(layoutFor(40).sanitaryWing, false);
  assert.equal(layoutFor(51).sanitaryWing, false);
});
