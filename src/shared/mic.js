'use strict';

// Picking a microphone that can hear you, and noticing when it cannot.
const BUILT_IN = /macbook|built-?in|internal/i;
const VIRTUAL = /^(default|communications)$/;

/**
 * The deviceId to record from. A chosen mic always wins. With "System default"
 * on a laptop whose lid is closed, the built-in mic sits under the lid, so the
 * first external mic is used instead.
 */
function pickMic({ setting = 'default', mics = [], lidClosed = false } = {}) {
  if (setting && setting !== 'default') return setting;
  if (!lidClosed || !mics.some((m) => BUILT_IN.test(m.label))) return 'default';
  const external = mics.find((m) => !VIRTUAL.test(m.deviceId) && !BUILT_IN.test(m.label) && !/^default\b/i.test(m.label));
  return external ? external.deviceId : 'default';
}

/** Feeds chunk levels; reports 'silent' after `ms` of near-zero input and 'sound' when it returns. */
class SilenceWatch {
  constructor({ floor = 0.0035, ms = 2000 } = {}) {
    this.floor = floor;
    this.ms = ms;
    this.reset(0);
  }
  reset(now) { this.quietSince = now; this.warned = false; }
  feed(rms, now) {
    if (rms > this.floor) {
      this.quietSince = now;
      if (this.warned) { this.warned = false; return 'sound'; }
      return null;
    }
    if (!this.warned && now - this.quietSince >= this.ms) { this.warned = true; return 'silent'; }
    return null;
  }
}

module.exports = { pickMic, SilenceWatch, BUILT_IN };
