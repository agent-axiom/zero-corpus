import test from 'node:test';
import assert from 'node:assert/strict';
import {CELL, layoutFor} from '../assets/world/facility.js';
import {gateBlocks, POST} from '../assets/world/checkpoint.js';

test('Створка перекрывает проём, поворачивается в будку и освобождает проход', () => {
  const radius = .24;
  for (let x = POST.hingeX; x <= POST.hingeX + POST.span; x += .05) {
    assert.ok(gateBlocks(x, POST.gateZ, 0, radius));
  }
  const diagonal = POST.span / Math.sqrt(2);
  assert.ok(gateBlocks(POST.hingeX + diagonal, POST.gateZ - diagonal, .5, radius));
  assert.ok(gateBlocks(POST.hingeX, POST.gateZ - POST.span, 1, radius));
  for (let z = POST.spawnZ; z >= POST.gateZ - POST.span; z -= .05) {
    assert.equal(gateBlocks(0, z, 1, radius), false);
  }
});

test('Обе миссии занимают одну проходную, и все три цели второй находятся в будке', () => {
  const entry = layoutFor(1), booth = layoutFor(2);
  assert.deepEqual(entry.cells, booth.cells);
  assert.deepEqual(entry.rooms, booth.rooms);
  assert.ok(entry.points.item.z > POST.gateZ);
  assert.ok(entry.points.clue.z > POST.gateZ && entry.points.station.z > POST.gateZ);
  assert.ok(entry.points.clue.x < POST.hingeX && entry.points.station.x > POST.hingeX + POST.span);
  // The gate crosses the only open cell in this row, so a side room cannot bypass it.
  for (const [col, row] of booth.cells.values()) {
    if (row === Math.round(-POST.gateZ / CELL)) assert.equal(col, 0);
  }
  for (const p of Object.values(booth.points)) {
    assert.ok(booth.inside(p.x, p.z) && p.z < POST.gateZ - POST.span);
  }
  assert.equal(layoutFor(3).opening, false);
});
