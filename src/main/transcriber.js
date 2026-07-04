'use strict';

const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { MODELS } = require('../shared/constants');
const { modelDir } = require('./models');

const WORKER = path.join(__dirname, '..', 'worker', 'transcribe-worker.js');

/** Directory holding the sherpa-onnx native libraries for this platform. */
function sherpaLibDir() {
  const pkg = `sherpa-onnx-${process.platform}-${process.arch}`;
  const candidates = [
    path.join(__dirname, '..', '..', 'node_modules', pkg),
    // packaged app: node_modules unpacked from asar
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'node_modules', pkg)
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

class TranscriberManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.loadedModelId = null;
    this.pending = new Map(); // id -> {resolve, reject}
    this.loadWaiters = new Map(); // loadId -> {resolve, reject}
    this.nextId = 1;
    this.loadSeq = 0; // latest load request; stale ready/error replies are ignored
    this.onStateChange = null; // cb(state: 'loading'|'ready'|'error', detail)
  }

  _spawn() {
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    const lib = sherpaLibDir();
    if (lib) {
      if (process.platform === 'darwin') env.DYLD_LIBRARY_PATH = lib + (env.DYLD_LIBRARY_PATH ? ':' + env.DYLD_LIBRARY_PATH : '');
      else if (process.platform === 'win32') env.PATH = lib + ';' + (env.PATH || '');
      else env.LD_LIBRARY_PATH = lib + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
    }
    console.log(`[transcriber] spawning worker (libs: ${lib || 'none found'})`);
    this.proc = fork(WORKER, [], { env, serialization: 'advanced', silent: true });
    this.proc.stdout && this.proc.stdout.on('data', (d) => console.log('[worker]', String(d).trim()));
    this.proc.stderr && this.proc.stderr.on('data', (d) => console.error('[worker]', String(d).trim()));

    this.proc.on('message', (msg) => this._onMessage(msg));
    this.proc.on('exit', (code) => {
      console.error(`[transcriber] worker exited (${code})`);
      this.ready = false;
      this.proc = null;
      const err = new Error('transcription engine crashed');
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
      for (const { reject } of this.loadWaiters.values()) reject(err);
      this.loadWaiters.clear();
      this._notify('error', 'engine crashed');
    });
  }

  _onMessage(msg) {
    if (msg.type === 'ready') {
      const waiter = this.loadWaiters.get(msg.loadId);
      if (waiter) this.loadWaiters.delete(msg.loadId);
      // Only the LATEST load request marks the engine ready; a stale ready
      // from a superseded model switch must not (the wrong model would win).
      if (msg.loadId === this.loadSeq) {
        this.ready = true;
        this._notify('ready');
      }
      if (waiter) waiter.resolve();
    } else if (msg.type === 'result') {
      const p = this.pending.get(msg.id);
      if (p) { this.pending.delete(msg.id); p.resolve({ text: msg.text, ms: msg.ms }); }
    } else if (msg.type === 'error') {
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p.reject(new Error(msg.message));
      } else if (msg.loadId && this.loadWaiters.has(msg.loadId)) {
        const waiter = this.loadWaiters.get(msg.loadId);
        this.loadWaiters.delete(msg.loadId);
        waiter.reject(new Error(msg.message));
      } else {
        this._notify('error', msg.message);
      }
    }
  }

  _notify(state, detail) {
    try { this.onStateChange && this.onStateChange(state, detail); } catch { /* noop */ }
  }

  /** Load (or switch to) a model. Resolves when the engine is ready. */
  load(modelId, language) {
    const m = MODELS[modelId];
    if (!m) return Promise.reject(new Error(`unknown model ${modelId}`));
    const dir = modelDir(modelId);
    if (!this.proc) this._spawn();
    this.ready = false;
    this.loadedModelId = modelId;
    const loadId = ++this.loadSeq;
    this._notify('loading');
    return new Promise((resolve, reject) => {
      this.loadWaiters.set(loadId, { resolve, reject });
      this.proc.send({ type: 'load', loadId, dir, kind: m.kind, language: language || 'auto', numThreads: 4 });
    });
  }

  /**
   * Transcribe Float32Array PCM at 16 kHz.
   * Times out (scaled to audio length) so the UI can never hang on "Computing".
   */
  transcribe(pcm, sampleRate = 16000) {
    if (!this.proc || !this.ready) return Promise.reject(new Error('engine not ready'));
    const id = this.nextId++;
    const audioSeconds = pcm.length / sampleRate;
    const timeoutMs = Math.max(30000, audioSeconds * 2000 + 30000);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error('transcription timed out'));
          // A wedged worker will not recover: restart it
          if (this.proc) { this.proc.kill(); }
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
      this.proc.send({ type: 'transcribe', id, sampleRate, pcm });
    });
  }

  dispose() {
    if (this.proc) { this.proc.kill(); this.proc = null; }
    this.ready = false;
  }
}

module.exports = { TranscriberManager };
