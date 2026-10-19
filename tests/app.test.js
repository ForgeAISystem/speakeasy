'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { DEFAULT_SETTINGS, MODELS, HOLD_KEYS } = require('../src/shared/constants');
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function fixture(t, opts = {}) {
  const root = path.join(__dirname, '../src/app');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const state = { settings: { ...DEFAULT_SETTINGS, onboarded: true, model: 'moonshine-base', cleanupMode: 'clean' },
    platform: 'darwin', version: '2.4.0', engine: { state: 'ready' }, permissions: { mic: 'granted', accessibility: true },
    shortcut: { ready: true }, models: { installed: ['moonshine-base'], downloads: {}, catalog: MODELS }, holdKeys: HOLD_KEYS,
    runtime: { captureReady: true, overlayReady: true, dictState: 'idle', phase: 'idle' },
    stats: { today: { words: 10, timeSavedSeconds: 3 }, allTime: { transcriptions: 2 } } };
  let rows = [{ id: 'a', ts: Date.now(), text: 'Meet at three.', raw: 'Um, meet at two, actually three.', app: 'Notes', speechSeconds: 5 },
    { id: 'b', ts: Date.now() - 86400000, failed: true, app: 'Mail', text: '', speechSeconds: 10 }];
  let snippets = [{ id: 's', trigger: 'signature', expansion: 'Harsh\nSpeakEasy' }];
  let dictionary = [{ id: 'd', word: 'SpeakEasy', misspelling: 'speak easy' }];
  const copies = [], saves = [];
  const pushes = [];
  const padStore = require('../src/shared/pad').defaultPads();
  let globe = { supported: true, value: null, opensPopup: true };
  const api = { getState: async () => structuredClone(state), historyList: async () => structuredClone(rows),
    updateSettings: async (value) => { saves.push(value); Object.assign(state.settings, value); return structuredClone(state); },
    copy: async (text) => copies.push(text), historyRemove: async (id) => { rows = rows.filter((r) => r.id !== id); },
    historyClear: async () => { rows = []; }, listMics: async () => [],
    snippetsList: async () => structuredClone(snippets), snippetsSave: async (value) => { snippets = value; },
    dictList: async () => structuredClone(dictionary), dictSave: async (value) => { dictionary = value; },
    onPush: (fn) => { pushes.push(fn); }, hideApp() {}, setupMode: async () => {},
    globeStatus: async () => ({ ...globe }),
    globeFix: async () => { saves.push('globe-fix'); globe = { ...globe, value: 0, opensPopup: false }; state.settings.globePrevious = 'unset'; return { ok: true }; },
    globeRestore: async () => { saves.push('globe-undo'); globe = { ...globe, value: null, opensPopup: true }; delete state.settings.globePrevious; return { ok: true }; },
    padGet: async () => ({ available: true, pads: structuredClone(padStore), shortcut: 'Control+Option+P', shortcutError: '' }),
    padSet: async (key, value) => { saves.push({ pad: key, value }); padStore[key] = value; return { ok: true, pads: structuredClone(padStore) }; },
    padPress: async (key) => { saves.push({ press: key }); return { ok: true }; },
    padSave: async (key) => { padStore[key] = { ...padStore[key], windows: [{ app: 'Notes', exec: '/x', x: 0, y: 25, w: 800, h: 900 }] }; return { ok: true, message: 'Saved 1 window' }; },
    padOpen: async () => true, padCamera: async () => ({ ok: true, on: true }),
    guideSummary: async () => {
      const { GuideRunner } = require('../src/main/guide');
      const runner = new GuideRunner({ store: { guide: () => guideData, saveGuide: (d) => { guideData = d; } } });
      return { guides: runner.summary(), fresh: opts.fresh || [], seen: '2.5.0', version: '2.7.0', active: { active: false } };
    },
    guideSeen: async () => { saves.push('guide-seen'); return true; },
    guideStart: async (id, mode) => { saves.push({ guide: id, mode }); return { active: true }; },
    guideStop: async () => true };
  let guideData = opts.guideData || {};
  api.testOverlay = async () => { saves.push('preview'); return { ok: true }; };
  api.repairDictation = async () => { saves.push('repair'); return { ok: true, state: structuredClone(state) }; };
  dom.window.speakeasy = api;
  dom.window.SpeakEasyMotion = { setEnabled() {} };
  for (const file of ['../shared/writing.js', '../shared/pad.js', '../pad/pad-ui.js', '../shared/guides.js', 'onboarding.js']) dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  // Classic scripts share one global scope in the browser; one eval keeps that true here.
  dom.window.eval(['app.js', 'pad-tab.js', 'learn-tab.js'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n'));
  await settle();
  const $ = (selector) => dom.window.document.querySelector(selector);
  const click = async (selector) => { assert.ok($(selector), selector); $(selector).click(); await settle(); };
  return { dom, $, click, state, copies, saves, push: (...args) => Promise.all(pushes.map((fn) => fn(...args))), snippets: () => snippets, rows: () => rows };
}

test('runtime check previews the indicator, repairs explicitly, and reports detected shortcut', async (t) => {
  const f = await fixture(t);
  await f.click('#runtime-test');
  assert.ok(f.saves.includes('preview'));
  await f.click('#runtime-repair');
  assert.ok(f.saves.includes('repair'));
  await f.push({ type: 'shortcut-key', key: 'Fn', down: true, at: Date.now() });
  assert.match(f.$('#runtime-key').textContent, /Shortcut detected/);
  await f.push({ type: 'dictation', phase: 'armed' });
  assert.equal(f.$('#engine-label').textContent, 'Listening');
  await f.push({ type: 'dictation', phase: 'processing' });
  assert.equal(f.$('#engine-label').textContent, 'Transcribing');
  await f.push({ type: 'dictation', phase: 'error', message: 'Microphone interrupted.' });
  assert.equal(f.$('#engine-label').textContent, 'Check dictation');
  assert.match(f.$('.runtime-error').textContent, /Microphone interrupted/);
  await f.push({ type: 'dictation', phase: 'done' });
  await f.push({ type: 'runtime', captureReady: false, overlayReady: true });
  assert.equal(f.$('#engine-label').textContent, 'Reconnecting');
});

test('original transcript stays recoverable and search matches words removed by cleanup', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab=history]');
  f.$('#hist-search').value = 'actually';
  f.$('#hist-search').dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(f.$('#hist-count').textContent, '1 dictation');
  await f.click('[data-action=copy-original]');
  assert.equal(f.copies[0], 'Um, meet at two, actually three.');
  assert.equal(f.rows()[0].text, 'Meet at three.');
  assert.equal(f.$('#hist-search').value, 'actually');
});

