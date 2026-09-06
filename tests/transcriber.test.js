'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(t) {
  const children = [], timers = new Map(), states = [];
  let seq = 0;
  const fork = () => {
    const child = new EventEmitter();
    child.stdout = child.stderr = null;
    child.sent = [];
    child.send = (message, cb) => { child.sent.push(message); cb?.(); };
    child.kill = () => { child.killed = true; };
    children.push(child);
    return child;
  };
  const exported = {};
  const modules = { child_process: { fork }, './models': { modelDir: () => '/fixture/model' },
    '../shared/constants': require('../src/shared/constants') };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/transcriber.js'), 'utf8'), {
    require: (id) => modules[id] || require(id), module: exported, __dirname: path.join(__dirname, '../src/main'),
    process, console: { log() {}, error() {} },
    setTimeout: (fn, ms) => { timers.set(++seq, { fn, ms }); return seq; }, clearTimeout: (id) => timers.delete(id)
  });
  const manager = new exported.exports.TranscriberManager();
  manager.onStateChange = (state) => states.push(state);
  t.after(() => manager.dispose());
  return { manager, children, timers, states };
}

test('a stalled model load times out, cleans its worker, and can be retried', async (t) => {
  const f = fixture(t);
  const load = f.manager.load('moonshine-base', 'en');
  const rejected = assert.rejects(load, /timed out/);
  [...f.timers.values()][0].fn();
  await rejected;
  assert.equal(f.children[0].killed, true);
  assert.equal(f.manager.loadWaiters.size, 0);
  const retry = f.manager.load('moonshine-base', 'en');
  f.children[1].emit('message', { type: 'ready', loadId: f.manager.loadSeq });
  await retry;
  assert.equal(f.manager.ready, true);
});

test('an old worker exit cannot mark its replacement as crashed', async (t) => {
  const f = fixture(t);
  const first = f.manager.load('moonshine-base', 'en');
  const old = f.children[0]; old.emit('message', { type: 'ready', loadId: 1 }); await first;
  f.manager.dispose();
  const second = f.manager.load('moonshine-base', 'en');
  const current = f.children[1]; current.emit('message', { type: 'ready', loadId: 2 }); await second;
  old.emit('exit', 0);
  old.emit('message', { type: 'error', message: 'stale error' });
  assert.equal(f.manager.proc, current);
  assert.equal(f.manager.ready, true);
  assert.equal(f.states.at(-1), 'ready');
});

test('worker channel failure rejects pending transcription immediately and clears its timer', async (t) => {
  const f = fixture(t);
  const load = f.manager.load('moonshine-base', 'en');
  f.children[0].emit('message', { type: 'ready', loadId: 1 }); await load;
  f.children[0].send = (_message, callback) => callback(new Error('IPC disconnected'));
  await assert.rejects(f.manager.transcribe(new Float32Array(16000)), /IPC disconnected/);
  assert.equal(f.manager.pending.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.manager.ready, false);
});
