'use strict';

const { uIOhook, UiohookKey } = require('uiohook-napi');
const { spawn } = require('child_process');
const path = require('path');

// Map our settings keys to uiohook keycodes
const KEYCODES = {
  AltRight: UiohookKey.AltRight,
  MetaRight: UiohookKey.MetaRight,
  CtrlRight: UiohookKey.CtrlRight,
  CtrlLeft: UiohookKey.Ctrl,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9
};

const TAP_MS = 350;        // released faster than this = a tap, not a hold
const DOUBLE_TAP_MS = 900; // second tap within this window = hands-free toggle

/**
 * Push-to-talk with Wispr-style interaction model:
 * - Hold the key: record while held, stop on release.
 * - Double-tap the key: hands-free mode (record until the key is tapped again).
 * - Esc while recording: cancel.
 *
 * Callbacks: onStart(), onStop(), onCancel()  (onStop/onCancel only fire while active)
 */
class HotkeyManager {
  constructor({ onStart, onStop, onCancel, onKey, onStatus, onMic, onMicUp, micKey }) {
    this.onStart = onStart;
    this.onMic = onMic;
    this.onMicUp = onMicUp;
    this.micKey = micKey || (() => false); // claim the microphone key for the Control Pad
    this.onStop = onStop;
    this.onCancel = onCancel;
    this.onKey = onKey;
    this.onStatus = onStatus;
    this.helper = null;
    this.keyName = null;
    this.error = '';
    this.keycode = null;
    this.running = false;

    this.keyIsDown = false;
    this.active = false;        // recording in progress
    this.handsFree = false;     // active via double-tap
    this.pressedAt = 0;
    this.lastTapAt = 0;
    this.tapTimer = null;
    this.healthTimer = null;

    this._down = this._down.bind(this);
    this._up = this._up.bind(this);
  }

  setKey(name) {
    // Swapping keys mid-recording would orphan the session (the old key's
    // keyup would be ignored): cancel cleanly first.
    if (this.active) this._cancel();
    this.reset();
    this.keyName = name;
    this.keycode = name === 'Fn' ? -1 : KEYCODES[name] || KEYCODES.AltRight;
  }

  async start(keyName) {
    if (this.running && this.keyName === keyName) return true;
    this.stop();
    this.setKey(keyName);
    this.error = '';
    if (keyName === 'Fn') return this._startFn();
    uIOhook.on('keydown', this._down);
    uIOhook.on('keyup', this._up);
    try {
      uIOhook.start();
    } catch (e) {
      uIOhook.removeListener('keydown', this._down);
      uIOhook.removeListener('keyup', this._up);
      throw e;
    }
    this.running = true;
    this._status();
    return true;
  }

  stop() {
    clearInterval(this.healthTimer);
    this.healthTimer = null;
    if (this.active) this._cancel();
    this.reset();
    if (this.helper) {
      const child = this.helper;
      this.helper = null;
      child.kill();
    }
    uIOhook.removeListener('keydown', this._down);
    uIOhook.removeListener('keyup', this._up);
    if (this.running && this.keyName !== 'Fn') {
      try { uIOhook.stop(); } catch { /* already stopped */ }
    }
    this.running = false;
  }

  _status() {
    if (this.onStatus) this.onStatus({ ready: this.running, error: this.error, key: this.keyName });
  }

