'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ControlPad } = require('../src/main/control-pad');

// A stand-in for native/window.c: logs each call and answers like the real helper.
function fakeHelper(t, front) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'calls.log');
  const helper = path.join(dir, 'helper');
  const list = JSON.stringify({ ok: true, windows: [
    { pid: process.pid, app: 'SpeakEasy', exec: '/self', x: 0, y: 0, w: 500, h: 500 },
    { pid: 4242, app: 'Notes', exec: process.execPath, x: 10, y: 40, w: 700, h: 600 }] });
  fs.writeFileSync(helper, `#!/bin/sh\necho "$@" >> '${log}'\ncase "$1" in\n front) echo '${JSON.stringify(front)}';;\n list) echo '${list}';;\n move) echo "{\\"ok\\":true,\\"x\\":$3,\\"y\\":$4,\\"w\\":$5,\\"h\\":$6}";;\nesac\n`, { mode: 0o755 });
  return { helper, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []) };
}

function fixture(t, front = { ok: true, pid: 777, app: 'Google Chrome', x: 100, y: 100, w: 800, h: 600 }) {
  const h = fakeHelper(t, front);
  let saved = {};
  const events = [];
  const display = (id, x) => ({ id, workArea: { x, y: 25, width: 1728, height: 1092 } });
  const displays = [display(1, 0), display(2, 1728)];
  const shown = [];
  const pasted = [];
  const keys = new Map();
  const pad = new ControlPad({
    helperPath: h.helper,
    store: { pad: () => saved, savePad: (p) => { saved = JSON.parse(JSON.stringify(p)); } },
    injectText: async (text) => { pasted.push(text); return true; },
    onEvent: (e) => events.push(e),
    electron: {
      screen: { getAllDisplays: () => displays, getDisplayMatching: (r) => (r.x >= 1728 ? displays[1] : displays[0]),
        getDisplayNearestPoint: () => displays[0], getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
      globalShortcut: { register: (k, fn) => { keys.set(k, fn); return true; }, unregister: (k) => keys.delete(k) },
      BrowserWindow: class { constructor() { this.webContents = { isLoading: () => false, send: (...a) => shown.push(a) }; }
        setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} loadFile() {} on() {} getSize() { return [452, 520]; } setPosition() {}
        showInactive() { this.visible = true; } hide() { this.visible = false; } isVisible() { return !!this.visible; } isDestroyed() { return false; } }
    }
  });
  t.after(() => pad.close());
  return { pad, calls: h.calls, events, saved: () => saved, shown, pasted, keys };
}

test('a snap pad moves the window you were using, and the same pad twice jumps screens', async (t) => {
  const f = fixture(t);
  await f.pad.open();
  assert.equal(f.shown[0][1].target, 'Google Chrome');
  const first = await f.pad.press('A', 'key');
  assert.equal(first.ok, true);
  assert.ok(f.calls().includes('move 777 0 25 864 1092'));
  await f.pad.open();
  const fx = fakeHelper(t, { ok: true, pid: 777, app: 'Google Chrome', x: 0, y: 25, w: 864, h: 1092 });
  f.pad.d.helperPath = fx.helper;
  await f.pad.press('A', 'key');
  assert.ok(fx.calls().includes('move 777 1728 25 864 1092'));
});

test('Shift+pad saves every visible window except SpeakEasy, and the pad puts them back', async (t) => {
  const f = fixture(t);
  const ev = await f.pad.save('1');
  assert.equal(ev.message, 'Saved 1 window');
  assert.deepEqual(f.saved()['1'].windows.map((w) => w.app), ['Notes']);
  const res = await f.pad.press('1', 'key');
  assert.equal(res.ok, true);
  assert.match(res.message, /1 of 1/);
  assert.ok(f.calls().some((c) => c === `move ${process.pid} 10 40 700 600` || /^move \d+ 10 40 700 600$/.test(c)));
});

