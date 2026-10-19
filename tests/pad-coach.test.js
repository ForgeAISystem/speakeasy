'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/shared/pad');
const C = require('../src/main/commands');
const coach = require('../src/main/pad-coach');
const G = require('../src/shared/guides');
const { toGuideEvent } = require('../src/main/guide');

const apps = ['Claude', 'Google Chrome', 'Notes', 'Slack', 'Terminal', 'Visual Studio Code'];

test('every key on the cheat sheet has words, and those words run that same key', () => {
  const pads = P.defaultPads();
  pads['1'] = { type: 'layout', label: 'Build day', windows: [{ app: 'Claude' }] };
  pads['2'] = { type: 'app', app: 'Google Chrome' };
  pads['3'] = { type: 'url', url: 'https://claude.ai/new' };
  pads['4'] = { type: 'url', label: 'Command Center', url: 'https://command.forgeaisystem.com' };
  pads.F = { type: 'shortcut', name: 'Focus' };
  pads.V = { type: 'text', label: 'Morning prompt', text: 'Hi' };
  pads.W = { type: 'keys', keys: 'cmd+shift+4' };
  const ctx = { pads, apps };
  for (const key of P.KEYS) {
    const say = P.phrase(key, pads[key]);
    assert.ok(say, `pad ${key} has words`);
    const [step] = C.planLocally(say, ctx);
    const pad = pads[key];
    if (pad.type === 'snap') assert.deepEqual(step, { do: 'snap', app: 'front', region: pad.region }, say);
    else if (pad.type === 'record') assert.equal(step.do, 'record');
    else if (pad.type === 'camera') assert.equal(step.do, 'camera');
    else if (pad.type === 'app') assert.deepEqual(step, { do: 'pad', key }, say); // the pad named Google Chrome
    else if (pad.type === 'url' && !pad.label) assert.deepEqual(step, { do: 'open_url', url: 'https://claude.ai/new' }, say);
    else if (pad.type === 'shortcut') assert.deepEqual(step, { do: 'shortcut', name: 'Focus' }, say);
    else assert.deepEqual(step, { do: 'pad', key }, say);
  }
  // An empty workflow says how to fill it.
  assert.equal(P.phrase('2', P.defaultPads()['2']), 'save this layout as Workflow 2');
  assert.deepEqual(C.planLocally('save this layout as Workflow 2', ctx), [{ do: 'save_layout', name: 'Workflow 2' }]);
  assert.equal(P.phrase('Q', { type: 'none' }), '');
});

test('a hand-placed window counts as a region only when it fills one', () => {
  const area = { x: 0, y: 25, width: 1728, height: 1092 };
  assert.equal(P.matchRegion({ x: 4, y: 30, width: 860, height: 1080 }, area), 'left');
  assert.equal(P.matchRegion({ x: 0, y: 25, width: 1728, height: 1092 }, area), 'full');
  assert.equal(P.matchRegion({ x: 870, y: 25, width: 858, height: 546 }, area), 'top-right');
  assert.equal(P.matchRegion({ x: 300, y: 200, width: 700, height: 500 }, area), null);
  assert.equal(P.matchRegion(null, area), null);
});

test('a new pad shows four keys and each finished lesson unlocks more', () => {
  const locked = coach.locks({ goal: 'windows' }, {});
  assert.deepEqual(P.KEYS.filter((k) => !locked[k]), ['1', 'A', 'S', 'D']);
  assert.equal(locked.Q, 'Snap windows');
  assert.equal(locked.R, 'Save your setup');
  assert.equal(locked.V, 'Record');
  // Every lesson the starter pad needs uses only keys that are already open by then.
  const snaps = { 'cp-open': true, 'cp-left': true, 'cp-right': true, 'cp-full': true };
  const afterSnaps = coach.locks({ goal: 'prompts' }, snaps);
  assert.ok(!afterSnaps.Q && !afterSnaps['1'] && !afterSnaps.V && afterSnaps.R);
  const all = { ...snaps, 'cp-save': true, 'cp-restore': true, 'cp-rec': true, 'cp-cam': true };
  assert.deepEqual(coach.locks({ goal: 'recording' }, all), {});
  assert.deepEqual(coach.locks({ all: true }, {}), {});
  assert.deepEqual(coach.locks(undefined, {}), {});
  // All 16 keys are covered by a starter set or a lesson.
  const covered = new Set(G.GUIDES.flatMap((g) => g.lessons.flatMap((l) => l.unlocks || [])));
  for (const goal of coach.GOALS) for (const k of coach.STARTERS[goal].keys) covered.add(k);
  assert.equal(covered.size, 16);
});

