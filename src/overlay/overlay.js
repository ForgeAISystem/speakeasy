'use strict';

const pill = document.getElementById('pill');
const wave = document.getElementById('wave');
const spinner = document.getElementById('spinner');
const check = document.getElementById('check');
const label = document.getElementById('label');
const ctx = wave.getContext('2d');
const hint = document.getElementById('hint');
const elapsed = document.getElementById('elapsed');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = true, armed = false, clockTimer = null;
const motionAllowed = () => motionEnabled && !motionPreference.matches;
function stopAnimation() {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null;
  clearInterval(clockTimer);
  clockTimer = null;
}
function updateClock() {
  const secs = Math.max(0, Math.floor((Date.now() - recordStartedAt) / 1000));
  elapsed.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
function syncAnimation() {
  stopAnimation();
  document.documentElement.dataset.motion = motionAllowed() ? 'on' : 'off';
  if (state !== 'listening' || !armed || document.hidden) return;
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  if (motionAllowed()) raf = requestAnimationFrame(tick);
  else { smoothLevel = 0; draw(0); }
}
motionPreference.addEventListener('change', syncAnimation);
document.addEventListener('visibilitychange', syncAnimation);

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
  raf = null;
  if (state !== 'listening' || !armed || !motionAllowed() || document.hidden) return;
  smoothLevel += (targetLevel - smoothLevel) * 0.25;
  draw(now || performance.now());
  raf = requestAnimationFrame(tick);
}

function setState(payload) {
  stopAnimation();
  state = payload.state;
  motionEnabled = payload.subtleMotion !== false;
  armed = false;
  elapsed.textContent = '';
  hint.textContent = '';
  document.documentElement.dataset.motion = motionAllowed() ? 'on' : 'off';
  const sounds = payload.sounds !== false;

  wave.style.display = 'none';
  spinner.style.display = 'none';
  check.style.display = 'none';
  label.classList.remove('swap');

  if (state === 'listening') {
    pill.classList.add('visible');
    wave.style.display = 'block';
    displayed = new Array(BAR_COUNT).fill(0.06);
    smoothLevel = 0.05;
    label.textContent = 'Opening microphone';
    hint.textContent = 'Wait for the sound, then speak';
    spinner.style.display = 'block';
    wave.style.display = 'none';
    if (payload.armed) arm({ ...payload, sounds: false });
    // The "go" ping plays on overlay:armed, when the mic is actually live
  } else if (state === 'processing') {
    pill.classList.add('visible');
    spinner.style.display = 'block';
    // 'refine' = the AI polish / organize pass; default = transcription.
    label.textContent = payload.phase === 'command' ? 'Working it out' : payload.phase === 'refine' ? 'Polishing your words' : 'Transcribing';
    hint.textContent = payload.phase === 'command' ? 'Planning your command' : payload.phase === 'refine' ? (payload.localPolish ? 'On your computer' : 'With Anthropic') : 'On your computer';
    if (sounds && payload.phase !== 'refine') blip(990, 660, 80);
  } else if (state === 'loading') {
    pill.classList.add('visible');
    spinner.style.display = 'block';
    label.textContent = payload.message || 'Loading model';
  } else if (state === 'done') {
    pill.classList.add('visible');
    check.style.display = 'block';
    label.textContent = payload.words === 1 ? '1 word written' : `${payload.words} words written`;
    hint.textContent = payload.fallbackReason ? 'AI unavailable · used local cleanup' : 'Back to your flow';
    if (sounds) blip(520, 780, 110, 0.05);
  } else if (state === 'command') {
    pill.classList.add('visible');
    check.style.display = 'block';
    label.textContent = payload.message || 'Got it';
    hint.textContent = payload.hint || '';
    if (sounds) blip(520, 780, 110, 0.05);
  } else if (state === 'cancelled') {
    pill.classList.add('visible');
    label.textContent = 'Cancelled';
    hint.textContent = 'Ready for your next thought';
  } else if (state === 'error') {
    pill.classList.add('visible');
    label.textContent = payload.message || 'Error';
  } else if (state === 'preview') {
    pill.classList.add('visible');
    check.style.display = 'block';
    label.textContent = 'Your dictation indicator';
    hint.textContent = 'Hold your shortcut to start speaking';
  } else {
    pill.classList.remove('visible');
  }
}

window.overlayBridge.onState(setState);
window.overlayBridge.onLevel((rms) => { targetLevel = rms; });
function arm(payload) {
  if (state !== 'listening') return;
  armed = true;
  recordStartedAt = payload.startedAt || Date.now();
  spinner.style.display = 'none';
  wave.style.display = 'block';
  label.textContent = 'Listening';
  hint.textContent = 'Release / tap to write · Esc cancels';
  syncAnimation();
  if (payload.sounds !== false) blip(660, 990, 90);
}
window.overlayBridge.onArmed(arm);
