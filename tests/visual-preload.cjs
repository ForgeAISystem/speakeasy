// Synthetic data for scripts/visual-check.cjs. Never packaged with the app.
const { contextBridge } = require('electron');
const { DEFAULT_SETTINGS, MODELS, HOLD_KEYS, LANGUAGE_NAMES } = require('../src/shared/constants');
const now = Date.now();
const state = {
  settings: { ...DEFAULT_SETTINGS, onboarded: true, model: 'moonshine-base', cleanupMode: 'clean' },
  platform: 'darwin', version: require('../package.json').version, installation: { needsMove: false },
  engine: { state: 'ready' }, permissions: { mic: 'granted', accessibility: true }, shortcut: { ready: true },
  runtime: { captureReady: true, overlayReady: true, dictState: 'idle', phase: 'idle' },
  holdKeys: HOLD_KEYS, languages: { names: LANGUAGE_NAMES },
  models: { installed: ['moonshine-base'], downloads: {}, catalog: MODELS },
  stats: { today: { words: 126, timeSavedSeconds: 143 }, allTime: { transcriptions: 12 } }
};
const rows = [
  { id: 'sample-1', ts: now, text: 'Let’s keep the first version simple. One clear idea, beautifully done.', raw: 'Um, let’s keep the first version simple. Uh, one clear idea, beautifully done.', app: 'Notes', speechSeconds: 7.4, lang: 'en' },
  { id: 'sample-2', ts: now - 1200000, text: 'I’ll send the updated proposal before our call tomorrow.', app: 'Mail', speechSeconds: 4.8, lang: 'en' },
  { id: 'sample-3', ts: now - 86400000, text: 'Three things for this week:\n\nA calmer morning. A little more space to think. Time for the work that matters.', app: 'Notes', speechSeconds: 11, lang: 'en' }
];
const P = require('../src/shared/pad');
const pads = P.defaultPads();
pads['1'] = { type: 'layout', label: 'Build day', windows: [{ app: 'Claude', exec: '/Applications/Claude.app/Contents/MacOS/Claude', x: 0, y: 25, w: 864, h: 1092 }, { app: 'Google Chrome', exec: '/x', x: 864, y: 25, w: 864, h: 1092 }] };
pads['2'] = { type: 'app', app: 'Google Chrome' };
pads['3'] = { type: 'url', label: 'Command Center', url: 'https://command.forgeaisystem.com' };
pads['4'] = { type: 'shortcut', name: 'Focus mode' };
pads.V = { type: 'text', label: 'Morning prompt', text: 'You are my chief of staff.' };
const { GuideRunner } = require('../src/main/guide');
let guideData = { steps: { 'cp-globe': true, 'cp-open': true, 'cp-left': true, 'cp-right': true }, challenges: { 'control-pad': { seconds: 84, level: 'Operator' } } };
const guideRunner = new GuideRunner({ store: { guide: () => guideData, saveGuide: (d) => { guideData = d; } } });
contextBridge.exposeInMainWorld('speakeasy', {
  guideSummary: async () => ({ guides: guideRunner.summary(), fresh: globalThis.__fresh || [], seen: '2.5.0', version: require('../package.json').version, active: { active: false } }),
  guideSeen: async () => true, guideStart: async () => ({ active: true }), guideStop: async () => true,
  globeStatus: async () => ({ supported: true, value: null, opensPopup: true }), globeFix: async () => ({ ok: true }), globeRestore: async () => ({ ok: true }),
  padGet: async () => ({ available: true, pads, shortcut: 'Control+Option+P', shortcutError: '' }),
  padSet: async (key, value) => { pads[key] = value; return { ok: true, pads }; }, padPress: async () => ({ ok: true }),
  padSave: async () => ({ ok: true, message: 'Saved' }), padOpen: async () => true, padCamera: async () => ({ ok: true }),
  getState: async () => state, historyList: async () => rows,
  testOverlay: async () => ({ ok: true }), repairDictation: async () => ({ ok: true, state }),
  updateSettings: async (value) => { Object.assign(state.settings, value); return state; },
  onPush() {}, setupMode: async () => {}, listMics: async () => [],
  dictList: async () => [{ id: 'sample', word: 'SpeakEasy', misspelling: 'speak easy' }],
  wisprImportPreview: async () => ({ available: true, words: 33, snippets: 1 }), wisprImport: async () => ({ ok: true, words: 33, snippets: 1 }),
  snippetsList: async () => [{ id: 'sample', trigger: 'my signature', expansion: 'Harsh Patel\nSpeakEasy\nA little app. A lot less typing.' }]
});