test('attention filter finds saved failures and clear all needs an explicit second click', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab=history]');
  await f.click('[data-filter=attention]');
  assert.equal(f.$('#hist-count').textContent, '1 dictation');
  assert.ok(f.$('.h-row.failed'));
  await f.click('#hist-clear');
  assert.equal(f.rows().length, 2);
  assert.equal(f.$('#hist-confirm').hidden, false);
  await f.click('#hist-cancel');
  assert.equal(f.rows().length, 2);
  await f.click('#hist-clear');
  await f.click('#hist-confirm-delete');
  assert.equal(f.rows().length, 0);
});

test('Polished routes to provider setup without silently changing the selected mode', async (t) => {
  const f = await fixture(t);
  await f.click('[data-writing=polished]');
  assert.equal(f.state.settings.cleanupMode, 'clean');
  assert.equal(f.$('.advanced-settings').open, true);
  assert.equal(f.dom.window.document.activeElement.id, 'set-polish');
  await f.click('[data-writing=original]');
  assert.equal(f.state.settings.cleanupMode, 'original');
});

test('snippets can be edited in place with paragraph breaks and literal markup preserved', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab=snippets]');
  await f.click('[data-edit-snip=s]');
  f.$('#snip-expansion').value = 'Harsh\n\n<script>literal text</script>\n$100';
  await f.click('#snip-add');
  assert.equal(f.snippets().length, 1);
  assert.equal(f.snippets()[0].id, 's');
  assert.equal(f.snippets()[0].expansion, 'Harsh\n\n<script>literal text</script>\n$100');
  assert.equal(f.$('#tab-snippets script'), null);
});

