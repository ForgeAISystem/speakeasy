// A generated-speech smoke check, never a microphone or OS paste test.
// node scripts/engine-smoke.cjs /absolute/path/to/installed/model [catalog-model-id]
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const model = process.argv[2];
const modelId = process.argv[3] || 'moonshine-base';
const catalog = require('../src/shared/constants').MODELS;
if (!model || !fs.existsSync(model) || !catalog[modelId]) throw new Error('Supply an installed model directory and a valid catalog model id.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'speakeasy-speech-'));
const expected = 'This is a test of local dictation. My words should appear clearly.';
const aiff = path.join(temp, 'speech.aiff'), wav = path.join(temp, 'speech.wav');
execFileSync('/usr/bin/say', ['-o', aiff, expected]);
execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
const bytes = fs.readFileSync(wav);
let data;
for (let offset = 12; offset + 8 <= bytes.length;) {
  const size = bytes.readUInt32LE(offset + 4);
  if (bytes.toString('ascii', offset, offset + 4) === 'data') { data = bytes.subarray(offset + 8, offset + 8 + size); break; }
  offset += 8 + size + size % 2;
}
if (!data) throw new Error('Generated WAV has no audio.');
const pcm = Float32Array.from({ length: data.length / 2 }, (_, index) => data.readInt16LE(index * 2) / 32768);
// The isolated harness reads existing model files without using a personal profile.
require('../src/main/models').modelDir = () => model;
const { TranscriberManager } = require('../src/main/transcriber');
const manager = new TranscriberManager();
(async () => {
  const results = [];
  try {
    for (let round = 0; round < 2; round++) {
      await manager.load(modelId, 'en');
      const result = await manager.transcribe(pcm, 16000);
      const workerRssKiB = Number(execFileSync('/bin/ps', ['-o', 'rss=', '-p', String(manager.proc.pid)], { encoding: 'utf8' }).trim());
      const words = new Set(result.text.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/));
      results.push({ afterWorkerRestart: round === 1, ...result, workerRssMiB: Math.round(workerRssKiB / 1024),
        passed: ['test', 'local', 'dictation', 'words', 'appear', 'clearly'].every((word) => words.has(word)) });
      manager.dispose();
    }
    const report = { fixture: `Generated speech through the real TranscriberManager and native ${catalog[modelId].label} worker. No microphone, shortcut, or OS paste. Memory is a worker RSS snapshot after decoding, not peak use.`, modelId, expected, seconds: pcm.length / 16000, results };
    const out = path.join(__dirname, '..', 'docs/verification', 'v' + require('../package.json').version);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, modelId === 'moonshine-base' ? 'engine-check.json' : `engine-${modelId}-check.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } finally {
    manager.dispose();
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
