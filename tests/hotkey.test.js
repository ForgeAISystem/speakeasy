'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HotkeyManager } = require('../src/main/hotkey');

function fixture(t) {
  const calls = [];
  const h = new HotkeyManager({ onStart: () => calls.push('start'), onStop: () => calls.push('stop'), onCancel: () => calls.push('cancel') });
  h.setKey('Fn');
  t.after(() => h.reset());
  return { h, calls, key: { keycode: -1 } };
}

test('Fn hold release records exactly once and ignores key repeat', (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key); h._down(key);
  h.pressedAt -= 500;
  h._up(key); h._up(key);
  assert.deepEqual(calls, ['start', 'stop']);
});

test('Fn double tap enters hands-free and the next tap stops', (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key); h._up(key); h._down(key); h._up(key);
  assert.equal(h.handsFree, true);
  h._down(key); h._up(key);
  assert.deepEqual(calls, ['start', 'stop']);
});

test('switching shortcuts cancels a held recording and ignores the old release', (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key);
  h.setKey('AltRight');
  h._up(key);
  assert.deepEqual(calls, ['start', 'cancel']);
  assert.equal(h.keyIsDown, false);
});

test('reset after suspend or error accepts the next press', (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key); h.reset(); h._down(key);
  assert.deepEqual(calls, ['start', 'start']);
});

test('a single tap cancels after the double-tap window', async (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key); h._up(key);
  await new Promise((resolve) => setTimeout(resolve, 950));
  assert.deepEqual(calls, ['start', 'cancel']);
});

test('a disabled native tap clears a held key even when its release was lost', (t) => {
  const { h, calls, key } = fixture(t);
  h._down(key);
  h._listenerReset();
  h._down(key);
  h.pressedAt -= 500;
  h._up(key);
  assert.deepEqual(calls, ['start', 'cancel', 'start', 'stop']);
});
