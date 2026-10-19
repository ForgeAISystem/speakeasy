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
  fs.writeFileSync(helper, `#!/bin/sh\necho "$@" >> '${log}'\ncase "$1" in\n front) echo '${JSON.stringify(front)}';;\n list) echo '${list}';;\n watch) echo '{"ok":true,"event":"watching"}'; echo '{"event":"manual","pid":4242,"app":"Notes","bx":300,"by":200,"bw":700,"bh":500,"x":0,"y":25,"w":864,"h":1092}';;\n move) echo "{\\"ok\\":true,\\"x\\":$3,\\"y\\":$4,\\"w\\":$5,\\"h\\":$6}";;\nesac\n`, { mode: 0o755 });
  return { helper, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []) };
}

function fixture(t, front = { ok: true, pid: 777, app: 'Google Chrome', x: 100, y: 100, w: 800, h: 600 }) {
  const h = fakeHelper(t, front);
  let saved = {};
  let layouts = {};
  const events = [];
  const display = (id, x) => ({ id, workArea: { x, y: 25, width: 1728, height: 1092 } });
  const displays = [display(1, 0), display(2, 1728)];
  const shown = [];
  const pad = new ControlPad({
    helperPath: h.helper,
    store: { pad: () => saved, savePad: (p) => { saved = JSON.parse(JSON.stringify(p)); }, layouts: () => layouts, saveLayouts: (d) => { layouts = d; } },
    injectText: async () => true,
    onEvent: (e) => events.push(e),
    electron: {
      screen: { getAllDisplays: () => displays.map((d) => ({ ...d, bounds: d.workArea })), getDisplayMatching: (r) => (r.x >= 1728 ? displays[1] : displays[0]),
        getDisplayNearestPoint: () => displays[0], getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
      globalShortcut: { register: () => true, unregister() {} },
      BrowserWindow: class { constructor() { this.webContents = { isLoading: () => false, send: (...a) => shown.push(a) }; }
        setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setIgnoreMouseEvents() {} loadFile() {} on() {} getSize() { return [452, 520]; } setPosition() {}
        showInactive() { this.visible = true; } hide() { this.visible = false; } close() { this.visible = false; } isVisible() { return !!this.visible; } isDestroyed() { return false; } }
    }
  });
  t.after(() => pad.dispose());
  return { pad, calls: h.calls, events, saved: () => saved, shown, layouts: () => layouts };
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sent = (f, channel) => f.shown.filter(([ch]) => ch === channel).map(([, p]) => p);

test('holding the mic key opens the pad and shows the cheat sheet; letting go hides it', async (t) => {
  const f = fixture(t);
  await f.pad.micDown();
  assert.equal(f.pad.isOpen(), true);
  await wait(500);
  assert.deepEqual(sent(f, 'pad:peek').at(-1), { on: true });
  assert.ok(f.events.some((e) => e.phase === 'peek'));
  f.pad.micUp();
  assert.deepEqual(sent(f, 'pad:peek').at(-1), { on: false });
  assert.equal(f.pad.isOpen(), true, 'the pad stays open after a peek');
  // A quick tap while open closes it, as before.
  await f.pad.micDown();
  f.pad.micUp();
  assert.equal(f.pad.isOpen(), false);
  assert.equal(sent(f, 'pad:peek').filter((p) => p.on).length, 1);
});

test('a locked key explains which lesson opens it, and 1 to 4 answer the first-open question', async (t) => {
  const f = fixture(t);
  let ask = true;
  const picked = [];
  f.pad.d.view = () => ({ locks: ask ? {} : { Q: 'Snap windows' }, ask, examples: ['open Notes'] });
  f.pad.d.onStarter = (goal) => { picked.push(goal); ask = false; };
  await f.pad.open();
  assert.equal(sent(f, 'pad:show').at(-1).ask, true);
  assert.deepEqual(sent(f, 'pad:show').at(-1).examples, ['open Notes']);
  const answer = await f.pad.press('3', 'key');
  assert.deepEqual(picked, ['prompts']);
  assert.match(answer.message, /Prompts/);
  assert.ok(!f.calls().some((c) => c.startsWith('move')), 'answering runs no pad');
  const locked = await f.pad.press('Q', 'key');
  assert.equal(locked.ok, false);
  assert.match(locked.message, /Snap windows/);
  assert.ok(!f.calls().some((c) => c.startsWith('move')));
  // Voice is never locked.
  await f.pad.open();
  const res = await f.pad.runStep({ do: 'pad', key: 'Q' });
  assert.equal(res.ok, true);
});

test('"save this layout as Morning" lands on a free workflow pad, and "put Morning back" restores it', async (t) => {
  const f = fixture(t);
  const res = await f.pad.runStep({ do: 'save_layout', name: 'Morning' });
  assert.equal(res.ok, true);
  assert.match(res.message, /pad 1/);
  assert.equal(f.saved()['1'].label, 'Morning');
  assert.deepEqual(f.saved()['1'].windows.map((w) => w.app), ['Notes']);
  // Same name again reuses the same pad.
  await f.pad.runStep({ do: 'save_layout', name: 'morning' });
  assert.equal(f.saved()['2'].windows.length, 0);
  const back = await f.pad.press('1', 'key');
  assert.equal(back.ok, true);
  assert.ok(f.events.some((e) => e.phase === 'layout-restore' && e.ok));
});

test('with two screens it keeps a snapshot; a reconnect offers it and Return puts the windows back', async (t) => {
  const f = fixture(t);
  assert.equal(await f.pad.snapshot(), true);
  assert.equal(f.layouts().snapshots[0].windows[0].app, 'Notes');
  assert.equal(await f.pad.offerRestore(), true);
  const plan = sent(f, 'pad:plan').at(-1);
  assert.equal(plan.via, 'monitor');
  assert.equal(plan.confirm, true);
  assert.match(plan.title, /screen is back/);
  assert.ok(!f.events.some((e) => e.phase === 'plan'), 'an offer is not something the owner said');
  assert.ok(!f.calls().some((c) => c.startsWith('move')), 'nothing moves before Return');
  const ran = await f.pad.confirm();
  assert.equal(ran.ok, true);
  assert.ok(f.events.some((e) => e.phase === 'layout-restore' && e.source === 'monitor' && e.ok));
  // A setup never seen has nothing to offer.
  f.pad.d.store.saveLayouts({});
  assert.equal(await f.pad.offerRestore(), false);
  assert.equal((await f.pad.restoreWindows()).ok, false);
});

test('the watcher reports windows moved by hand, and a tip shows near the bottom of that screen', async (t) => {
  const f = fixture(t);
  const moves = [];
  f.pad.watch((m) => moves.push(m));
  await wait(300);
  assert.deepEqual(moves[0], { pid: 4242, app: 'Notes', before: { x: 300, y: 200, width: 700, height: 500 }, after: { x: 0, y: 25, width: 864, height: 1092 } });
  f.pad.unwatch();
  f.pad.showTip({ region: 'left', key: 'A', say: 'x', text: 'Next time', opener: 'tap the mic key' }, moves[0].after);
  assert.equal(sent(f, 'tip:show').at(-1).key, 'A');
  assert.ok(f.events.some((e) => e.phase === 'tip' && e.region === 'left'));
});