test('empty and unsafe-from-SpeakEasy pads explain themselves instead of acting', async (t) => {
  const f = fixture(t, { ok: true, pid: process.pid, app: 'SpeakEasy' });
  f.pad.d.store.savePad({ ...require('../src/shared/pad').defaultPads(), V: { type: 'none' } });
  assert.match((await f.pad.press('V')).message, /Empty pad/);
  assert.match((await f.pad.press('A', 'test')).message, /another app/);
  await f.pad.open();
  assert.match((await f.pad.press('A', 'key')).message, /Click a window first/);
  assert.equal(f.events.filter((e) => e.phase === 'hit').length, 3);
});

test('a voice plan runs safe steps at once and holds a paste until Return', async (t) => {
  const f = fixture(t);
  const pasted = [];
  f.pad.d.injectText = async (text) => { pasted.push(text); return true; };
  await f.pad.open();
  const safe = await f.pad.showPlan({ heard: 'put this on the left and make pad 3 open claude.ai', via: 'local', reply: '', steps: [
    { do: 'snap', app: 'front', region: 'left', text: 'This window to left half', confirm: false },
    { do: 'teach', key: '3', action: { type: 'url', url: 'https://claude.ai' }, text: 'Pad 3 now: open link', confirm: false }] });
  assert.deepEqual(safe, { ok: true, ran: 2 });
  assert.ok(f.calls().includes('move 777 0 25 864 1092'));
  assert.equal(f.saved()['3'].url, 'https://claude.ai');
  const plans = f.shown.filter(([ch]) => ch === 'pad:plan');
  assert.equal(plans.at(-1)[1].confirm, false);

  await f.pad.open();
  const held = await f.pad.showPlan({ heard: 'type hello', via: 'local', reply: '', steps: [{ do: 'paste', text: 'hello', confirm: true }] });
  assert.equal(held.waiting, true);
  assert.deepEqual(pasted, []);
  const ran = await f.pad.confirm();
  assert.equal(ran.ok, true);
  assert.deepEqual(pasted, ['hello']);
  assert.equal((await f.pad.confirm()).ok, false, 'Return twice runs it once');
});

test('Esc on a held plan drops it', async (t) => {
  const f = fixture(t);
  const pasted = [];
  f.pad.d.injectText = async (text) => { pasted.push(text); return true; };
  await f.pad.open();
  await f.pad.showPlan({ heard: 'type hi', via: 'local', reply: '', steps: [{ do: 'paste', text: 'hi', confirm: true }] });
  f.pad.close();
  assert.equal((await f.pad.confirm()).ok, false);
  assert.deepEqual(pasted, []);
});

test('history results: Up/Down picks, Return pastes the pick into the app, a plan clears them', async (t) => {
  const f = fixture(t);
  const items = [{ id: 'a', text: 'First full dictation.', snippet: 'First', app: 'Notes', ts: 1 }, { id: 'b', text: 'Second full dictation.', snippet: 'Second', app: 'Mail', ts: 2 }];
  assert.deepEqual(await f.pad.showResults({ query: 'dictation', items, wake: true }), { ok: true, count: 2 });
  const sent = f.shown.find(([channel]) => channel === 'pad:results')[1];
  assert.deepEqual(sent.items.map((i) => i.snippet), ['First', 'Second']);
  assert.ok(!('text' in sent.items[0]), 'the pad gets snippets, not whole dictations');
  assert.deepEqual(f.events.find((e) => e.phase === 'results'), { phase: 'results', query: 'dictation', count: 2, wake: true, at: f.events.find((e) => e.phase === 'results').at });
  f.keys.get('Down')();
  f.keys.get('Down')();
  f.keys.get('Up')();
  await f.keys.get('Return')();
  assert.deepEqual(f.pasted, ['Second full dictation.']);
  assert.equal(f.events.at(-1).phase, 'history-paste');
  assert.equal(f.keys.has('Up'), false);
  await f.pad.showResults({ query: 'x', items, wake: false });
  await f.pad.showPlan({ heard: 'open notes', steps: [{ do: 'open_app', app: 'Notes', text: 'Open Notes', confirm: false }] }).catch(() => {});
  assert.equal(f.pad.results, null);
  const none = await f.pad.showResults({ query: 'nothing', items: [] });
  assert.deepEqual(none, { ok: false, count: 0 });
});
