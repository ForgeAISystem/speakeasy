'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(overrides = {}) {
  const ipc = new Map(), handlers = new Map(), windows = [], timers = new Map(), sends = [], history = [];
  let now = 10000, timerId = 0;
  class Window extends EventEmitter {
    constructor() {
      super(); windows.push(this); this.visible = false; this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.send = (channel, ...args) => sends.push([channel, ...args]);
    }
    loadFile() { return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    isVisible() { return this.visible; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    getSize() { return [340, 110]; }
    setPosition() {} setIgnoreMouseEvents() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {}
  }
  const cfg = { holdKey: 'Fn', model: 'moonshine-base', sounds: false };
  const modules = {
    electron: { app: { requestSingleInstanceLock: () => true, on() {}, whenReady: () => new Promise(() => {}) },
      BrowserWindow: Window,
      ipcMain: { on: (name, fn) => ipc.set(name, fn), handle: (name, fn) => handlers.set(name, fn) },
      screen: { getAllDisplays: () => [{ internal: true }], getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }) },
      systemPreferences: { getMediaAccessStatus: () => 'granted', isTrustedAccessibilityClient: () => true } },
    './store': { settings: () => cfg, addHistory: (row) => history.push(row) },
    './window-bounds': require('../src/main/window-bounds'), './cleanup': {},
    './injector': { getFrontContext: async () => ({ app: '', title: '' }) }, './hotkey': {}, './models': {}, './tray': {},
    './audio-store': { saveRecording: () => 'fixture.wav' },
    './transcriber': { TranscriberManager: class {} },
    './system-audio': { setDictationMute() {}, restoreNow() {} }, './control-pad': { ControlPad: class {} }, './globe-key': {}, './commands': { wakeCommand: () => null }, './guide': { GuideRunner: class {}, toGuideEvent: () => null }, '../shared/guides': require('../src/shared/guides'), './pad-coach': require('../src/main/pad-coach'), '../shared/pad': require('../src/shared/pad'), './wispr-import': { readWispr: async () => ({ available: false, words: [], snippets: [] }) },
    '../shared/quiet-point': require('../src/shared/quiet-point'), '../shared/mic': require('../src/shared/mic'),
    './terminal': require('../src/main/terminal'), './rewrite': require('../src/main/rewrite'), './history-search': require('../src/main/history-search'),
    '../shared/constants': require('../src/shared/constants'), '../shared/writing': require('../src/shared/writing'),
    ...overrides
  };
  const context = vm.createContext({
    require: (id) => modules[id] || require(id), __dirname: path.join(__dirname, '../src/main'),
    process: { platform: 'darwin', env: {}, on() {} }, console, Float32Array,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: (id) => timers.delete(id), setInterval: () => ++timerId, clearInterval() {}
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, '../src/main/index.js'), 'utf8'));
  run("hotkeys = { running: true, reset() {}, stop() {} }; tray = { setState() {} }; engineState = 'ready';");
  const tick = (ms) => {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  };
  const createOverlay = () => { run('createOverlayWindow()'); const win = windows.at(-1); win.webContents.emit('did-finish-load'); return win; };
  return { run, tick, windows, sends, ipc, handlers, history, createOverlay };
}

test('a previous completion fade cannot hide the next recording indicator', () => {
  const f = fixture(), win = f.createOverlay();
  f.run("overlayState('done', { words: 3 })");
  f.tick(1350); // the old completion has started its 250 ms fade
  f.run("overlayState('listening')");
  f.tick(250);
  assert.equal(win.visible, true);
  assert.equal(f.sends.filter(([channel]) => channel === 'overlay:state').at(-1)[1].state, 'listening');
});

test('a recording started before overlay load is replayed when the renderer is ready', () => {
  const f = fixture();
  f.run("createOverlayWindow(); overlayState('listening')");
  f.sends.length = 0;
  f.windows[0].webContents.emit('did-finish-load');
  assert.equal(f.sends.at(-1)?.[1].state, 'listening');
  assert.equal(f.windows[0].visible, true);
});

test('an overlay renderer crash restores the current listening state without restarting the mic', () => {
  const f = fixture(), win = f.createOverlay();
  f.run("overlayState('listening'); dictState = 'recording'");
  win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  f.tick(600);
  const replacement = f.windows.at(-1);
  replacement.webContents.emit('did-finish-load');
  assert.notEqual(replacement, win);
  assert.equal(replacement.visible, true);
  assert.equal(f.run('dictState'), 'recording');
});

