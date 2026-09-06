'use strict';

const pill = document.getElementById('pill');
const wave = document.getElementById('wave');
const spinner = document.getElementById('spinner');
const check = document.getElementById('check');
const label = document.getElementById('label');
const ctx = wave.getContext('2d');

const BAR_COUNT = 15;              // odd, so there is a true center bar
const CENTER = (BAR_COUNT - 1) / 2;
let displayed = new Array(BAR_COUNT).fill(0.06); // eased heights actually drawn
let targetLevel = 0.05;           // latest mic RMS
let smoothLevel = 0.05;           // eased loudness envelope
let state = 'hidden';
let recordStartedAt = 0;
let raf = null;

// Gold vertical gradient reused every frame (cheap, canvas is tiny).
const grad = ctx.createLinearGradient(0, 0, 0, wave.height);
grad.addColorStop(0, '#ffd9a6');
grad.addColorStop(0.5, '#ffb867');
grad.addColorStop(1, '#ff9a3c');

// ---- Rotating processing words -------------------------------------------
const WORDS = {
  transcribe: ['Transcribing', 'Thinking', 'Listening back', 'Making sense', 'Almost there'],
  refine: ['Organizing', 'Structuring', 'Polishing', 'Tidying up', 'Cleaning it up']
};
let wordSet = 'transcribe';
let wordIdx = 0;
let wordTimer = null;

function showWord() {
  const list = WORDS[wordSet] || WORDS.transcribe;
  label.textContent = list[wordIdx % list.length];
  label.classList.remove('swap');
  void label.offsetWidth; // restart the swap animation
  label.classList.add('swap');
}
function startWords(set) {
  wordSet = set;
  wordIdx = 0;
  showWord();
  clearInterval(wordTimer);
  wordTimer = setInterval(() => { wordIdx += 1; showWord(); }, 1150);
}
function stopWords() { clearInterval(wordTimer); wordTimer = null; }

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

// ---- Waveform ------------------------------------------------------------
// Symmetric bars emanating from the center. A slow travelling sine keeps the
// shape alive even at steady volume; a center-weighted envelope makes it read
// as a single fluid form; per-frame easing removes the jitter.
function draw(now) {
  ctx.clearRect(0, 0, wave.width, wave.height);
  const bw = 3;
  const gap = (wave.width - BAR_COUNT * bw) / (BAR_COUNT - 1);
  const t = now / 1000;
  const loud = smoothLevel;
  ctx.fillStyle = grad;
  for (let i = 0; i < BAR_COUNT; i++) {
    const dist = Math.abs(i - CENTER) / CENTER;        // 0 center .. 1 edges
    const envelope = 0.35 + 0.65 * Math.cos(dist * 1.35); // center-weighted
    const flow = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.55);  // travelling wave
    const idle = 0.05 + 0.03 * Math.sin(t * 2.2 + i);     // gentle breathing
    // Target height for this bar this frame, driven by mic loudness.
    const target = Math.min(1, idle + loud * 9 * envelope * (0.45 + 0.55 * flow));
    // Ease toward the target so motion stays fluid, not steppy.
    displayed[i] += (target - displayed[i]) * 0.35;
    const h = Math.max(2.5, displayed[i] * wave.height);
    const x = i * (bw + gap);
    const y = (wave.height - h) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, h, 1.6);
    ctx.fill();
  }
}

function tick(now) {
  if (state === 'listening') {
    // Ease the loudness envelope toward the live mic level.
    smoothLevel += (targetLevel - smoothLevel) * 0.25;
    draw(now || performance.now());
    const secs = Math.floor((Date.now() - recordStartedAt) / 1000);
    const mm = String(Math.floor(secs / 60));
    const ss = String(secs % 60).padStart(2, '0');
    label.innerHTML = `<span class="accent">${mm}:${ss}</span>`;
  }
  raf = requestAnimationFrame(tick);
}

function setState(payload) {
  state = payload.state;
  const sounds = payload.sounds !== false;

  wave.style.display = 'none';
  spinner.style.display = 'none';
  check.style.display = 'none';
  label.classList.remove('swap');

  if (state === 'listening') {
    stopWords();
    pill.classList.add('visible');
    wave.style.display = 'block';
    displayed = new Array(BAR_COUNT).fill(0.06);
    smoothLevel = 0.05;
    recordStartedAt = Date.now();
    label.innerHTML = '<span class="accent">0:00</span>';
    // The "go" ping plays on overlay:armed, when the mic is actually live
  } else if (state === 'processing') {
    pill.classList.add('visible');
    spinner.style.display = 'block';
    // 'refine' = the AI polish / organize pass; default = transcription.
    startWords(payload.phase === 'refine' ? 'refine' : 'transcribe');
    if (sounds && payload.phase !== 'refine') blip(990, 660, 80);
  } else if (state === 'loading') {
    stopWords();
    pill.classList.add('visible');
    spinner.style.display = 'block';
    label.textContent = payload.message || 'Loading model';
  } else if (state === 'done') {
    stopWords();
    pill.classList.add('visible');
    check.style.display = 'block';
    label.textContent = payload.words === 1 ? '1 word' : `${payload.words} words`;
    if (sounds) blip(520, 780, 110, 0.05);
  } else if (state === 'cancelled') {
    stopWords();
    pill.classList.add('visible');
    label.textContent = 'Cancelled';
  } else if (state === 'error') {
    stopWords();
    pill.classList.add('visible');
    label.textContent = payload.message || 'Error';
  } else {
    stopWords();
    pill.classList.remove('visible');
  }
}

window.overlayBridge.onState(setState);
window.overlayBridge.onLevel((rms) => { targetLevel = rms; });
window.overlayBridge.onArmed((payload) => {
  if (state === 'listening' && payload.sounds !== false) blip(660, 990, 90);
});

raf = requestAnimationFrame(tick);
