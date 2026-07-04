'use strict';

// Local audio fallback. Every dictation's PCM is written to disk before
// transcription and deleted on success. If transcription fails (or the app
// dies mid-processing), the WAV survives and shows up in History as a
// retryable entry. Nothing is ever lost to a crash or a wedged engine.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { SAMPLE_RATE } = require('../shared/constants');

function recordingsDir() {
  const dir = path.join(app.getPath('userData'), 'recordings');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function recordingPath(name) {
  return path.join(recordingsDir(), name);
}

/** Float32 PCM -> 16-bit mono WAV buffer. */
function pcmToWav(pcm, sampleRate = SAMPLE_RATE) {
  const dataLen = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

/** 16-bit mono WAV file -> Float32 PCM. */
function readRecordingPcm(file) {
  const buf = fs.readFileSync(file);
  const dataIdx = buf.indexOf('data');
  if (dataIdx < 0) throw new Error('not a valid recording');
  const dataLen = buf.readUInt32LE(dataIdx + 4);
  const start = dataIdx + 8;
  const n = Math.min(dataLen, buf.length - start) / 2;
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = buf.readInt16LE(start + i * 2) / 32768;
  return pcm;
}

/** Persist a recording. Returns the WAV's basename. */
function saveRecording(pcm) {
  const name = `rec-${Date.now()}.wav`;
  fs.writeFileSync(recordingPath(name), pcmToWav(pcm));
  return name;
}

function removeRecording(name) {
  if (!name) return;
  fs.rmSync(recordingPath(name), { force: true });
}

/** All saved recordings with metadata. */
function listRecordings() {
  try {
    return fs.readdirSync(recordingsDir())
      .filter((f) => f.endsWith('.wav'))
      .map((f) => {
        const st = fs.statSync(recordingPath(f));
        return { name: f, mtimeMs: st.mtimeMs, seconds: Math.max(0, (st.size - 44) / 2 / SAMPLE_RATE) };
      });
  } catch {
    return [];
  }
}

/** Delete recordings older than maxAgeDays (matches Wispr's 14-day window). */
function pruneRecordings(maxAgeDays = 14) {
  const cutoff = Date.now() - maxAgeDays * 86400000;
  for (const r of listRecordings()) {
    if (r.mtimeMs < cutoff) removeRecording(r.name);
  }
}

module.exports = { saveRecording, removeRecording, readRecordingPcm, recordingPath, listRecordings, pruneRecordings, pcmToWav };
