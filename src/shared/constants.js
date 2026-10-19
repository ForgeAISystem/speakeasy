'use strict';

// Model catalog. All models run 100% locally via sherpa-onnx.
// URLs point to the sherpa-onnx official model releases (github.com/k2-fsa/sherpa-onnx).
const MODELS = {
  'moonshine-base': {
    id: 'moonshine-base',
    label: 'Moonshine Base',
    tagline: 'Lightest English voice. Fast, less accurate. 240 MB download.',
    sizeMB: 240,
    languages: 'en',
    kind: 'moonshine',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-moonshine-base-en-int8.tar.bz2',
    dir: 'sherpa-onnx-moonshine-base-en-int8'
  },
  'parakeet-v2': {
    id: 'parakeet-v2',
    label: 'Parakeet 0.6B v2',
    tagline: 'Recommended. Best English accuracy, punctuation, and numbers. 460 MB download.',
    sizeMB: 460,
    languages: 'en',
    kind: 'nemo_transducer',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2',
    dir: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8'
  },
  'whisper-turbo': {
    id: 'whisper-turbo',
    label: 'Whisper Turbo (multilingual)',
    tagline: 'Best multilingual pick. 99 languages, strong on Hindi, Gujarati, Spanish. Fast. 540 MB download.',
    sizeMB: 540,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2',
    dir: 'sherpa-onnx-whisper-turbo'
  },
  'whisper-small': {
    id: 'whisper-small',
    label: 'Whisper Small (multilingual)',
    tagline: 'Lighter multilingual option. 99 languages. 610 MB download.',
    sizeMB: 610,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2',
    dir: 'sherpa-onnx-whisper-small'
  },
  'whisper-large-v3': {
    id: 'whisper-large-v3',
    label: 'Whisper Large v3 (multilingual)',
    tagline: 'Maximum accuracy across 99 languages. Slower on CPU. 1 GB download.',
    sizeMB: 1020,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-large-v3.tar.bz2',
    dir: 'sherpa-onnx-whisper-large-v3'
  },
  'whisper-base': {
    id: 'whisper-base',
    label: 'Whisper Base (multilingual)',
    tagline: 'Smallest multilingual option. 99 languages, lower accuracy. 200 MB download.',
    sizeMB: 200,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.tar.bz2',
    dir: 'sherpa-onnx-whisper-base'
  }
};

// Languages surfaced on the Home screen out of the box. Auto-detect covers all
// 99 Whisper languages; these are the ones we call out for Harsh's workflow.
const FEATURED_LANGUAGES = ['en', 'es', 'hi', 'gu'];

// Whisper language code -> display name. Covers the featured set plus the
// common ones offered in Settings, so detected-language readouts render nicely.
const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', hi: 'Hindi', gu: 'Gujarati',
  fr: 'French', de: 'German', pt: 'Portuguese', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', it: 'Italian', ru: 'Russian',
  ar: 'Arabic', pa: 'Punjabi', bn: 'Bengali', ta: 'Tamil',
  te: 'Telugu', mr: 'Marathi', ur: 'Urdu', nl: 'Dutch'
};

function languageName(code) {
  if (!code) return '';
  const c = String(code).replace(/[<|>]/g, '').trim().toLowerCase();
  return LANGUAGE_NAMES[c] || (c ? c.toUpperCase() : '');
}

const HOLD_KEYS = {
  Fn: { label: 'Fn', winLabel: 'Fn', macOnly: true },
  AltRight: { label: 'Right Option (⌥)', winLabel: 'Right Alt' },
  MetaRight: { label: 'Right Command (⌘)', winLabel: 'Right Win' },
  CtrlRight: { label: 'Right Control (⌃)', winLabel: 'Right Ctrl' },
  CtrlLeft: { label: 'Left Control (⌃)', winLabel: 'Left Ctrl' },
  F8: { label: 'F8', winLabel: 'F8' },
  F9: { label: 'F9', winLabel: 'F9' }
};

const DEFAULT_SETTINGS = {
  onboarded: false,
  userName: '',
  model: null,
  holdKey: process.platform === 'darwin' ? 'Fn' : 'CtrlRight',
  mode: 'hold', // 'hold' = press and hold, 'toggle' = tap to start/stop
  language: 'auto', // whisper models only
  micDeviceId: 'default',
  fillerRemoval: true,
  cleanupMode: null, // null preserves existing filler/provider preferences
  subtleMotion: true,
  sounds: true,
  restoreClipboard: true,
  launchAtLogin: false,
  polishProvider: 'off', // 'off' | 'ollama' | 'anthropic'
  polishOllamaModel: 'llama3.2',
  polishAnthropicKey: '',
  polishAnthropicModel: 'claude-haiku-5-5',
  organizeOnCommand: true, // say "organize my thoughts" to restructure a rambling dictation (needs an AI cleanup provider)
  matchAppStyle: true, // chat apps drop a lone final period; AI cleanup gets the app's writing style
  muteWhileDictating: false, // mute system audio while recording, restored afterwards
  padShortcut: 'Control+Option+P', // opens the Control Pad ('off' disables)
  voiceCommands: true, // hold fn with the pad open, or start with "Hey computer", to tell the Mac what to do
  padMicKey: true, // the microphone key (F5 on newer MacBooks) opens the Control Pad
  padTips: true, // after a window is moved by hand, show the pad key and words that do it faster
  padRestore: true, // when a monitor comes back, offer to put the windows back
  // padStarter: { goal } after the first-open question, { all: true } for all 16 keys (unset: ask)
  terminalMode: true, // terminals and Claude Code: straight quotes, no final period, new line = Shift+Return, never Return
  transforms: [], // rewrite what I selected: the user's own transforms [{ id, name, prompt }]
  globePrevious: undefined, // macOS Globe key setting before SpeakEasy's emoji fix, for Undo
  settingsVersion: 0 // one-time upgrades in main/index.js migrateSettings()
};

const MIN_RECORDING_SECONDS = 0.35;
const SAMPLE_RATE = 16000;

module.exports = {
  MODELS, HOLD_KEYS, DEFAULT_SETTINGS, MIN_RECORDING_SECONDS, SAMPLE_RATE,
  FEATURED_LANGUAGES, LANGUAGE_NAMES, languageName
};
