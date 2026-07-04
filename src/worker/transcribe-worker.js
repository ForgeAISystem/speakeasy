'use strict';

// Runs in a forked Node process (ELECTRON_RUN_AS_NODE). Loads sherpa-onnx once,
// then transcribes Float32Array PCM buffers sent from the main process.

const fs = require('fs');
const path = require('path');

let sherpa = null;
let recognizer = null;
let loadedKey = '';

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
    process.send({ type: 'ready', ms: 0 });
    return;
  }
  const config = buildConfig(msg.dir, msg.kind, msg.language || 'auto', msg.numThreads || 4);
  recognizer = new sherpa.OfflineRecognizer(config);
  loadedKey = key;
  process.send({ type: 'ready', ms: Date.now() - t0 });
}

function transcribe(msg) {
  const t0 = Date.now();
  if (!recognizer) throw new Error('model not loaded');
  const stream = recognizer.createStream();
  const samples = msg.pcm instanceof Float32Array ? msg.pcm : new Float32Array(msg.pcm);
  stream.acceptWaveform({ sampleRate: msg.sampleRate || 16000, samples });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  const text = (result && result.text ? result.text : '').trim();
  process.send({ type: 'result', id: msg.id, text, ms: Date.now() - t0 });
}

process.on('message', (msg) => {
  try {
    if (msg.type === 'load') load(msg);
    else if (msg.type === 'transcribe') transcribe(msg);
    else if (msg.type === 'ping') process.send({ type: 'pong' });
  } catch (e) {
    process.send({ type: 'error', id: msg.id, message: e.message || String(e) });
  }
});

process.send({ type: 'alive' });
