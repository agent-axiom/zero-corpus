import test from 'node:test';
import assert from 'node:assert/strict';
import {chapters, missions} from '../campaign.js';
import {CELL, layoutFor} from '../assets/world/facility.js';

test('Каждая из 100 миссий имеет улику, предмет, станцию, уникальный ответ и развязку', () => {
  assert.equal(missions.length,100);
  assert.equal(chapters.length,10);
  assert.equal(new Set(missions.map(m => m.title)).size,100);
  for (const [index,m] of missions.entries()) {
    assert.equal(m.id,index + 1);
    assert.equal(m.chapter,Math.floor(index / 10) + 1);
    for (const key of ['title','brief','item','clue','station','prompt','resolution'])
      assert.ok(m[key]?.trim(),m.id + ' / ' + key);
    assert.equal(new Set(m.options).size,m.options.length);
    assert.ok(m.options.length >= 3 && Number.isInteger(m.answer) && m.options[m.answer],m.id);
  }
});

test('Маршрут от входа ко всем трём точкам существует во всех секторах', () => {
  for (const m of missions) {
    const layout = layoutFor(m.id), seen = new Set(), queue = [[0,0]];
    while (queue.length) {
      const [x,z] = queue.pop(), key = [x,z].join('/');
      if (seen.has(key) || !layout.inside(x * CELL,z * CELL)) continue;
      seen.add(key); queue.push([x+1,z],[x-1,z],[x,z+1],[x,z-1]);
    }
    for (const [kind,{x,z}] of Object.entries(layout.points)) {
      const target = [Math.round(x / CELL),Math.round(z / CELL)].join('/');
      assert.ok(seen.has(target),'Миссия ' + m.id + ' / ' + kind);
    }
    assert.notEqual(layout.itemRoom,layout.clueRoom);
  }
});
