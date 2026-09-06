'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function fixture(t, reduced = false) {
  const dir = path.join(__dirname, '../src/overlay');
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'overlay.html'), 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const frames = new Map(), timers = new Map();
  let seq = 0, onState, onArmed, onChange;
  dom.window.requestAnimationFrame = (fn) => { frames.set(++seq, fn); return seq; };
  dom.window.cancelAnimationFrame = (id) => frames.delete(id);
  dom.window.setInterval = (fn) => { timers.set(++seq, fn); return seq; };
  dom.window.clearInterval = (id) => timers.delete(id);
  const preference = { matches: reduced, addEventListener: (_, fn) => { onChange = fn; } };
  dom.window.matchMedia = () => preference;
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop() {} }), clearRect() {}, beginPath() {}, roundRect() {}, fill() {} });
  dom.window.overlayBridge = { onState: (fn) => { onState = fn; }, onArmed: (fn) => { onArmed = fn; }, onLevel() {} };
  dom.window.eval(fs.readFileSync(path.join(dir, 'overlay.js'), 'utf8'));
  return { frames, timers, state: (state, extra = {}) => onState({ state, sounds: false, ...extra }),
    arm: () => onArmed({ sounds: false }), text: () => dom.window.document.getElementById('label').textContent,
    reduce: () => { preference.matches = true; onChange(); } };
}

test('overlay has no idle animation and starts only after the microphone is armed', (t) => {
  const f = fixture(t);
  assert.equal(f.frames.size, 0);
  f.state('listening');
  assert.equal(f.frames.size, 0);
  assert.equal(f.text(), 'Opening microphone');
  f.arm();
  assert.equal(f.frames.size, 1);
  assert.equal(f.timers.size, 1);
  f.state('hidden');
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
});

test('reduced motion cancels waveform animation but keeps the recording clock', (t) => {
  const f = fixture(t);
  f.state('listening');
  f.arm();
  f.reduce();
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 1);
  f.state('processing');
  assert.equal(f.timers.size, 0);
  assert.equal(f.text(), 'Transcribing');
});

test('the in-app motion preference suppresses waveform animation too', (t) => {
  const f = fixture(t);
  f.state('listening', { subtleMotion: false });
  f.arm();
  assert.equal(f.frames.size, 0);
  assert.equal(f.text(), 'Listening');
});
