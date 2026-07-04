'use strict';

// Model catalog. All models run 100% locally via sherpa-onnx.
// URLs point to the sherpa-onnx official model releases (github.com/k2-fsa/sherpa-onnx).
const MODELS = {
  'moonshine-base': {
    id: 'moonshine-base',
    label: 'Moonshine Base',
    tagline: 'Fast start. English only. 240 MB download.',
    sizeMB: 240,
    languages: 'en',
    kind: 'moonshine',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-moonshine-base-en-int8.tar.bz2',
    dir: 'sherpa-onnx-moonshine-base-en-int8'
  },
  'parakeet-v2': {
    id: 'parakeet-v2',
    label: 'Parakeet 0.6B v2',
    tagline: 'Best accuracy. English only. 460 MB download.',
    sizeMB: 460,
    languages: 'en',
    kind: 'nemo_transducer',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2',
    dir: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8'
  },
  'whisper-base': {
    id: 'whisper-base',
    label: 'Whisper Base',
    tagline: 'Multilingual. 99 languages. 200 MB download.',
    sizeMB: 200,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.tar.bz2',
    dir: 'sherpa-onnx-whisper-base'
  },
  'whisper-small': {
    id: 'whisper-small',
    label: 'Whisper Small',
    tagline: 'Multilingual, more accurate. 99 languages. 610 MB download.',
    sizeMB: 610,
    languages: 'multi',
    kind: 'whisper',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2',
    dir: 'sherpa-onnx-whisper-small'
  }
};

const HOLD_KEYS = {
  AltRight: { label: 'Right Option (⌥)', winLabel: 'Right Alt' },
  MetaRight: { label: 'Right Command (⌘)', winLabel: 'Right Win' },
  CtrlRight: { label: 'Right Control (⌃)', winLabel: 'Right Ctrl' },
  CtrlLeft: { label: 'Left Control (⌃)', winLabel: 'Left Ctrl' },
  F8: { label: 'F8', winLabel: 'F8' },
  F9: { label: 'F9', winLabel: 'F9' }
};

const DEFAULT_SETTINGS = {
  onboarded: false,
  model: null,
  holdKey: process.platform === 'darwin' ? 'AltRight' : 'CtrlRight',
  mode: 'hold', // 'hold' = press and hold, 'toggle' = tap to start/stop
  language: 'auto', // whisper models only
  micDeviceId: 'default',
  fillerRemoval: true,
  sounds: true,
  restoreClipboard: true,
  launchAtLogin: false,
  polishProvider: 'off', // 'off' | 'ollama' | 'anthropic'
  polishOllamaModel: 'llama3.2',
  polishAnthropicKey: '',
  polishAnthropicModel: 'claude-haiku-4-5'
};

const MIN_RECORDING_SECONDS = 0.35;
const SAMPLE_RATE = 16000;

module.exports = { MODELS, HOLD_KEYS, DEFAULT_SETTINGS, MIN_RECORDING_SECONDS, SAMPLE_RATE };