test('an old microphone failure cannot cancel a newer recording', () => {
  const f = fixture();
  f.createOverlay();
  f.run("createCaptureWindow(); captureSession = 4; dictState = 'recording'");
  f.ipc.get('capture:error')({}, 3, 'old permission failure');
  assert.equal(f.run('dictState'), 'recording');
});

test('microphone startup has a deadline and a subsequent press can record', () => {
  const f = fixture(); f.createOverlay();
  f.run('createCaptureWindow()'); f.windows.at(-1).webContents.emit('did-finish-load');
  f.run('onDictateStart()');
  assert.equal(f.run('dictState'), 'recording');
  f.tick(10001);
  assert.equal(f.run('dictState'), 'idle');
  assert.equal(f.run('overlayPayload.message'), 'Microphone stopped responding');
  f.run('onDictateStart()');
  assert.equal(f.run('dictState'), 'recording');
});

test('a microphone renderer crash retains received audio in retryable history', () => {
  const f = fixture(); f.createOverlay();
  f.run('createCaptureWindow()'); const mic = f.windows.at(-1); mic.webContents.emit('did-finish-load');
  f.run('onDictateStart()');
  f.ipc.get('capture:chunk')({}, f.run('captureSession'), new Float32Array(16000), 0.1);
  mic.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(f.run('dictState'), 'idle');
  assert.equal(f.history.length, 1);
  assert.equal(f.history[0].failed, true);
  assert.equal(f.history[0].audioFile, 'fixture.wav');
  f.tick(500);
  assert.notEqual(f.windows.at(-1), mic);
});

test('cancellation and stop disarm the microphone watchdog', async () => {
  const f = fixture(); f.createOverlay();
  f.run('createCaptureWindow()'); f.windows.at(-1).webContents.emit('did-finish-load');
  f.run('onDictateStart(); onDictateCancel()');
  f.tick(12000);
  assert.equal(f.run('dictState'), 'idle');
  assert.equal(f.history.length, 0);
  assert.equal(f.run('overlayPayload.state'), 'hidden');
});

test('recovered overlay keeps the real microphone start time and does not replay the sound', () => {
  const f = fixture(), win = f.createOverlay();
  f.run("overlayState('listening'); dictState = 'recording'; captureSession = 9");
  f.ipc.get('capture:armed')({}, 9);
  const started = f.run('overlayPayload.startedAt');
  f.tick(2000);
  win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  f.tick(500); f.windows.at(-1).webContents.emit('did-finish-load');
  const payload = f.sends.filter(([name]) => name === 'overlay:state').at(-1)[1];
  assert.equal(payload.startedAt, started);
  assert.equal(payload.armed, true);
  assert.equal(payload.sounds, false);
});

test('repeated renderer crashes stop after three recovery attempts instead of looping forever', () => {
  const f = fixture(); let win = f.createOverlay();
  for (let i = 0; i < 4; i++) {
    win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    f.tick(2000);
    const next = f.windows.at(-1);
    if (next !== win) next.webContents.emit('did-finish-load');
    win = next;
  }
  assert.equal(f.windows.length, 4);
  assert.equal(f.run('overlayReady'), false);
});

test('preview and repair never interrupt an active dictation', async () => {
  const f = fixture();
  f.run("dictState = 'recording'");
  assert.equal(f.handlers.get('runtime:test-overlay')().ok, false);
  assert.equal((await f.handlers.get('runtime:repair')()).ok, false);
  assert.equal(f.run('dictState'), 'recording');
});

test('long dictations are transcribed in quiet-point segments while recording', async () => {
  const f = fixture();
  const sent = [];
  f.run('transcriber.transcribe = (pcm) => { globalThis.__sent.push(pcm.length); return Promise.resolve({ text: "part" + globalThis.__sent.length, lang: "", ms: 5 }); }');
  f.run('globalThis.__sent = []');
  f.run("dictState = 'recording'; captureSession = 7; resetLive();");
  const chunk = f.ipc.get('capture:chunk');
  const second = 16000;
  for (let i = 0; i < 290; i++) {
    const pcm = new Float32Array(1600).fill(i >= 240 && i < 242 ? 0 : 0.2); // quiet at 24.0-24.2 s
    chunk(null, 7, pcm, 0.1);
  }
  const lengths = f.run('globalThis.__sent');
  assert.equal(lengths.length, 1);
  assert.ok(lengths[0] >= 20 * second && lengths[0] <= 28 * second);
  assert.ok(Math.abs(lengths[0] - 24.1 * second) < 0.2 * second, `cut at ${lengths[0] / second}s`);
  const result = await f.run('transcribeDictation(takeAudio())');
  assert.equal(result.text, 'part1 part2');
  assert.equal(result.liveParts, 1);
  assert.equal(f.run('globalThis.__sent')[1], 29 * second - lengths[0]);
});

