'use strict';

// Hidden window: microphone capture at 16 kHz mono via AudioWorklet.
// Streams Float32Array chunks + RMS level to the main process while recording.

let audioCtx = null;
let stream = null;
let workletNode = null;

const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = [];
    this.len = 0;
    this.CHUNK = 1600; // 100 ms at 16 kHz
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      this.buf.push(new Float32Array(ch));
      this.len += ch.length;
      if (this.len >= this.CHUNK) {
        const out = new Float32Array(this.len);
        let o = 0;
        for (const b of this.buf) { out.set(b, o); o += b.length; }
        this.buf = [];
        this.len = 0;
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

async function start(opts) {
  try {
    if (stream) await stop();
    const constraints = {
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
    if (opts && opts.deviceId && opts.deviceId !== 'default') {
      constraints.audio.deviceId = { exact: opts.deviceId };
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (constraints.audio.deviceId) {
        // Saved mic unplugged: fall back to system default instead of failing
        delete constraints.audio.deviceId;
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        throw e;
      }
    }

    audioCtx = new AudioContext({ sampleRate: 16000 });
    const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source = audioCtx.createMediaStreamSource(stream);
    workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture');
    workletNode.port.onmessage = (e) => {
      const pcm = e.data;
      let sum = 0;
      for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
      const rms = Math.sqrt(sum / pcm.length);
      window.captureBridge.sendChunk(pcm, rms);
    };
    source.connect(workletNode);
    // Do not connect to destination: capture only, no monitoring
  } catch (e) {
    window.captureBridge.sendError(e.message || String(e));
  }
}

async function stop() {
  try {
    if (workletNode) { workletNode.port.onmessage = null; workletNode.disconnect(); workletNode = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (audioCtx) { await audioCtx.close(); audioCtx = null; }
  } finally {
    window.captureBridge.sendStopped();
  }
}

window.captureBridge.onStart(start);
window.captureBridge.onStop(stop);

window.captureBridge.onListMics(async (reqId) => {
  try {
    // Ensure labels are populated (needs a granted mic permission at least once)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }));
    window.captureBridge.sendMics(reqId, mics);
  } catch {
    window.captureBridge.sendMics(reqId, []);
  }
});

// ---- Tray icon generation (canvas -> dataURL, no binary assets needed) ----
function drawTrayIcon(color, { dot = false, hollow = false } = {}) {
  const S = 44; // 22pt @2x
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  // Three rounded waveform bars
  const bars = [
    { x: 8, h: 16 },
    { x: 19, h: 28 },
    { x: 30, h: 12 }
  ];
  for (const b of bars) {
    const w = 6;
    const y = (S - b.h) / 2;
    ctx.beginPath();
    if (hollow) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.roundRect(b.x + 1, y + 1, w - 2, b.h - 2, 3);
      ctx.stroke();
    } else {
      ctx.roundRect(b.x, y, w, b.h, 3);
      ctx.fill();
    }
  }
  if (dot) {
    ctx.beginPath();
    ctx.fillStyle = '#e5484d';
    ctx.arc(S - 7, 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL('image/png');
}

window.captureBridge.onGenIcons(() => {
  window.captureBridge.sendIcons({
    idle: drawTrayIcon('#000000'),          // template image (mac adapts light/dark)
    recording: drawTrayIcon('#000000', { dot: true }),
    processing: drawTrayIcon('#000000', { hollow: true })
  });
});
