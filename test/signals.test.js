import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSignals, SIGNAL_SITES, SIGNAL_BOARD} from '../assets/world/signals.js';
import {doorBlocks} from '../assets/world/chapter.js';
import {layoutFor} from '../assets/world/facility.js';

test('Дом связи сохраняет выбранное гнездо, проверенные линии и позицию', () => {
  const pose = {x: -5, z: -10, yaw: 1, pitch: 0};
  const saved = restoreSignals({selectedLine: 2, heard: [true, false, true], pose}, 10);
  assert.equal(saved.selectedLine, 2);
  assert.deepEqual(saved.heard, [true, false, true]);
  assert.deepEqual(saved.pose, pose);
  assert.deepEqual(restoreSignals(null, 11).heard, [false, true, false]);
  assert.equal(restoreSignals(null, 11).selectedLine, 1);
  for (const selectedLine of ['1', Infinity, 3, -2])
    assert.equal(restoreSignals({selectedLine}, 10).selectedLine, -1);
  assert.deepEqual(restoreSignals({heard: ['true', 1, false]}, 10).heard, [false, false, false]);
  assert.equal(restoreSignals({exitReleased: true}, 18).exitReleased, false);
  assert.equal(restoreSignals({exitReleased: true}, 19).exitReleased, true);
  assert.equal(restoreSignals(null, 20).exitReleased, true);
});

test('Все десять заданий Дома связи занимают одну карту', () => {
  const first = layoutFor(11);
  for (let id = 11; id <= 20; id++) {
    const layout = layoutFor(id);
    assert.equal(layout.signalHouse, true);
    assert.deepEqual(layout.cells, first.cells);
    assert.deepEqual(layout.rooms, first.rooms);
    for (const kind of ['item', 'clue', 'station']) {
      const p = SIGNAL_SITES[id][kind];
      assert.ok(layout.inside(p.x, p.z), id + '/' + kind);
    }
  }
  assert.deepEqual(first.points.station, SIGNAL_BOARD);
  assert.equal(layoutFor(10).signalHouse, false);
  assert.equal(layoutFor(21).signalHouse, false);
});

test('Створка левой кабины открывается внутрь комнаты и освобождает порог', () => {
  const left = {axis: 'z', side: -1, hingeX: -1.95, hingeZ: -24.34, span: 1.6, progress: 0};
  assert.equal(doorBlocks(left, -1.95, -23.54), true);
  left.progress = 1;
  assert.equal(doorBlocks(left, -1.95, -23.54), false);
  assert.equal(doorBlocks(left, -2.8, -24.34), true);
  assert.equal(doorBlocks(left, -0.8, -24.34), false);
});
