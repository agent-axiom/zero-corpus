import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {restoreArchive, ARCHIVE_SITES, ARCHIVE_CAROUSEL} from '../assets/world/archive.js';
import {buildAccess} from '../assets/world/access.js';
import {layoutFor} from '../assets/world/facility.js';

test('Архив сохраняет адрес, открытый ящик, просмотренные документы и позицию', () => {
  const pose = {x: -4, z: -11, yaw: 1, pitch: 0};
  const saved = restoreArchive(
    {
      fund: 'Л',
      drawer: 14,
      opened: 'Л/14',
      inspected: ['К/9', 'Л/14', 'Л/14', '__proto__', null],
      pose,
    },
    20,
  );
  assert.equal(saved.fund, 'Л');
  assert.equal(saved.drawer, 14);
  assert.equal(saved.opened, 'Л/14');
  assert.deepEqual(saved.inspected, ['К/9', 'Л/14']);
  assert.deepEqual(saved.pose, pose);
  const invalid = restoreArchive(
    {fund: 'Т/11', drawer: '11', opened: 11, inspected: {}, pose: {x: '0', z: 0}},
    20,
  );
  assert.deepEqual(
    [invalid.fund, invalid.drawer, invalid.opened, invalid.inspected, invalid.pose],
    ['К', 11, null, [], null],
  );
  assert.equal(restoreArchive({exitReleased: true}, 28).exitReleased, false);
  assert.equal(restoreArchive({exitReleased: true}, 29).exitReleased, true);
  assert.equal(restoreArchive(null, 30).exitReleased, true);
  assert.deepEqual(restoreArchive(null, 26).inspected, ['Т/11']);
  assert.equal(restoreArchive(null, 26).fund, 'Т');
});

test('Десять миссий архива используют одну карту без обхода запертого учёта', () => {
  const first = layoutFor(21);
  for (let id = 21; id <= 30; id++) {
    const layout = layoutFor(id);
    assert.equal(layout.archiveWing, true);
    assert.deepEqual(layout.cells, first.cells);
    assert.deepEqual(layout.rooms, first.rooms);
    for (const kind of ['item', 'clue', 'station']) {
      const p = ARCHIVE_SITES[id][kind];
      assert.ok(layout.inside(p.x, p.z), id + '/' + kind);
    }
  }
  assert.deepEqual(first.points.station, ARCHIVE_CAROUSEL);
  assert.equal(first.has(-2, 4), false);
  assert.equal(layoutFor(20).archiveWing, false);
  assert.equal(layoutFor(31).archiveWing, false);
});

test('Допуски перекрывают движение, обзор и восстановление за закрытой дверью', () => {
  const material = new THREE.MeshBasicMaterial(),
    box = new THREE.BoxGeometry();
  const group = new THREE.Group();
  const access = buildAccess(
    {
      group,
      box,
      mat: {paint: material, door: material, zinc: material},
      block() {},
      sign() {},
      solid() {},
    },
    [
      ['bindery', 1.95, -8.94, 21, ''],
      ['register', -1.95, -23.54, 23, ''],
      ['vault', 1.95, -23.54, 26, ''],
    ],
    {exitRequired: 30, exitTitle: '', exitSubtitle: ''},
  );
  access.apply(20, false, true);
  assert.equal(access.blocks(1.95, -8.94, 0.24), true);
  assert.equal(access.lineClear({x: 0, z: -8.94}, {x: 4, z: -8.94}), false);
  assert.equal(access.canRestorePose({x: 4, z: -8.94}), false);
  assert.equal(access.canRestorePose({x: -5, z: -23.54}), false);
  access.apply(23, false, true);
  assert.equal(access.blocks(1.95, -8.94, 0.24), false);
  assert.equal(access.lineClear({x: 0, z: -8.94}, {x: 4, z: -8.94}), true);
  assert.equal(access.lineClear({x: 0, z: -10.5}, {x: 4, z: -10.5}), false);
  assert.equal(access.canRestorePose({x: -5, z: -23.54}), true);
  assert.equal(access.canRestorePose({x: 5, z: -23.54}), false);
  assert.equal(access.canRestorePose({x: 0, z: -43}), false);
  access.apply(29, true, true);
  assert.equal(access.canRestorePose({x: 5, z: -23.54}), true);
  assert.equal(access.canRestorePose({x: 0, z: -43}), true);
  box.dispose();
  material.dispose();
  for (const d of access.doors) d.lamp.dispose();
});
