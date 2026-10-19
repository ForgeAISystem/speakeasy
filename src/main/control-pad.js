'use strict';

const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const padModel = require('../shared/pad');

// The Control Pad: a floating 4x4 grid that runs one action per pad. It opens
// without taking focus, so the app you were using stays the target of a snap,
// a key combo or a pasted prompt.

function run(cmd, args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).trim()));
      else resolve(String(stdout || ''));
    });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const quote = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

class ControlPad {
  /**
   * deps: electron pieces plus store (pad(), savePad()), injectText, onEvent
   * (every trigger, for the live monitor) and helperPath.
   */
  constructor(deps) {
    this.d = deps;
    this.win = null;
    this.camera = null;
    this.target = null;
    this.keysBound = false;
    this.closeTimer = null;
  }

  pads() { return padModel.normalize(this.d.store.pad()); }

  async helper(args) {
    const out = await run(this.d.helperPath, args.map(String), 4000).catch((e) => e.message);
    try { return JSON.parse(out.trim().split('\n').pop()); } catch { return { ok: false, error: out || 'helper failed' }; }
  }

  // ------------------------------------------------------------ pad window

  _window() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const { BrowserWindow } = this.d.electron;
    const win = this.win = new BrowserWindow({
      width: 452, height: 520, show: false, frame: false, transparent: true, resizable: false,
      movable: false, minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, hasShadow: false, focusable: false, type: 'panel', alwaysOnTop: true,
      webPreferences: { preload: path.join(__dirname, '..', 'pad', 'preload.js') }
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadFile(path.join(__dirname, '..', 'pad', 'pad.html'));
    win.on('closed', () => { if (this.win === win) this.win = null; });
    return win;
  }

  isOpen() { return !!(this.win && !this.win.isDestroyed() && this.win.isVisible()); }

  async toggle() { return this.isOpen() ? this.close() : this.open(); }

  /** The window in front right now (never SpeakEasy itself), or null. */
  async front() {
    const front = await this.helper(['front']);
    return front.ok && front.pid !== process.pid ? front : null;
  }

  /** Remember the window in front when a dictation starts, for voice commands. */
  captureTarget() {
    this.lastFrontPromise = this.front().then((t) => { this.lastFront = t; return t; }).catch(() => null);
    return this.lastFrontPromise;
  }

  async open(target) {
    const { screen } = this.d.electron;
    this.target = target !== undefined ? target : await this.front();
    const frame = this.target && this.target.w ? { x: this.target.x, y: this.target.y, width: this.target.w, height: this.target.h } : null;
    const display = frame ? screen.getDisplayMatching(frame) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const win = this._window();
    const [w, h] = win.getSize();
    const a = display.workArea;
    win.setPosition(Math.round(a.x + (a.width - w) / 2), Math.round(a.y + (a.height - h) / 2), false);
    const send = () => win.webContents.send('pad:show', { pads: this.pads(), target: this.target ? this.target.app : '' });
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send); else send();
    win.showInactive();
    this.d.onEvent && this.d.onEvent({ phase: 'open', at: Date.now() });
    this._bindKeys();
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.close(), 12000);
    return true;
  }

  close() {
    clearTimeout(this.closeTimer);
    this._unbindKeys();
    this._unbindConfirm();
    this.pending = null;
    if (this.win && !this.win.isDestroyed()) this.win.hide();
    return true;
  }

  _send(channel, payload) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload);
  }

  /** Fn pressed while the pad is open: this dictation is a command. */
  listening() {
    clearTimeout(this.closeTimer);
    this._send('pad:listening', {});
  }

  /**
   * Shows a voice plan on the pad. Safe plans run at once; plans that type,
   * paste or run a Shortcut wait for Return (Esc cancels).
   * plan: { heard, reply, via, steps: [{ ...step, text, confirm }] }
   */
  async showPlan(plan) {
    if (!this.isOpen()) {
      if (this.lastFrontPromise) await this.lastFrontPromise;
      await this.open(this.lastFront || null);
    }
    clearTimeout(this.closeTimer);
    const confirm = plan.steps.some((st) => st.confirm);
    this._send('pad:plan', { heard: plan.heard, reply: plan.reply, via: plan.via, confirm, steps: plan.steps.map((st) => ({ text: st.text, confirm: st.confirm })) });
    this.d.onEvent && this.d.onEvent({ phase: 'plan', heard: plan.heard, steps: plan.steps.map((st) => st.text), via: plan.via, wake: !!plan.wake, at: Date.now() });
    if (!plan.steps.length) { this.closeTimer = setTimeout(() => this.close(), 4500); return { ok: false, ran: 0 }; }
    if (!confirm) return this.runSteps(plan.steps);
    this.pending = plan.steps;
    this._bindConfirm();
    this.closeTimer = setTimeout(() => this.close(), 20000);
    return { ok: true, waiting: true };
  }

  _bindConfirm() {
    const { globalShortcut } = this.d.electron;
    try { globalShortcut.register('Return', () => this.confirm()); this.confirmBound = true; } catch { /* click Run instead */ }
  }

  _unbindConfirm() {
    if (!this.confirmBound) return;
    try { this.d.electron.globalShortcut.unregister('Return'); } catch { /* gone */ }
    this.confirmBound = false;
  }

  confirm() {
    const steps = this.pending;
    if (!steps) return { ok: false };
    this.pending = null;
    this._unbindConfirm();
    clearTimeout(this.closeTimer);
    return this.runSteps(steps);
  }

  async runSteps(steps) {
    let ran = 0;
    for (let i = 0; i < steps.length; i++) {
      this._send('pad:step', { i, state: 'run' });
      let res;
      try { res = await this.runStep(steps[i]); } catch (e) { res = { ok: false, message: e.message }; }
      if (res.ok) ran++;
      this.d.onEvent && this.d.onEvent({ phase: 'voice-step', do: steps[i].do, ok: !!res.ok, at: Date.now() });
      this._send('pad:step', { i, state: res.ok ? 'ok' : 'fail', message: res.message });
      this.d.onEvent && this.d.onEvent({ key: steps[i].key || 'VOICE', ok: res.ok, message: `${steps[i].text}: ${res.message || (res.ok ? 'done' : 'failed')}`, label: 'Voice', source: 'voice', at: Date.now() });
    }
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.close(), ran === steps.length ? 1400 : 4000);
    return { ok: ran === steps.length, ran };
  }

  async runStep(step) {
    const pads = this.pads();
    switch (step.do) {
      case 'snap': return step.app === 'front' ? this.snap(step.region) : this.snapApp(step.app, step.region);
      case 'open_app': return this.openApp(step.app);
      case 'open_url': return this.openUrl(step.url);
      case 'pad':
        this.d.onEvent && this.d.onEvent({ key: step.key, phase: 'hit', at: Date.now(), source: 'voice' });
        return this.runAction(pads[step.key], step.key);
      case 'shortcut': return this.runAction({ type: 'shortcut', name: step.name }, 'VOICE');
      case 'keys': return this.pressKeys(step.keys);
      case 'paste': return this.runAction({ type: 'text', text: step.text }, 'VOICE');
      case 'record': return this.runAction({ type: 'record' }, 'VOICE');
      case 'camera': {
        const on = this.toggleCamera(step.on);
        return { ok: true, message: on ? 'Camera on' : 'Camera off' };
      }
      case 'teach': {
        pads[step.key] = step.action;
        this.d.store.savePad(pads);
        this._send('pad:show', { pads: this.pads(), target: this.target ? this.target.app : '', keepPlan: true });
        return { ok: true, message: `Pad ${step.key} saved` };
      }
      default: return { ok: false, message: 'Unknown step' };
    }
  }

  /** Moves a named app's window (opening the app first if needed). */
  async snapApp(app, region) {
    let pid = await this._pidFor({ app, exec: '' });
    if (!pid) {
      await run('open', ['-a', app]).catch(() => {});
      for (let i = 0; i < 20 && !pid; i++) { await wait(250); pid = await this._pidFor({ app, exec: '' }); }
    }
    if (!pid) return { ok: false, message: `${app} did not open` };
    let f = { ok: false };
    for (let i = 0; i < 8 && !f.ok; i++) { f = await this.helper(['frame', pid]); if (!f.ok) await wait(250); }
    const { screen } = this.d.electron;
    const current = f.ok ? { x: f.x, y: f.y, width: f.w, height: f.h } : null;
    const display = current ? screen.getDisplayMatching(current) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const frame = padModel.frameFor(region, display.workArea);
    const moved = await this.helper(['move', pid, frame.x, frame.y, frame.width, frame.height]);
    if (!moved.ok) return { ok: false, message: moved.error === 'accessibility' ? 'Allow SpeakEasy in Accessibility.' : `${app} cannot move` };
    return { ok: true, message: `${app} > ${padModel.REGIONS[region]?.label || region}` };
  }

  _bindKeys() {
    if (this.keysBound) return;
    const { globalShortcut } = this.d.electron;
    this.keysBound = true;
    const bind = (accel, fn) => { try { globalShortcut.register(accel, fn); } catch { /* taken: click still works */ } };
    for (const key of padModel.KEYS) {
      bind(key, () => this.press(key, 'key'));
      bind(`Shift+${key}`, () => this.save(key));
    }
    bind('Escape', () => this.close());
  }

  _unbindKeys() {
    if (!this.keysBound) return;
    const { globalShortcut } = this.d.electron;
    for (const key of padModel.KEYS) {
      try { globalShortcut.unregister(key); globalShortcut.unregister(`Shift+${key}`); } catch { /* not bound */ }
    }
    try { globalShortcut.unregister('Escape'); } catch { /* not bound */ }
    this.keysBound = false;
  }

  _result(key, ok, message, source) {
    const event = { key, ok, message, label: padModel.label(this.pads()[key]), source, at: Date.now() };
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send('pad:result', event);
    this.d.onEvent && this.d.onEvent(event);
    return event;
  }

  /** Runs one pad. source: 'key' | 'click' | 'test'. */
  async press(key, source = 'click') {
    const pad = this.pads()[key];
    if (!pad) return { ok: false, message: 'No such pad' };
    this.d.onEvent && this.d.onEvent({ key, phase: 'hit', at: Date.now(), source });
    let result;
    try {
      // From the SpeakEasy window the target would be SpeakEasy itself.
      result = source === 'test' && ['snap', 'keys', 'text'].includes(pad.type)
        ? { ok: false, message: 'Open the pad over another app to try this one.' }
        : await this.runAction(pad, key);
    } catch (e) {
      result = { ok: false, message: e.message };
    }
    const event = this._result(key, result.ok, result.message, source);
    if (this.isOpen() && pad.type !== 'none') setTimeout(() => this.close(), result.ok ? 220 : 1600);
    return event;
  }

  async runAction(pad, key) {
    switch (pad.type) {
      case 'none': return { ok: false, message: 'Empty pad. Map it in SpeakEasy > Pad.' };
      case 'snap': return this.snap(pad.region);
      case 'layout': return this.restoreLayout(pad);
      case 'app': return this.openApp(pad.app);
      case 'url': return this.openUrl(pad.url);
      case 'shortcut':
        if (!pad.name) return { ok: false, message: 'Name the Shortcut first.' };
        run('shortcuts', ['run', pad.name], 120000).catch((e) => this._result(key, false, e.message, 'shortcut'));
        return { ok: true, message: `Running ${pad.name}` };
      case 'keys': return this.pressKeys(pad.keys);
      case 'text':
        if (!pad.text) return { ok: false, message: 'Write the prompt first.' };
        this.close();
        await this._focusTarget();
        await wait(120);
        return { ok: await this.d.injectText(pad.text, { restoreClipboard: true }), message: 'Pasted' };
      case 'record': {
        this.toggleCamera(true);
        await run('open', ['-b', 'com.apple.screenshot.launcher']);
        return { ok: true, message: 'Pick Record in the toolbar' };
      }
      case 'camera': return { ok: true, message: this.toggleCamera() ? 'Camera on' : 'Camera off' };
      default: return { ok: false, message: 'Unknown action' };
    }
  }

  // ------------------------------------------------------------ actions

  async snap(region) {
    if (!this.target) return { ok: false, message: 'Click a window first, then open the pad.' };
    const { screen } = this.d.electron;
    const fresh = await this.helper(['front']);
    const t = fresh.ok && fresh.pid === this.target.pid && fresh.w ? fresh : this.target;
    const current = { x: t.x, y: t.y, width: t.w, height: t.h };
    const displays = screen.getAllDisplays();
    let display = screen.getDisplayMatching(current);
    let frame = padModel.frameFor(region, display.workArea);
    // Same pad twice: send the window to the next screen, same spot.
    if (padModel.sameFrame(current, frame) && displays.length > 1) {
      display = displays[(displays.findIndex((d) => d.id === display.id) + 1) % displays.length];
      frame = padModel.frameFor(region, display.workArea);
    }
    const moved = await this.helper(['move', this.target.pid, frame.x, frame.y, frame.width, frame.height]);
    if (!moved.ok) return { ok: false, message: moved.error === 'accessibility' ? 'Allow SpeakEasy in Accessibility.' : `${this.target.app || 'That window'} cannot move.` };
    Object.assign(this.target, { x: moved.x, y: moved.y, w: moved.w, h: moved.h });
    return { ok: true, message: `${this.target.app || 'Window'} > ${padModel.REGIONS[region]?.label || region}` };
  }

  /** Shift+pad or the Save button: remember every visible app window. */
  async save(key) {
    const pads = this.pads();
    const pad = pads[key];
    if (!pad || pad.type !== 'layout') return this._result(key, false, 'Only workflow pads save layouts.', 'save');
    const list = await this.helper(['list']);
    if (!list.ok) return this._result(key, false, 'Could not read your windows.', 'save');
    const windows = list.windows.filter((w) => w.pid !== process.pid).slice(0, 12)
      .map(({ app, exec, x, y, w, h }) => ({ app, exec, x, y, w, h }));
    pads[key] = { ...pad, windows };
    this.d.store.savePad(pads);
    const event = this._result(key, true, `Saved ${windows.length} ${windows.length === 1 ? 'window' : 'windows'}`, 'save');
    if (this.isOpen()) setTimeout(() => this.close(), 600);
    return event;
  }

  async _pidFor(win) {
    const ps = await run('ps', ['-axo', 'pid=,comm=']).catch(() => '');
    for (const line of ps.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(.*)$/);
      if (m && m[2] === win.exec) return Number(m[1]);
    }
    const info = await run('lsappinfo', ['info', '-only', 'pid', win.app]).catch(() => '');
    const m = info.match(/=\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  async restoreLayout(pad) {
    if (!pad.windows || !pad.windows.length) return { ok: false, message: 'Empty. Arrange your windows, then Shift + this key saves them.' };
    let placed = 0;
    for (const win of pad.windows) {
      let pid = await this._pidFor(win);
      if (!pid) {
        const bundle = (win.exec.match(/^(.*?\.app)\//) || [])[1];
        await run('open', bundle && !bundle.includes('/private/') ? [bundle] : ['-a', win.app]).catch(() => {});
        for (let i = 0; i < 20 && !pid; i++) { await wait(250); pid = await this._pidFor(win); }
      }
      if (!pid) continue;
      for (let i = 0; i < 8; i++) {
        const moved = await this.helper(['move', pid, win.x, win.y, win.w, win.h]);
        if (moved.ok) { placed++; break; }
        await wait(250); // a just-launched app has no window yet
      }
    }
    return { ok: placed > 0, message: `${placed} of ${pad.windows.length} windows in place` };
  }

  async openApp(name) {
    if (!name) return { ok: false, message: 'Pick an app first.' };
    await run('open', name.endsWith('.app') ? [name] : ['-a', name]);
    return { ok: true, message: `Opened ${path.basename(name, '.app')}` };
  }

  async openUrl(url) {
    if (!url) return { ok: false, message: 'Add a link first.' };
    const { shell } = this.d.electron;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) await shell.openExternal(url);
    else {
      const err = await shell.openPath(url.replace(/^~(?=\/|$)/, os.homedir()));
      if (err) return { ok: false, message: err };
    }
    return { ok: true, message: 'Opened' };
  }

  async _focusTarget() {
    if (this.target) await run('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${Number(this.target.pid)}) to true`]).catch(() => {});
  }

  async pressKeys(text) {
    const combo = padModel.parseKeys(text);
    if (!combo) return { ok: false, message: 'Write keys like cmd+shift+4.' };
    this.close();
    await this._focusTarget();
    await wait(120);
    const using = combo.modifiers.length ? ` using {${combo.modifiers.map((m) => `${m} down`).join(', ')}}` : '';
    const press = combo.code !== undefined ? `key code ${combo.code}` : `keystroke ${quote(combo.key)}`;
    await run('osascript', ['-e', `tell application "System Events" to ${press}${using}`]);
    return { ok: true, message: `Pressed ${text}` };
  }

  // ------------------------------------------------------------ camera bubble

  toggleCamera(force) {
    const on = !!(this.camera && !this.camera.isDestroyed());
    const want = force === undefined ? !on : force;
    if (!want) { if (on) this.camera.close(); return false; }
    if (on) return true;
    const { BrowserWindow, screen, systemPreferences } = this.d.electron;
    if (process.platform === 'darwin') systemPreferences.askForMediaAccess('camera').catch(() => {});
    const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const size = 220;
    const cam = this.camera = new BrowserWindow({
      width: size, height: size, x: a.x + a.width - size - 28, y: a.y + a.height - size - 28,
      frame: false, transparent: true, resizable: true, hasShadow: false, skipTaskbar: true,
      alwaysOnTop: true, fullscreenable: false, minimizable: false, maximizable: false, focusable: false,
      webPreferences: { preload: path.join(__dirname, '..', 'pad', 'preload.js') }
    });
    cam.setAspectRatio(1);
    cam.setAlwaysOnTop(true, 'screen-saver');
    cam.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    cam.loadFile(path.join(__dirname, '..', 'pad', 'camera.html'));
    cam.on('closed', () => { if (this.camera === cam) this.camera = null; this.d.onEvent && this.d.onEvent({ phase: 'camera', on: false }); });
    this.d.onEvent && this.d.onEvent({ phase: 'camera', on: true });
    return true;
  }

  dispose() {
    this.close();
    if (this.camera && !this.camera.isDestroyed()) this.camera.close();
  }
}

module.exports = { ControlPad };