test('the Apps and links starter fills pad 2 only on a factory pad', () => {
  const filled = coach.starterPads('apps', P.defaultPads(), apps);
  assert.deepEqual(filled['2'], { type: 'app', app: 'Google Chrome' });
  const mine = P.defaultPads();
  mine['2'] = { type: 'url', url: 'https://x.com' };
  assert.deepEqual(coach.starterPads('apps', mine, apps)['2'], { type: 'url', url: 'https://x.com' });
  assert.equal(coach.untouched({}), true);
  assert.equal(coach.untouched({ A: { type: 'snap', region: 'left' } }), false);
});

test('a tip names the pad key and the words, and stops after three fast uses', () => {
  const pads = P.defaultPads();
  const tip = coach.tipFor({ region: 'left', app: 'Google Chrome' }, { pads, opener: 'tap the mic key' });
  assert.equal(tip.key, 'A');
  assert.equal(tip.text, 'Next time: tap the mic key, then A. Or say “Hey computer, put Chrome on the left”.');
  assert.deepEqual(C.planLocally(C.wakeCommand(tip.say), { pads, apps }), [{ do: 'snap', app: 'Google Chrome', region: 'left' }]);
  assert.equal(coach.tipFor({ region: 'left' }, { pads, opener: 'x', counts: { left: 3 } }), null);
  // A locked key is never taught; voice still is.
  assert.equal(coach.tipFor({ region: 'top-left' }, { pads, opener: 'x', locked: { Q: 'Snap windows' } }).key, null);
  assert.equal(coach.tipFor({ region: 'top-left' }, { pads, opener: 'x', locked: { Q: 'Snap windows' }, voice: false }), null);

  let data = {};
  let now = 0;
  const tips = new coach.Tips({ tips: () => data, saveTips: (d) => { data = d; } }, () => now);
  assert.ok(tips.next({ region: 'right' }, { pads, opener: 'x' }));
  now += 5000;
  assert.equal(tips.next({ region: 'right' }, { pads, opener: 'x' }), null, 'one tip per 20 seconds');
  for (let i = 0; i < 3; i++) tips.used('right');
  now += 30000;
  assert.equal(tips.next({ region: 'right' }, { pads, opener: 'x' }), null, 'learned: no more tips');
  assert.ok(tips.next({ region: 'left' }, { pads, opener: 'x' }), 'other moves still get tips');
});

test('screen snapshots are kept per monitor setup', () => {
  const two = [{ bounds: { x: 0, y: 0, width: 1728, height: 1117 } }, { bounds: { x: 1728, y: 0, width: 2560, height: 1440 } }];
  const sig = coach.signature(two);
  assert.equal(sig, coach.signature([...two].reverse()));
  let data = coach.remember({}, sig, [{ app: 'Notes' }], 1);
  data = coach.remember(data, 'other', [{ app: 'Mail' }], 2);
  data = coach.remember(data, sig, [{ app: 'Claude' }], 3);
  assert.equal(data.snapshots.length, 2);
  assert.deepEqual(coach.snapshotFor(data, sig).windows, [{ app: 'Claude' }]);
  assert.equal(coach.snapshotFor(data, 'nope'), null);
});

test('the new teaching events reach the walkthroughs', () => {
  assert.deepEqual(toGuideEvent('pad', { phase: 'peek' }), { type: 'pad-peek' });
  assert.deepEqual(toGuideEvent('pad', { phase: 'starter', goal: 'apps' }), { type: 'pad-starter', goal: 'apps' });
  assert.deepEqual(toGuideEvent('pad', { phase: 'tip', region: 'left' }), { type: 'pad-tip', region: 'left' });
  assert.deepEqual(toGuideEvent('pad', { phase: 'layout-restore', ok: true, source: 'monitor' }), { type: 'layout-restore', ok: true, source: 'monitor' });
  assert.equal(toGuideEvent('pad', { phase: 'saved', key: '2', ok: true }), null);
  // Every 2.9 guide check uses an event the app emits.
  const known = new Set(['pad-open', 'pad', 'pad-save', 'pad-set', 'plan', 'voice-step', 'camera', 'dictation', 'globe', 'pad-peek', 'pad-starter', 'pad-tip', 'layout-restore']);
  for (const g of G.GUIDES) {
    for (const s of G.steps(g)) assert.ok(known.has(s.check.event), s.id);
    for (const t of g.challenge.tasks) assert.ok(known.has(t.check.event), t.id);
  }
  assert.deepEqual(G.whatsNew('2.8.0', '2.9.0').map((g) => g.id).sort(), ['pad-coach', 'say-it-your-way']);
});
