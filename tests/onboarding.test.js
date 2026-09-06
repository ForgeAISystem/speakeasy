'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { MODELS, HOLD_KEYS, DEFAULT_SETTINGS } = require('../src/shared/constants');

function fixture(t, overrides = {}) {
  const dom = new JSDOM('<div id="layout"></div><div id="onboard"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../src/app/onboarding.js'), 'utf8'));
  let state = {
    settings: { ...DEFAULT_SETTINGS, holdKey: 'Fn' },
    models: { installed: [], downloads: {}, catalog: MODELS },
    permissions: { mic: 'not-determined', accessibility: false },
    engine: { state: 'off' }, shortcut: { ready: false }, holdKeys: HOLD_KEYS,
    platform: 'darwin', installation: { needsMove: false }, ...overrides
  };
  const calls = [];
  const api = {
    getState: async () => structuredClone(state),
    setupMode: async (mode) => calls.push(['mode', mode]),
    updateSettings: async (partial) => {
      Object.assign(state.settings, partial);
      if (partial.model) state.engine.state = 'ready';
      return structuredClone(state);
    },
    downloadModel: async (id) => { calls.push(['download', id]); state.models.installed.push(id); return { ok: true }; },
    retryEngine: async () => structuredClone(state),
    retryShortcut: async () => structuredClone(state),
    completeSetup: async () => { calls.push(['complete']); return { ok: true }; },
    requestMic: async () => { state.permissions.mic = 'granted'; },
    requestAccessibility: async () => {},
    openPermSettings: async (pane) => { calls.push(['settings', pane]); },
    installApp: async () => { calls.push(['install']); state.installation.needsMove = false; return { ok: true }; }
  };
  const setup = new dom.window.SpeakEasySetup({ api, state: () => state, update: (next) => { state = next; }, finish: () => calls.push(['finish']) });
  t.after(() => { setup.close(); dom.window.close(); });
  return { dom, setup, calls, api, state: () => state, button: (action) => dom.window.document.querySelector(`[data-setup="${action}"]`) };
}

test('first launch offers one install action only when outside Applications', async (t) => {
  const f = fixture(t, { installation: { needsMove: true } });
  await f.setup.open();
  assert.ok(f.button('install'));
  assert.equal(f.button('start'), null);
  await f.setup.act('install');
  assert.ok(f.button('start'));
  assert.equal(f.dom.window.document.getElementById('layout').inert, true);
});

test('permissions cannot be skipped, and a denied mic opens the right settings', async (t) => {
  const f = fixture(t);
  await f.setup.open();
  await f.setup.act('start');
  assert.equal(f.button('permissions-next').disabled, true);
  await f.setup.act('permissions-next');
  assert.equal(f.setup.step, 1);
  f.state().permissions.mic = 'denied';
  await f.setup.act('mic');
  assert.deepEqual(f.calls.at(-1), ['settings', 'microphone']);
  f.state().permissions = { mic: 'granted', accessibility: true };
  await f.setup.act('permissions-next');
  assert.equal(f.setup.step, 2);
});

test('failed voice downloads stay recoverable and do not advance', async (t) => {
  const f = fixture(t);
  await f.setup.open();
  await f.setup.go(2);
  f.api.downloadModel = async () => ({ ok: false, error: 'Network unavailable' });
  await f.setup.act('download');
  assert.match(f.setup.error, /connection/);
  assert.equal(f.setup.step, 2);
  assert.equal(f.button('download').disabled, false);
  assert.equal(f.button('voice-next'), null);
});

test('downloaded voice must load before continuing and existing voices are reused', async (t) => {
  const f = fixture(t);
  f.state().models.installed.push('moonshine-base');
  await f.setup.open();
  await f.setup.go(2);
  await f.setup.act('download');
  assert.equal(f.calls.filter((c) => c[0] === 'download').length, 0);
  assert.ok(f.button('voice-next'));
  f.state().engine.state = 'error';
  await f.setup.act('voice-next');
  assert.equal(f.setup.step, 2);
});

test('the selected shortcut must actually report a release before proceeding', async (t) => {
  const f = fixture(t, { shortcut: { ready: true } });
  await f.setup.open();
  await f.setup.go(3);
  assert.equal(f.button('key-next').disabled, true);
  f.setup.push({ type: 'shortcut-key', key: 'AltRight', down: false });
  assert.equal(f.setup.keySeen, false);
  f.setup.push({ type: 'shortcut-key', key: 'Fn', down: true });
  assert.equal(f.setup.keySeen, false);
  f.setup.push({ type: 'shortcut-key', key: 'Fn', down: false });
  assert.equal(f.button('key-next').disabled, false);
  await f.setup.act('key-next');
  assert.equal(f.setup.step, 4);
});

test('typing into practice cannot fake a successful dictation', async (t) => {
  const f = fixture(t);
  await f.setup.open();
  await f.setup.go(4);
  f.dom.window.document.getElementById('setup-test').value = 'Typed manually';
  await f.setup.act('finish');
  assert.equal(f.calls.some((c) => c[0] === 'complete'), false);
  assert.equal(f.button('finish').disabled, true);
});

test('successful recognition with failed paste does not complete setup', async (t) => {
  const f = fixture(t);
  await f.setup.open();
  await f.setup.go(4);
  f.setup.push({ type: 'dictation', phase: 'done', text: 'Hello there.', pasted: false });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(f.setup.testPassed, false);
  assert.match(f.setup.error, /did not land/);
});

test('actual recognized text pasted in practice unlocks completion', async (t) => {
  const f = fixture(t);
  await f.setup.open();
  await f.setup.go(4);
  f.dom.window.document.getElementById('setup-test').value = 'I have a good feeling about this.';
  f.setup.push({ type: 'dictation', phase: 'done', text: 'I have a good feeling about this.', pasted: true });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(f.button('finish').disabled, false);
  await f.setup.act('finish');
  assert.equal(f.setup.visible, false);
  assert.equal(f.dom.window.document.getElementById('layout').inert, false);
});

test('Windows setup offers supported keys instead of Fn', async (t) => {
  const f = fixture(t, { platform: 'win32', settings: { ...DEFAULT_SETTINGS, holdKey: 'CtrlRight' } });
  await f.setup.open();
  await f.setup.go(3);
  assert.equal(f.dom.window.document.querySelector('[data-key="Fn"]'), null);
  assert.ok(f.dom.window.document.querySelector('[data-key="CtrlRight"]'));
});

test('hidden onboarding stops polling state and refreshes on return', async (t) => {
  const f = fixture(t);
  let reads = 0;
  f.api.getState = async () => { reads++; return structuredClone(f.state()); };
  await f.setup.open();
  Object.defineProperty(f.dom.window.document, 'hidden', { configurable: true, value: true });
  await f.setup.refresh();
  assert.equal(reads, 0);
  Object.defineProperty(f.dom.window.document, 'hidden', { configurable: true, value: false });
  f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 1);
  f.setup.close();
  await f.setup.refresh();
  assert.equal(reads, 1);
});
