'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(t) {
  const children = [], intervals = new Map(), states = [];
  let now = 10000, seq = 0;
  const hook = new EventEmitter(); hook.stop = () => {};
  const modules = { 'uiohook-napi': { uIOhook: hook, UiohookKey: {} }, electron: { app: { isPackaged: true } },
    child_process: { spawn: () => {
      const c = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
      c.kill = () => { c.killed = true; }; children.push(c); return c;
    } } };
  const exported = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/hotkey.js'), 'utf8'), {
    require: (id) => modules[id] || require(id), module: exported, __dirname,
    process: { platform: 'darwin', resourcesPath: '/fixture' }, console,
    Date: class extends Date { static now() { return now; } }, setTimeout, clearTimeout,
    setInterval: (fn) => { intervals.set(++seq, fn); return seq; }, clearInterval: (id) => intervals.delete(id)
  });
  const h = new exported.exports.HotkeyManager({ onStatus: (status) => states.push(status) });
  t.after(() => h.stop());
  const emit = (child, event) => child.stdout.emit('data', Buffer.from(JSON.stringify({ event }) + '\n'));
  return { h, children, intervals, states, emit, tick: (ms) => { now += ms; for (const fn of [...intervals.values()]) fn(); } };
}

test('an alive but wedged Fn listener becomes unavailable and stops instead of reporting ready forever', async (t) => {
  const f = fixture(t), starting = f.h.start('Fn');
  f.emit(f.children[0], 'ready'); await starting;
  f.tick(12000);
  assert.equal(f.h.running, false);
  assert.equal(f.children[0].killed, true);
  assert.equal(f.intervals.size, 0);
  assert.match(f.states.at(-1).error, /stopped responding/);
});

test('regular native heartbeats preserve readiness and stale child exits cannot stop a replacement', async (t) => {
  const f = fixture(t);
  const first = f.h.start('Fn'); f.emit(f.children[0], 'ready'); await first;
  for (let i = 0; i < 10; i++) { f.tick(2000); f.emit(f.children[0], 'heartbeat'); }
  assert.equal(f.h.running, true);
  f.h.stop();
  const second = f.h.start('Fn'); f.emit(f.children[1], 'ready'); await second;
  f.children[0].emit('exit', 0);
  assert.equal(f.h.running, true);
  assert.equal(f.h.helper, f.children[1]);
  assert.equal(f.intervals.size, 1);
});