  _startFn() {
    if (process.platform !== 'darwin') throw new Error('Fn dictation is available on Mac. Choose another key.');
    const { app } = require('electron');
    const executable = app.isPackaged
      ? path.join(process.resourcesPath, 'native', 'speakeasy-fn')
      : path.join(__dirname, '..', '..', 'build', 'native', 'speakeasy-fn');
    return new Promise((resolve, reject) => {
      const child = spawn(executable, this.micKey() ? ['--mic'] : [], { stdio: ['ignore', 'pipe', 'pipe'] });
      this.helper = child;
      let pending = true;
      let buffer = '';
      let lastHeartbeat = Date.now();
      const fail = (message) => {
        if (this.helper !== child) {
          if (pending) { pending = false; clearTimeout(timer); reject(new Error('Shortcut changed')); }
          return;
        }
        this.error = message;
        clearInterval(this.healthTimer);
        this.healthTimer = null;
        this.running = false;
        this.helper = null;
        child.kill();
        if (this.active) this._cancel();
        this.reset();
        this._status();
        if (pending) { pending = false; clearTimeout(timer); reject(new Error(message)); }
      };
      const timer = setTimeout(() => fail('The Fn listener did not start. Retry after checking permissions.'), 5000);
      child.on('error', () => fail('The Fn listener is unavailable. Reinstall SpeakEasy or choose Right Option.'));
      child.on('exit', () => fail('Allow SpeakEasy in Accessibility and Input Monitoring, then retry.'));
      child.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          let event;
          try { event = JSON.parse(line).event; } catch { continue; }
          if (this.helper !== child) continue;
          if (event === 'ready') {
            this.running = true;
            this.error = '';
            this._status();
            lastHeartbeat = Date.now();
            clearInterval(this.healthTimer);
            this.healthTimer = setInterval(() => {
              if (Date.now() - lastHeartbeat > 10000) fail('The Fn listener stopped responding. Reconnecting.');
            }, 3000);
            if (pending) { pending = false; clearTimeout(timer); resolve(true); }
          } else if (event === 'down') this._down({ keycode: -1 });
          else if (event === 'up') this._up({ keycode: -1 });
          else if (event === 'heartbeat') lastHeartbeat = Date.now();
          else if (event === 'mic') this._safe(this.onMic);
          else if (event === 'mic-up') this._safe(this.onMicUp);
          else if (event === 'reset') this._listenerReset();
          else if (event === 'cancel' && this.active) this._cancel();
          else if (event === 'permission-required') fail('Allow SpeakEasy in Accessibility and Input Monitoring, then retry.');
        }
      });
    });
  }

  _down(e) {
    if (e.keycode === UiohookKey.Escape && this.active) {
      this._cancel();
      return;
    }
    if (e.keycode !== this.keycode) return;
    if (this.keyIsDown) return; // OS key-repeat
    this.keyIsDown = true;
    if (this.onKey) this.onKey({ down: true, key: this.keyName });
    this.pressedAt = Date.now();

    if (this.active && this.handsFree) return; // tap-to-stop handled on keyup

    if (!this.active) {
      // Second tap of a double-tap? We are already recording from the first tap.
      this.active = true;
      this.handsFree = false;
      this._safe(this.onStart);
    }
  }

  _up(e) {
    if (e.keycode !== this.keycode) return;
    if (!this.keyIsDown) return;
    this.keyIsDown = false;
    if (this.onKey) this.onKey({ down: false, key: this.keyName });
    const heldMs = Date.now() - this.pressedAt;
    const now = Date.now();

    if (this.active && this.handsFree) {
      // Any tap while hands-free stops and transcribes
      this.handsFree = false;
      this.active = false;
      this.lastHandsFree = true;
      this._safe(this.onStop);
      return;
    }

    if (!this.active) return;

    if (heldMs < TAP_MS) {
      // A tap. Was it the second of a double-tap?
      if (now - this.lastTapAt < DOUBLE_TAP_MS) {
        this.lastTapAt = 0;
        this.handsFree = true; // keep recording, hands-free
        clearTimeout(this.tapTimer);
        return;
      }
      // First tap: keep recording briefly, waiting for a possible second tap
      this.lastTapAt = now;
      clearTimeout(this.tapTimer);
      this.tapTimer = setTimeout(() => {
        // No second tap arrived: too short to be a real dictation, cancel
        if (this.active && !this.handsFree && !this.keyIsDown) this._cancel();
      }, DOUBLE_TAP_MS);
      return;
    }

    // A real hold-and-release: stop and transcribe
    this.active = false;
    this.lastHandsFree = false;
    this._safe(this.onStop);
  }

  _cancel() {
    this.active = false;
    this.handsFree = false;
    this.lastTapAt = 0;
    clearTimeout(this.tapTimer);
    this._safe(this.onCancel);
  }

  _listenerReset() {
    if (this.active) this._cancel();
    this.reset(); // a disabled tap may have swallowed the release event
  }

  /** Force-reset state (used when recording is stopped from elsewhere). */
  reset() {
    this.keyIsDown = false;
    this.active = false;
    this.handsFree = false;
    this.lastTapAt = 0;
    clearTimeout(this.tapTimer);
  }

  _safe(fn) {
    try { fn && fn(); } catch (e) { console.error('[hotkey]', e); }
  }
}

module.exports = { HotkeyManager };