test('duplicate snippet triggers are blocked without losing the draft', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab=snippets]');
  f.$('#snip-trigger').value = 'SIGNATURE';
  f.$('#snip-expansion').value = 'Different';
  await f.click('#snip-add');
  assert.equal(f.snippets().length, 1);
  assert.equal(f.$('#snip-expansion').value, 'Different');
  assert.match(f.$('#toast').textContent, /already exists/);
});

test('Cmd+F opens local history and focuses the search field', async (t) => {
  const f = await fixture(t);
  f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'f', metaKey: true }));
  await settle();
  assert.equal(f.dom.window.document.activeElement.id, 'hist-search');
});

test('Fn users get a one-click fix for the emoji picker, with Undo in Settings', async (t) => {
  const f = await fixture(t);
  await settle();
  assert.match(f.$('#globe-banner').textContent, /emoji picker/);
  await f.click('#globe-banner [data-globe="fix"]');
  await settle();
  assert.ok(f.saves.includes('globe-fix'));
  assert.equal(f.$('#globe-banner').textContent, '');
  await f.click('[data-tab="settings"]');
  await settle();
  assert.match(f.$('#globe-row').textContent, /Fixed/);
  await f.click('#globe-row [data-globe="undo"]');
  await settle();
  assert.ok(f.saves.includes('globe-undo'));
  assert.ok(f.$('#globe-row [data-globe="fix"]'));
});

test('Pad tab shows all 16 pads, remaps a pad, saves a workflow and lights up live', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab="pad"]');
  await settle();
  assert.equal(f.dom.window.document.querySelectorAll('#pad-grid .pad-tile').length, 16);
  assert.match(f.$('#pad-grid .pad-tile[data-key="Q"]').textContent, /Top left/);
  await f.click('#pad-grid .pad-tile[data-key="V"]');
  const type = f.$('#pad-type');
  type.value = 'app';
  type.dispatchEvent(new f.dom.window.Event('change'));
  await settle(); await settle();
  const input = f.$('#pad-editor [data-field="app"]');
  input.value = 'Google Chrome';
  input.dispatchEvent(new f.dom.window.Event('change'));
  await settle();
  assert.equal(JSON.stringify(f.saves.at(-1)), JSON.stringify({ pad: 'V', value: { type: 'app', app: 'Google Chrome' } }));
  assert.match(f.$('#pad-grid .pad-tile[data-key="V"]').textContent, /Google Chrome/);
  await f.click('#pad-grid .pad-tile[data-key="1"]');
  await f.click('#pad-capture');
  await settle();
  assert.match(f.$('.pad-windows').textContent, /Notes/);
  await f.push({ type: 'pad', key: 'R', ok: true, message: 'Pick Record in the toolbar', label: 'Record screen', at: Date.now() });
  assert.ok(f.$('#pad-grid .pad-tile[data-key="R"]').classList.contains('ok'));
  assert.match(f.$('#pad-log').textContent, /Pick Record/);
});

test('Pad tab teaches voice commands and logs what was heard', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab="pad"]');
  await settle();
  assert.match(f.$('.voice-card').textContent, /Hey computer/);
  assert.match(f.$('.voice-card').textContent, /Add a Claude key/);
  const voice = f.$('#pad-voice');
  assert.equal(voice.checked, true);
  voice.checked = false;
  voice.dispatchEvent(new f.dom.window.Event('change'));
  await settle();
  assert.equal(JSON.stringify(f.saves.at(-1)), JSON.stringify({ voiceCommands: false }));
  await f.push({ type: 'pad', phase: 'plan', heard: 'put Chrome on the left', steps: ['Google Chrome to left half'], via: 'local', at: Date.now() });
  assert.match(f.$('#pad-log').textContent, /put Chrome on the left/);
});