test('cancelling a dictation drops segments decoded during recording', () => {
  const f = fixture();
  f.run('transcriber.transcribe = () => Promise.resolve({ text: "stale", ms: 1 }); captureWindow = null;');
  f.run("dictState = 'recording'; captureSession = 3; resetLive();");
  const chunk = f.ipc.get('capture:chunk');
  for (let i = 0; i < 290; i++) chunk(null, 3, new Float32Array(1600).fill(0.2), 0.1);
  assert.equal(f.run('liveParts.length'), 1);
  f.run('onDictateCancel()');
  assert.equal(f.run('liveParts.length'), 0);
  assert.equal(f.run('liveOffset'), 0);
});

// ---- Edit by voice (v2.9): terminal mode, rewrite, undo, history search ----

function editFixture({ front = { app: 'Notes', title: '' }, selection = 'One. Two. Three. Four. Five. Six.', settings = {}, history = [], clean } = {}) {
  const calls = { inject: [], undo: [], copies: 0, results: null, closed: 0 };
  const rows = [...history];
  const real = require('../src/main/rewrite');
  const cfg = { holdKey: 'Fn', model: 'moonshine-base', sounds: false, restoreClipboard: true, ...settings };
  const f = fixture({
    './store': { settings: () => cfg, addHistory: (row) => rows.unshift(row), recordTranscription() {},
      history: () => ({ data: rows, save() {} }) },
    './injector': {
      getFrontContext: async () => front,
      injectText: async (text, opts) => { calls.inject.push({ text, ...opts }); return true; },
      copySelection: async () => { calls.copies++; return selection; },
      undoPaste: async (opts) => { calls.undo.push(opts); return true; }
    },
    './rewrite': { ...real, run: (sel, t, c) => real.run(sel, t, c, { ollama: async () => 'One to six.', anthropic: async () => 'Claude short.' }) },
    './cleanup': { cleanup: clean || (async (raw) => ({ text: raw.replace(/^um,?\s*/i, '').replace(/^./, (c) => c.toUpperCase()), cleanupMode: 'clean' })) }
  });
  f.run('hotkeys.shiftReleased = async () => {}; hotkeys.withShift = false; hotkeys.lastHandsFree = false;');
  f.run('audioStore.removeRecording = () => {}');
  f.run('controlPad = { isOpen: () => false, close() { globalThis.__closed = (globalThis.__closed || 0) + 1; }, showResults: async (r) => { globalThis.__results = r; return { ok: true }; }, pads: () => ({}), captureTarget() {} }');
  return { ...f, calls, rows, cfg };
}

test('terminal mode: straight quotes, no final period, and new lines are Shift+Return pastes', async () => {
  const f = editFixture({ front: { app: 'iTerm2', title: '✳ Fix the build' }, clean: async () => ({ text: 'Run “npm test”\nthen commit.', cleanupMode: 'clean' }) });
  f.createOverlay();
  f.run("transcribeDictation = async () => ({ text: 'um, run “npm test” new line then commit.', lang: '', ms: 3 }); collectAudio = async () => new Float32Array(16000); frontContextPromise = Promise.resolve({ app: 'iTerm2', title: '' }); dictState = 'recording'");
  await f.run('onDictateStop()');
  assert.deepEqual(f.calls.inject.map(({ text, terminal }) => ({ text, terminal })), [{ text: 'Run "npm test"\nthen commit', terminal: true }]);
  assert.equal(f.rows[0].terminal, true);
  await f.run('undoLastEdit()');
  assert.deepEqual({ ...f.calls.undo[0] }, { terminal: true, pasted: 'Run "npm test"\nthen commit', restore: 'um, run “npm test” new line then commit.', restoreClipboard: true });
  assert.equal(f.rows[0].undone, true);
});

test('terminal mode stays off outside terminals and when switched off', async () => {
  for (const [front, settings] of [[{ app: 'Notes', title: '' }, {}], [{ app: 'Terminal', title: '' }, { terminalMode: false }]]) {
    const f = editFixture({ front, settings });
    f.createOverlay();
    f.run(`transcribeDictation = async () => ({ text: 'ship it.', ms: 1 }); collectAudio = async () => new Float32Array(16000); frontContextPromise = Promise.resolve(${JSON.stringify(front)}); dictState = 'recording'`);
    await f.run('onDictateStop()');
    assert.equal(f.calls.inject[0].text, 'Ship it.');
    assert.equal(f.calls.inject[0].terminal, false);
  }
});

