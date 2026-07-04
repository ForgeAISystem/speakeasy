'use strict';

const pill = document.getElementById('pill');
const wave = document.getElementById('wave');
const dots = document.getElementById('dots');
const check = document.getElementById('check');
const label = document.getElementById('label');
const ctx = wave.getContext('2d');

const BAR_COUNT = 12;
let levels = new Array(BAR_COUNT).fill(0.05);
let targetLevel = 0.05;
let state = 'hidden';
let recordStartedAt = 0;
let raf = null;

// ---- Sounds (generated, no audio files) ----
let audioCtx = null;
function blip(freqStart, freqEnd, durMs, gain = 0.06) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + durMs / 1000);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + durMs / 1000 + 0.02);
  } catch { /* sound is best-effort */ }
}

function draw() {
  ctx.clearRect(0, 0, wave.width, wave.height);
  const bw = 3.5;
  const gap = (wave.width - BAR_COUNT * bw) / (BAR_COUNT - 1);
  for (let i = 0; i < BAR_COUNT; i++) {
    const h = Math.max(3, levels[i] * wave.height);
    const x = i * (bw + gap);
    const y = (wave.height - h) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, h, 2);
    ctx.fill();
  }
}

function tick() {
  if (state === 'listening') {
    // Shift bars left, push a new bar driven by the live mic level with jitter
    levels.shift();
    const jitter = 0.75 + Math.random() * 0.5;
    levels.push(Math.min(1, 0.06 + targetLevel * 9 * jitter));
    draw();
    const secs = Math.floor((Date.now() - recordStartedAt) / 1000);
    const mm = String(Math.floor(secs / 60));
    const ss = String(secs % 60).padStart(2, '0');
    label.innerHTML = `<span class="accent">${mm}:${ss}</span>`;
  }
  raf = requestAnimationFrame(tick);
}

function setState(payload) {
  const prev = state;
  state = payload.state;
  const sounds = payload.sounds !== false;

  wave.style.display = 'none';
  dots.style.display = 'none';
  check.style.display = 'none';

  if (state === 'listening') {
    pill.classList.add('visible');
    wave.style.display = 'block';
    levels = new Array(BAR_COUNT).fill(0.05);
    recordStartedAt = Date.now();
    label.innerHTML = '<span class="accent">0:00</span>';
    if (sounds && prev !== 'listening') blip(660, 990, 90);
  } else if (state === 'processing') {
    pill.classList.add('visible');
    dots.style.display = 'inline-flex';
    label.textContent = 'Computing';
    if (sounds) blip(990, 660, 80);
  } else if (state === 'loading') {
    pill.classList.add('visible');
    dots.style.display = 'inline-flex';
    label.textContent = payload.message || 'Loading model';
  } else if (state === 'done') {
    pill.classList.add('visible');
    check.style.display = 'block';
    label.textContent = payload.words === 1 ? '1 word' : `${payload.words} words`;
    if (sounds) blip(520, 780, 110, 0.05);
  } else if (state === 'cancelled') {
    pill.classList.add('visible');
    label.textContent = 'Cancelled';
  } else if (state === 'error') {
    pill.classList.add('visible');
    label.textContent = payload.message || 'Error';
  } else {
    pill.classList.remove('visible');
  }
}

window.overlayBridge.onState(setState);
window.overlayBridge.onLevel((rms) => { targetLevel = rms; });

raf = requestAnimationFrame(tick);
