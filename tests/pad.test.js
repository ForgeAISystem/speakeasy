'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/shared/pad');
const globe = require('../src/main/globe-key');

test('pad keys mirror the screen: Q top left, S full, C bottom right, digits are workflows', () => {
  const pads = P.defaultPads();
  assert.equal(P.KEYS.length, 16);
  assert.equal(pads.Q.region, 'top-left');
  assert.equal(pads.S.region, 'full');
  assert.equal(pads.C.region, 'bottom-right');
  assert.equal(pads['1'].type, 'layout');
  assert.equal(pads.R.type, 'record');
});

test('neighboring halves share an edge with no gap on odd-sized screens', () => {
  const area = { x: -1728, y: 25, width: 1727, height: 1091 };
  const left = P.frameFor('left', area), right = P.frameFor('right', area);
  assert.equal(left.x + left.width, right.x);
  assert.equal(right.x + right.width, area.x + area.width);
  const top = P.frameFor('top', area), bottom = P.frameFor('bottom', area);
  assert.equal(top.y + top.height, bottom.y);
  assert.ok(P.sameFrame(left, { ...left, x: left.x + 5 }));
  assert.ok(!P.sameFrame(left, right));
});

test('saved pads keep known actions and drop unknown ones', () => {
  const pads = P.normalize({ Q: { type: 'app', app: 'Notes' }, W: { type: 'rm -rf' }, ZZ: { type: 'app' } });
  assert.equal(pads.Q.app, 'Notes');
  assert.equal(pads.W.type, 'snap');
  assert.equal(pads.ZZ, undefined);
});

test('key combos parse into System Events terms', () => {
  assert.deepEqual(P.parseKeys('cmd+shift+4'), { key: '4', modifiers: ['command', 'shift'] });
  assert.deepEqual(P.parseKeys('ctrl opt space'), { code: 49, modifiers: ['control', 'option'] });
  assert.equal(P.parseKeys('cmd+shift'), null);
  assert.equal(P.parseKeys('cmd+banana'), null);
});

function fakeDefaults(initial) {
  let value = initial;
  const calls = [];
  const exec = (cmd, args, _opts, cb) => {
    calls.push([cmd, ...args]);
    if (cmd === 'defaults' && args[0] === 'read') return value === null ? cb(new Error('does not exist'), '', 'missing') : cb(null, `${value}\n`, '');
    if (cmd === 'defaults' && args[0] === 'write') { value = Number(args.at(-1)); return cb(null, '', ''); }
    if (cmd === 'defaults' && args[0] === 'delete') { value = null; return cb(null, '', ''); }
    return cb(null, '', '');
  };
  return { exec, calls, get value() { return value; } };
}

test('Globe fix sets Do Nothing, reports the old value, and Undo puts it back', async () => {
  const d = fakeDefaults(null);
  assert.equal((await globe.status({ platform: 'darwin', exec: d.exec })).opensPopup, true);
  const res = await globe.fix({ exec: d.exec });
  assert.deepEqual(res, { ok: true, previous: null });
  assert.equal(d.value, 0);
  assert.equal((await globe.status({ platform: 'darwin', exec: d.exec })).opensPopup, false);
  assert.ok(d.calls.some((c) => c[0].endsWith('activateSettings')));
  await globe.restore(null, { exec: d.exec });
  assert.equal(d.value, null);
  const d2 = fakeDefaults(1);
  await globe.fix({ exec: d2.exec });
  await globe.restore(1, { exec: d2.exec });
  assert.equal(d2.value, 1);
  assert.equal((await globe.status({ platform: 'win32' })).supported, false);
});
