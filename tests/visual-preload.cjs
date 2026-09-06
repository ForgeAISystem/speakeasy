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
contextBridge.exposeInMainWorld('speakeasy', {
  getState: async () => state, historyList: async () => rows,
  testOverlay: async () => ({ ok: true }), repairDictation: async () => ({ ok: true, state }),
  updateSettings: async (value) => { Object.assign(state.settings, value); return state; },
  onPush() {}, setupMode: async () => {}, listMics: async () => [],
  dictList: async () => [{ id: 'sample', word: 'SpeakEasy', misspelling: 'speak easy' }],
  snippetsList: async () => [{ id: 'sample', trigger: 'my signature', expansion: 'Harsh Patel\nSpeakEasy\nA little app. A lot less typing.' }]
});
