'use strict';

// Runs in a forked Node process (ELECTRON_RUN_AS_NODE). Loads sherpa-onnx once,
// then transcribes Float32Array PCM buffers sent from the main process.

const fs = require('fs');
const path = require('path');

let sherpa = null;
let recognizer = null;
let loadedKey = '';
let loadedKind = '';

// Max audio (seconds) fed to the model in a single decode pass. Whisper's
// architecture hard-caps at ~30 s. Moonshine/Parakeet have no hard cap, but a
// multi-minute buffer in one shot blows up native memory and crashes the worker
// ("transcription engine crashed"), so every model is chunked at quiet points.
const MAX_SECONDS_BY_KIND = {
  whisper: 28,
  moonshine: 30,
  nemo_transducer: 60
};

function splitAtQuietPoints(samples, rate, maxSeconds) {
  const max = Math.floor(maxSeconds * rate);
  if (samples.length <= max) return [samples];
  const segments = [];
  let start = 0;
  while (samples.length - start > max) {
    const searchStart = start + Math.floor((maxSeconds - 8) * rate);
    const searchEnd = start + max;
    const win = Math.floor(0.2 * rate); // 200 ms energy windows
    let best = searchEnd;
    let bestEnergy = Infinity;
    for (let i = searchStart; i + win < searchEnd; i += win) {
      let e = 0;
      for (let j = i; j < i + win; j++) e += samples[j] * samples[j];
      if (e < bestEnergy) { bestEnergy = e; best = i + Math.floor(win / 2); }
    }
    segments.push(samples.subarray(start, best));
    start = best;
  }
  segments.push(samples.subarray(start));
  return segments;
}

function findFile(dir, patterns, { preferInt8 = true } = {}) {
  const files = fs.readdirSync(dir);
  const matches = files.filter((f) => patterns.some((p) => f.toLowerCase().includes(p)));
  if (!matches.length) return null;
  if (preferInt8) {
    const int8 = matches.find((f) => f.includes('int8'));
    if (int8) return path.join(dir, int8);
  }
  const plain = matches.find((f) => !f.includes('int8'));
  return path.join(dir, plain || matches[0]);
}

function buildConfig(dir, kind, language, numThreads) {
  const tokensTxt = findFile(dir, ['tokens'], { preferInt8: false });
  const base = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: { tokens: tokensTxt, numThreads, provider: 'cpu', debug: 0 }
  };

  if (kind === 'whisper') {
    base.modelConfig.whisper = {
      encoder: findFile(dir, ['encoder']),
      decoder: findFile(dir, ['decoder']),
      language: language === 'auto' ? '' : language,
      task: 'transcribe',
      tailPaddings: -1
    };
  } else if (kind === 'moonshine') {
    base.modelConfig.moonshine = {
      preprocessor: findFile(dir, ['preprocess']),
      encoder: findFile(dir, ['encode'], { preferInt8: true }),
      uncachedDecoder: findFile(dir, ['uncached_decode']),
      cachedDecoder: findFile(dir, ['cached_decode'])
    };
  } else if (kind === 'nemo_transducer') {
    base.modelConfig.transducer = {
      encoder: findFile(dir, ['encoder']),
      decoder: findFile(dir, ['decoder']),
      joiner: findFile(dir, ['joiner'])
    };
    base.modelConfig.modelType = 'nemo_transducer';
  } else {
    throw new Error(`unknown model kind: ${kind}`);
  }
  return base;
}

function load(msg) {
  const t0 = Date.now();
  if (!sherpa) sherpa = require('sherpa-onnx-node');
  const key = `${msg.dir}|${msg.language}`;
  if (recognizer && loadedKey === key) {
    process.send({ type: 'ready', loadId: msg.loadId, ms: 0 });
    return;
  }
  const config = buildConfig(msg.dir, msg.kind, msg.language || 'auto', msg.numThreads || 4);
  recognizer = new sherpa.OfflineRecognizer(config);
  loadedKey = key;
  loadedKind = msg.kind;
  process.send({ type: 'ready', loadId: msg.loadId, ms: Date.now() - t0 });
}

function decodeOne(samples, sampleRate) {
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate, samples });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  // Whisper auto-detect reports the spoken language (e.g. "en", "<|hi|>").
  const lang = result && result.lang ? String(result.lang).replace(/[<|>]/g, '').trim() : '';
  return { text: (result && result.text ? result.text : '').trim(), lang };
}

function transcribe(msg) {
  const t0 = Date.now();
  if (!recognizer) throw new Error('model not loaded');
  const rate = msg.sampleRate || 16000;
  const samples = msg.pcm instanceof Float32Array ? msg.pcm : new Float32Array(msg.pcm);
  const maxSeconds = MAX_SECONDS_BY_KIND[loadedKind] || 30;
  const parts = splitAtQuietPoints(samples, rate, maxSeconds);
  const decoded = parts.map((p) => decodeOne(p, rate));
  const text = decoded.map((d) => d.text).filter(Boolean).join(' ').trim();
  const lang = (decoded.find((d) => d.lang) || {}).lang || '';
  process.send({ type: 'result', id: msg.id, text, lang, ms: Date.now() - t0 });
}

process.on('message', (msg) => {
  try {
    if (msg.type === 'load') load(msg);
    else if (msg.type === 'transcribe') transcribe(msg);
    else if (msg.type === 'ping') process.send({ type: 'pong' });
  } catch (e) {
    process.send({ type: 'error', id: msg.id, loadId: msg.loadId, message: e.message || String(e) });
  }
});

process.send({ type: 'alive' });