test('after an update, a What is new card on Home lists the new features and starts the walkthrough oldest first', async (t) => {
  const f = await fixture(t, { fresh: ['voice-commands', 'control-pad'] });
  await settle(); await settle();
  assert.ok(f.$('#whats-new .wn-card'), 'What is new is a card on Home, not a pop-up');
  assert.match(f.$('#whats-new').textContent, /The Control Pad \+ Talk to your computer/);
  await f.click('[data-tab="history"]');
  await f.click('[data-tab="home"]');
  assert.ok(f.$('#whats-new .wn-card'), 'it survives switching tabs until answered');
  await f.click('#wn-go');
  await settle();
  assert.ok(f.saves.includes('guide-seen'));
  assert.equal(JSON.stringify(f.saves.at(-1)), JSON.stringify({ guide: 'control-pad', mode: 'lesson' }));
  assert.equal(f.$('#whats-new .wn-card'), null);
});

test('Learn tab shows every guide with progress, best level, and both ways in', async (t) => {
  const f = await fixture(t, { guideData: { steps: { 'cp-open': true, 'cp-left': true }, challenges: { 'control-pad': { seconds: 84, level: 'Operator' } } } });
  await f.click('[data-tab="learn"]');
  await settle();
  const cards = f.dom.window.document.querySelectorAll('.learn-card');
  assert.equal(cards.length, 4);
  const pad = f.$('.learn-card[data-guide="control-pad"]');
  assert.match(pad.textContent, /2 of 10 steps/);
  assert.match(pad.textContent, /Keep going/);
  assert.match(pad.textContent, /OPERATOR best 1:24/);
  assert.match(f.$('.learn-card[data-guide="voice-commands"]').textContent, /NEW IN 2.7.0/);
  await f.click('.learn-card[data-guide="voice-commands"] [data-learn="challenge"]');
  assert.equal(JSON.stringify(f.saves.at(-1)), JSON.stringify({ guide: 'voice-commands', mode: 'challenge' }));
  assert.ok(f.$('.nav-item[data-tab="learn"]').classList.contains('has-new'));
});

test('Settings: terminal mode switch, undo shortcut, and your own rewrite transforms', async (t) => {
  const f = await fixture(t);
  await f.click('[data-tab="settings"]');
  await settle();
  const term = f.$('#set-terminal');
  assert.equal(term.checked, true);
  term.checked = false;
  term.dispatchEvent(new f.dom.window.Event('change'));
  await settle();
  assert.equal(JSON.stringify(f.saves.at(-1)), JSON.stringify({ terminalMode: false }));
  assert.match(f.$('#edit-group').textContent, /Control\+Command\+Z/);
  assert.match(f.$('#edit-group').textContent, /Prompt Engineer/);
  await f.click('#transform-add');
  await settle();
  const row = f.$('.transform-item');
  row.querySelector('.t-name').value = 'Casual';
  row.querySelector('.t-prompt').value = 'Rewrite in a casual tone.';
  row.querySelector('.t-prompt').dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
  await settle();
  const saved = f.saves.at(-1).transforms;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Casual');
  assert.equal(saved[0].prompt, 'Rewrite in a casual tone.');
  await f.click('[data-action="transform-delete"]');
  await settle();
  assert.equal(f.saves.at(-1).transforms.length, 0);
});

test('History tags rewrites, terminal dictations, and undone edits', async (t) => {
  const f = await fixture(t);
  f.rows().unshift({ id: 'r', ts: Date.now(), text: 'Short.', raw: 'A much longer paragraph.', app: 'Notes', transform: 'Shorter', undone: true },
    { id: 'tm', ts: Date.now(), text: 'git status', raw: 'Git status.', app: 'iTerm2', terminal: true, speechSeconds: 2 });
  await f.click('[data-tab="history"]');
  await settle();
  const text = f.$('#hist-list').textContent;
  assert.match(text, /Shorter/);
  assert.match(text, /Undone/);
  assert.match(text, /Terminal/);
});
