'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restoreBounds } = require('../src/main/window-bounds');
const primary = { workArea: { x: 0, y: 25, width: 1440, height: 875 } };
const left = { workArea: { x: -1920, y: -120, width: 1920, height: 1080 } };

test('retains a compact window on a display left of the primary screen', () => {
  const saved = { x: -1200, y: -80, width: 600, height: 500 };
  assert.deepEqual(restoreBounds(saved, [primary, left], primary), saved);
});

test('a disconnected monitor returns the window to the available work area', () => {
  assert.deepEqual(restoreBounds({ x: -1200, y: -80, width: 600, height: 500 }, [primary], primary),
    { x: 420, y: 213, width: 600, height: 500 });
});

test('a moved or resized display keeps the title bar and edges reachable', () => {
  assert.deepEqual(restoreBounds({ x: 1300, y: -90, width: 900, height: 1200 }, [primary], primary),
    { x: 540, y: 25, width: 900, height: 875 });
});

test('invalid saved placement uses a centered default, while tiny sizes respect minimums', () => {
  for (const saved of [undefined, {}, { x: NaN, y: 0, width: 600, height: 500 }, { x: 0, y: 0, width: -5, height: 0 }]) {
    assert.deepEqual(restoreBounds(saved, [primary], primary), { x: 230, y: 123, width: 980, height: 680 });
  }
  assert.deepEqual(restoreBounds({ x: 100, y: 100, width: 200, height: 200 }, [primary], primary),
    { x: 100, y: 100, width: 560, height: 480 });
});
