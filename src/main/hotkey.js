'use strict';

const { uIOhook, UiohookKey } = require('uiohook-napi');

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
  constructor({ onStart, onStop, onCancel }) {
    this.onStart = onStart;
    this.onStop = onStop;
    this.onCancel = onCancel;
    this.keycode = null;
    this.running = false;

    this.keyIsDown = false;
    this.active = false;        // recording in progress
    this.handsFree = false;     // active via double-tap
    this.pressedAt = 0;
    this.lastTapAt = 0;
    this.tapTimer = null;

    this._down = this._down.bind(this);
    this._up = this._up.bind(this);
  }

  setKey(name) {
    this.keycode = KEYCODES[name] || KEYCODES.AltRight;
  }

  start(keyName) {
    this.setKey(keyName);
    if (this.running) return;
    uIOhook.on('keydown', this._down);
    uIOhook.on('keyup', this._up);
    uIOhook.start();
    this.running = true;
  }

  stop() {
    if (!this.running) return;
    uIOhook.removeListener('keydown', this._down);
    uIOhook.removeListener('keyup', this._up);
    try { uIOhook.stop(); } catch { /* already stopped */ }
    this.running = false;
  }

  _down(e) {
    if (e.keycode === UiohookKey.Escape && this.active) {
      this._cancel();
      return;
    }
    if (e.keycode !== this.keycode) return;
    if (this.keyIsDown) return; // OS key-repeat
    this.keyIsDown = true;
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
    const heldMs = Date.now() - this.pressedAt;
    const now = Date.now();

    if (this.active && this.handsFree) {
      // Any tap while hands-free stops and transcribes
      this.handsFree = false;
      this.active = false;
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
    this._safe(this.onStop);
  }

  _cancel() {
    this.active = false;
    this.handsFree = false;
    clearTimeout(this.tapTimer);
    this._safe(this.onCancel);
  }

  /** Force-reset state (used when recording is stopped from elsewhere). */
  reset() {
    this.active = false;
    this.handsFree = false;
    clearTimeout(this.tapTimer);
  }

  _safe(fn) {
    try { fn && fn(); } catch (e) { console.error('[hotkey]', e); }
  }
}

module.exports = { HotkeyManager };
