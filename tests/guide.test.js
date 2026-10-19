'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/shared/guides');
const { GuideRunner, toGuideEvent } = require('../src/main/guide');

function runner(opts = {}) {
  let data = opts.data || {};
  let now = 1000000;
  const views = [];
  const timers = [];
  const r = new GuideRunner({
    store: { guide: () => data, saveGuide: (d) => { data = JSON.parse(JSON.stringify(d)); } },
    onState: (v) => views.push(v), now: () => now,
    precheck: opts.precheck || (async () => false),
    timers: { setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {} }
  });
  return { r, views, data: () => data, advance: (ms) => { now += ms; }, flush: () => { while (timers.length) timers.shift()(); } };
}

test('every guide is well formed: unique step ids, checks, a challenge, a version', () => {
  const ids = new Set();
  for (const g of G.GUIDES) {
    assert.match(g.version, /^\d+\.\d+\.\d+$/);
    assert.ok(g.whatsNew.length >= 1 && g.challenge.tasks.length >= 3, g.id);
    for (const s of G.steps(g)) {
      assert.ok(!ids.has(s.id), s.id); ids.add(s.id);
      assert.ok(s.do && s.check && s.check.event, s.id);
    }
  }
});

test('checks match only the real action', () => {
  assert.ok(G.matches({ event: 'pad', key: 'A', ok: true }, { type: 'pad', key: 'A', ok: true, source: 'key' }));
  assert.ok(!G.matches({ event: 'pad', key: 'A', ok: true }, { type: 'pad', key: 'A', ok: false }));
  assert.ok(!G.matches({ event: 'pad', key: 'A', ok: true }, { type: 'pad', key: 'D', ok: true }));
  assert.ok(G.matches({ event: 'plan', minSteps: 2 }, { type: 'plan', steps: 3 }));
  assert.ok(!G.matches({ event: 'plan', minSteps: 2 }, { type: 'plan', steps: 1 }));
  assert.ok(G.matches({ event: 'dictation', phase: 'done', textHas: '\n' }, { type: 'dictation', phase: 'done', text: 'a\n\nb' }));
});

test('What is new lists only features newer than what you have seen', () => {
  assert.deepEqual(G.whatsNew('2.5.0', '2.7.0').map((g) => g.id), ['control-pad', 'voice-commands']);
  assert.deepEqual(G.whatsNew('2.6.0', '2.7.0').map((g) => g.id), ['voice-commands']);
  assert.deepEqual(G.whatsNew('2.7.0', '2.7.0'), []);
  assert.ok(G.newer('2.10.0', '2.9.9'));
});

test('a lesson waits for the real action, checks it off, saves progress, and moves on', async () => {
  const f = runner();
  await f.r.start('control-pad');
  assert.equal(f.r.view().step.id, 'cp-globe');
  f.r.onEvent({ type: 'pad-open' });
  assert.equal(f.r.view().status, 'waiting', 'out-of-order actions do not count');
  f.r.onEvent({ type: 'globe', fixed: true });
  assert.equal(f.r.view().status, 'done');
  assert.equal(f.data().steps['cp-globe'], true);
  f.flush();
  assert.equal(f.r.view().step.id, 'cp-open');
  f.r.onEvent({ type: 'pad-open' }); f.flush();
  f.r.onEvent({ type: 'pad', key: 'A', ok: false }); // a failed snap is not a pass
  assert.equal(f.r.view().step.id, 'cp-left');
  f.r.onEvent({ type: 'pad', key: 'A', ok: true }); f.flush();
  assert.equal(f.r.view().step.id, 'cp-right');
  f.r.back();
  assert.equal(f.r.view().step.id, 'cp-left');
});

test('steps that are already true finish themselves, and restarts resume where you left off', async () => {
  const f = runner({ precheck: async (name) => name === 'globeFixed' });
  await f.r.start('control-pad');
  assert.equal(f.r.view().status, 'done');
  f.flush();
  assert.equal(f.r.view().step.id, 'cp-open');
  f.r.stop();
  await f.r.start('control-pad');
  assert.equal(f.r.view().step.id, 'cp-open');
});

test('finishing the last step offers the challenge; skipping walks to the end', async () => {
  const f = runner();
  await f.r.start('voice-commands');
  for (let i = 0; i < 5; i++) f.r.next();
  assert.ok(f.r.view().finished);
  assert.equal(f.r.view().next.challenge, 'Hands off the mouse');
});

test('a challenge takes tasks in any order, times you, levels you, and keeps your best', async () => {
  const f = runner();
  await f.r.start('control-pad', 'challenge');
  assert.equal(f.r.view().tasks.length, 4);
  f.r.onEvent({ type: 'camera', on: true });
  f.r.onEvent({ type: 'pad', key: 'E', ok: true });
  f.r.onEvent({ type: 'pad', key: '1', ok: true });
  assert.equal(f.r.view().finished, null);
  f.advance(75000);
  f.r.onEvent({ type: 'pad', key: 'V', ok: true });
  const done = f.r.view().finished;
  assert.equal(done.seconds, 75);
  assert.equal(done.level, 'Operator');
  assert.equal(done.record, true);
  await f.r.start('control-pad', 'challenge');
  for (const ev of [{ type: 'camera', on: true }, { type: 'pad', key: 'E', ok: true }, { type: 'pad', key: '1', ok: true }]) f.r.onEvent(ev);
  f.advance(200000);
  f.r.onEvent({ type: 'pad', key: 'V', ok: true });
  assert.equal(f.r.view().finished.level, 'Learner');
  assert.equal(f.r.view().finished.record, false);
  assert.equal(f.data().challenges['control-pad'].seconds, 75);
  assert.equal(f.r.summary().find((g) => g.id === 'control-pad').challenge.best.level, 'Operator');
});

test('app pushes become guide events; voice runs do not double count as pad presses', () => {
  assert.deepEqual(toGuideEvent('pad', { phase: 'open' }), { type: 'pad-open' });
  assert.deepEqual(toGuideEvent('pad', { key: 'A', ok: true, source: 'key' }), { type: 'pad', key: 'A', ok: true, source: 'key' });
  assert.equal(toGuideEvent('pad', { key: 'V', ok: true, source: 'voice' }), null);
  assert.deepEqual(toGuideEvent('pad', { key: '1', ok: true, source: 'save' }), { type: 'pad-save', key: '1', ok: true });
  assert.deepEqual(toGuideEvent('pad', { phase: 'plan', steps: ['a', 'b'], wake: true, via: 'local' }), { type: 'plan', steps: 2, wake: true, via: 'local' });
  assert.deepEqual(toGuideEvent('dictation', { phase: 'done', words: 5, text: 'hi', handsFree: true }), { type: 'dictation', phase: 'done', words: 5, text: 'hi', handsFree: true });
  assert.equal(toGuideEvent('dictation', { phase: 'recording' }), null);
  assert.deepEqual(toGuideEvent('globe', { fixed: true }), { type: 'globe', fixed: true });
});