test('fn+Shift rewrites the selection: copy, transform, show, paste over, record in History', async () => {
  const f = editFixture();
  const overlay = f.createOverlay();
  f.run("hotkeys.withShift = true; transcribeDictation = async () => ({ text: 'make this shorter', ms: 2 }); collectAudio = async () => new Float32Array(16000); frontContextPromise = Promise.resolve({ app: 'Notes', title: '' }); dictState = 'recording'");
  await f.run('onDictateStop()');
  assert.equal(f.calls.copies, 1);
  assert.deepEqual(f.calls.inject.map(({ text, terminal }) => ({ text, terminal })), [{ text: 'One to six.', terminal: false }]);
  assert.equal(f.rows[0].transform, 'Shorter');
  assert.equal(f.rows[0].raw, 'One. Two. Three. Four. Five. Six.');
  const shown = f.sends.filter(([c]) => c === 'overlay:state').at(-1)[1];
  assert.equal(shown.state, 'rewrite');
  assert.equal(shown.before, 6);
  assert.equal(shown.after, 3);
  assert.ok(overlay.visible);
  assert.equal(f.run('dictState'), 'idle');
  await f.run('undoLastEdit()');
  assert.deepEqual({ ...f.calls.undo[0] }, { terminal: false, pasted: 'One to six.', restore: '', restoreClipboard: true });
});

test('a rewrite uses Claude when a key is set, and says so when nothing is selected', async () => {
  const f = editFixture({ settings: { polishAnthropicKey: 'sk-test' } });
  f.createOverlay();
  await f.run("runRewrite('Hey computer polish this', 'voice')");
  assert.equal(f.calls.inject[0].text, 'Claude short.');
  assert.equal(f.rows[0].rewriteVia, 'anthropic');
  const empty = editFixture({ selection: '' });
  empty.createOverlay();
  await empty.run("runRewrite('make this shorter', 'shift')");
  assert.equal(empty.calls.inject.length, 0);
  assert.equal(empty.run('overlayPayload.message'), 'Select some text first');
});

test('"Hey computer, make this shorter" rewrites; window commands still plan', async () => {
  const f = editFixture();
  f.createOverlay();
  f.run('globalThis.__planned = 0; commands.plan = async () => { globalThis.__planned++; return { steps: [] }; }; commands.describe = () => ""; commands.needsConfirm = () => false; commands.installedApps = () => []; controlPad.showPlan = async () => ({}); controlPad.isOpen = () => true; controlPad.target = null');
  await f.run("runVoiceCommand('make this shorter', true)");
  assert.equal(f.calls.copies, 1);
  await f.run("runVoiceCommand('make this full screen', true)");
  assert.equal(f.run('globalThis.__planned'), 1);
});

test('undo refuses when nothing changed, in another app, or with nothing pasted yet', async () => {
  const f = editFixture();
  f.createOverlay();
  await f.run('undoLastEdit()');
  assert.equal(f.run('overlayPayload.message'), 'Nothing to undo yet');
  f.run("lastEdit = { kind: 'dictation', app: 'Notes', changed: false, at: Date.now() }");
  await f.run('undoLastEdit()');
  assert.match(f.run('overlayPayload.message'), /word for word/);
  f.run("lastEdit = { kind: 'dictation', app: 'Slack', changed: true, pasted: 'Hi.', restore: 'hi', at: Date.now() }");
  await f.run('undoLastEdit()');
  assert.equal(f.run('overlayPayload.message'), 'Go back to Slack to undo');
  assert.equal(f.calls.undo.length, 0);
});

test('"what did I say about" searches History locally and shows matches on the pad', async () => {
  const history = [
    { id: 'a', ts: 3, text: 'Lunch with Sam on Friday.', app: 'Notes' },
    { id: 'b', ts: 2, text: 'The Legacy invoice for October is still open.', app: 'Slack' },
    { id: 'c', ts: 1, text: 'Send Legacy their invoices before the call.', app: 'Mail' },
    { id: 'd', ts: 4, text: 'Legacy invoices shortened.', transform: 'Shorter' }
  ];
  const f = editFixture({ history });
  f.createOverlay();
  await f.run("runVoiceCommand('what did I say about the Legacy invoices?', true)");
  const shown = f.run('globalThis.__results');
  assert.equal(shown.query, 'the Legacy invoices');
  assert.deepEqual(shown.items.map((i) => i.id), ['b', 'c']);
  assert.equal(shown.wake, true);
});
