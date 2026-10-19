'use strict';

const P = require('../shared/pad');
const G = require('../shared/guides');

// Teaching that lives on the pad itself: the starter pad (4 keys first, the
// rest unlock as lessons finish), the faster-way tips after a window is moved
// by hand, and the screen snapshots that come back after a monitor reconnects.

// What the owner says the pad is for. Every set keeps A, D and S: the first
// lesson snaps left, right and full screen.
const STARTERS = {
  windows: { label: 'Windows', keys: ['A', 'D', 'S', '1'] },
  apps: { label: 'Apps and links', keys: ['A', 'D', 'S', '2'] },
  prompts: { label: 'Prompts', keys: ['A', 'D', 'S', 'V'] },
  recording: { label: 'Recording', keys: ['A', 'D', 'S', 'R'] }
};
const GOALS = Object.keys(STARTERS);

const BROWSERS = ['Google Chrome', 'Safari', 'Arc', 'Firefox', 'Microsoft Edge'];

/** A pad that was never touched is still the factory pad. */
function untouched(saved) { return !saved || !Object.keys(saved).length; }

/** Fills the starter keys for a goal, only where the pad is still the factory default. */
function starterPads(goal, pads, apps = []) {
  const out = { ...pads };
  const fresh = P.defaultPads();
  const same = (key) => JSON.stringify(out[key]) === JSON.stringify(fresh[key]);
  if (goal === 'apps' && same('2')) {
    const app = BROWSERS.find((a) => apps.includes(a));
    out['2'] = app ? { type: 'app', app } : { type: 'url', url: 'https://claude.ai', label: 'Claude' };
  }
  return out;
}

/**
 * Which keys are locked and which lesson opens each one: { [key]: lessonTitle }.
 * starter: settings.padStarter ({ goal } or { all: true }); steps: guide progress.
 */
function locks(starter, steps = {}) {
  if (!starter || starter.all || !STARTERS[starter.goal]) return {};
  const open = new Set(STARTERS[starter.goal].keys);
  const lockedBy = {};
  for (const guide of G.GUIDES) {
    for (const lesson of guide.lessons) {
      if (!lesson.unlocks) continue;
      const done = lesson.steps.every((s) => steps[s.id]);
      for (const key of lesson.unlocks) {
        if (done) open.add(key);
        else if (!lockedBy[key]) lockedBy[key] = lesson.title;
      }
    }
  }
  const out = {};
  for (const key of P.KEYS) if (!open.has(key)) out[key] = lockedBy[key] || 'the Control Pad lessons';
  return out;
}

const TIP_LIMIT = 3; // stop teaching a move once the fast way has been used this often
const TIP_GAP = 20000;

/**
 * The faster way for a window the owner just moved by hand, or null.
 * counts: { [region]: fast uses }. opener: words for how the pad opens.
 */
function tipFor({ region, app }, { pads, counts = {}, opener, locked = {}, voice = true }) {
  if (!region || (counts[region] || 0) >= TIP_LIMIT) return null;
  const key = P.KEYS.find((k) => pads[k].type === 'snap' && pads[k].region === region && !locked[k]);
  if (!key && !voice) return null;
  const who = app ? shortApp(app) : 'this';
  const say = voice ? `Hey computer, put ${who} on ${P.SAY_REGION[region]}` : '';
  const text = key ? `Next time: ${opener}, then ${key}.${say ? ` Or say “${say}”.` : ''}` : `Next time say “${say}”.`;
  return { region, key: key || null, say, text, opener, label: P.REGIONS[region].label };
}

const SHORT = { 'Google Chrome': 'Chrome', 'Visual Studio Code': 'VS Code' };
const shortApp = (app) => SHORT[app] || app;

/** Throttles tips: one at a time, never more often than every 20 seconds. */
class Tips {
  constructor(store, now = () => Date.now()) { this.store = store; this.now = now; this.last = -Infinity; }
  counts() { return { ...(this.store.tips().fast || {}) }; }
  /** The owner used the fast way for this region (a pad key or a voice snap). */
  used(region) {
    if (!region) return;
    const data = this.store.tips();
    const fast = { ...(data.fast || {}) };
    fast[region] = (fast[region] || 0) + 1;
    this.store.saveTips({ ...data, fast });
  }
  next(move, ctx) {
    if (this.now() - this.last < TIP_GAP) return null;
    const tip = tipFor(move, { ...ctx, counts: this.counts() });
    if (tip) this.last = this.now();
    return tip;
  }
}

/** One string per monitor setup: the same screens give the same signature. */
function signature(displays) {
  return displays.map((d) => `${d.bounds.x},${d.bounds.y},${d.bounds.width}x${d.bounds.height}`).sort().join('|');
}

const MAX_SNAPSHOTS = 4;
/** Keeps the latest windows for a monitor setup, newest setups first. */
function remember(data, sig, windows, at) {
  const snaps = (data.snapshots || []).filter((s) => s.sig !== sig);
  return { ...data, snapshots: [{ sig, at, windows }, ...snaps].slice(0, MAX_SNAPSHOTS) };
}
function snapshotFor(data, sig) { return (data.snapshots || []).find((s) => s.sig === sig) || null; }

module.exports = { STARTERS, GOALS, untouched, starterPads, locks, tipFor, Tips, TIP_LIMIT, signature, remember, snapshotFor };
