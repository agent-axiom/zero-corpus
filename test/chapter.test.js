import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreChapter, doorBlocks, CHAPTER_SITES} from '../assets/world/chapter.js';
import {layoutFor} from '../assets/world/facility.js';

test('Старые сохранения открывают пройденные комнаты, новый ключ ждёт использования', () => {
  assert.equal(restoreChapter(null, 2).archiveOpen, false);
  assert.equal(restoreChapter(null, 3).archiveOpen, true);
  assert.equal(restoreChapter({archiveOpen:false}, 3).archiveOpen, false);
  assert.equal(restoreChapter({archiveOpen:true}, 7).archiveOpen, true);
  assert.equal(restoreChapter({relayReleased:true}, 8).relayReleased, false);
  assert.equal(restoreChapter({relayReleased:true}, 9).relayReleased, true);
  assert.equal(restoreChapter(null, 10).relayReleased, false);
});

test('Положение игрока восстанавливается только из числовых координат главы', () => {
  const pose = {x:4.2,z:-8.9,yaw:1.1,pitch:-.2};
  assert.deepEqual(restoreChapter({pose},3).pose,pose);
  for (const invalid of [{...pose,x:Infinity},{...pose,z:-400},{...pose,yaw:'0'},{...pose,pitch:2}])
    assert.equal(restoreChapter({pose:invalid},3).pose,null);
});

test('Открытая створка освобождает проход и сохраняет коллизию у стены', () => {
  const archive = {axis:'z',hingeX:1.95,hingeZ:-9.74,span:1.6,progress:0};
  assert.equal(doorBlocks(archive,1.95,-8.94),true);
  archive.progress=1;
  assert.equal(doorBlocks(archive,1.95,-8.94),false);
  assert.equal(doorBlocks(archive,2.8,-9.74),true);
  const exit = {axis:'x',hingeX:-1.65,hingeZ:-41.95,span:3.3,progress:0};
  assert.equal(doorBlocks(exit,0,-41.95),true);
  exit.progress=1;
  assert.equal(doorBlocks(exit,0,-42.9),false);
});

test('Восемь заданий используют разные приборы на одной карте', () => {
  const common=layoutFor(3).cells, stations=new Set();
  for(let id=3;id<=10;id++) {
    const layout=layoutFor(id);
    assert.deepEqual(layout.cells,common);
    for(const kind of ['item','clue','station']) assert.ok(layout.inside(CHAPTER_SITES[id][kind].x,CHAPTER_SITES[id][kind].z));
    stations.add(JSON.stringify(CHAPTER_SITES[id].station));
  }
  assert.equal(stations.size,8);
});
