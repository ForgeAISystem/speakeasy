'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/capture/capture.js'), 'utf8');

function fixture(getUserMedia) {
  const events = [];
  const handlers = {};
  const bridge = {
    onStart: (cb) => { handlers.start = cb; }, onStop: (cb) => { handlers.stop = cb; },
    onListMics: () => {}, onGenIcons: () => {},
    sendError: (id, e) => events.push(['error', id, e]), sendStopped: (id) => events.push(['stopped', id]),
    sendArmed: (id) => events.push(['armed', id]), sendChunk: () => {}
  };
  class FakeContext {
    audioWorklet = { addModule: async () => {} };
    createMediaStreamSource() { return { connect() {} }; }
    async close() { events.push(['closed']); }
  }
  class FakeNode {
    constructor() {
      this.port = { onmessage: null, postMessage: () => queueMicrotask(() => this.port.onmessage?.({ data: { type: 'flushed' } })) };
    }
    disconnect() {}
  }
  vm.runInNewContext(source, {
    navigator: { mediaDevices: { getUserMedia } }, window: { captureBridge: bridge },
    AudioContext: FakeContext, AudioWorkletNode: FakeNode, Blob, URL, Float32Array,
    setTimeout, clearTimeout, console
  });
  return { handlers, events };
}

test('cancel while the microphone is opening stops late-arriving tracks', async () => {
  let resolveMic;
  let stopped = false;
  const f = fixture(() => new Promise((resolve) => { resolveMic = resolve; }));
  const opening = f.handlers.start({ session: 1 });
  await Promise.resolve();
  await f.handlers.stop();
  resolveMic({ getTracks: () => [{ stop: () => { stopped = true; } }] });
  await opening;
  assert.equal(stopped, true);
  assert.equal(f.events.some(([event]) => event === 'armed'), false);
});

test('normal stop releases the mic and closes audio after flushing', async () => {
  let stopped = false;
  const f = fixture(async () => ({ getTracks: () => [{ stop: () => { stopped = true; } }] }));
  await f.handlers.start({ session: 7 });
  await f.handlers.stop();
  assert.equal(stopped, true);
  assert.deepEqual(f.events, [['armed', 7], ['closed'], ['stopped', 7]]);
});

test('permission failure surfaces a recoverable error instead of arming', async () => {
  const f = fixture(async () => { throw new Error('Permission denied'); });
  await f.handlers.start({ session: 1 });
  assert.deepEqual(f.events, [['error', 1, 'Permission denied']]);
});

test('worklet flush preserves the last partial audio chunk', () => {
  let Processor;
  const messages = [];
  const raw = source.match(/const WORKLET_SOURCE = `([\s\S]*?)`;/)[1];
  class AudioWorkletProcessor { constructor() { this.port = { postMessage: (data) => messages.push(data) }; } }
  vm.runInNewContext(raw, { AudioWorkletProcessor, Float32Array, registerProcessor: (_name, cls) => { Processor = cls; } });
  const p = new Processor();
  p.process([[new Float32Array(128).fill(.5)]]);
  assert.equal(messages.length, 0);
  p.port.onmessage({ data: 'flush' });
  assert.equal(messages[0].length, 128);
  assert.equal(messages[0][0], .5);
  assert.equal(messages[1].type, 'flushed');
});
