'use strict';

const path = require('path');
const fs = require('fs');
const {
  app, BrowserWindow, ipcMain, screen, globalShortcut,
  systemPreferences, clipboard, shell, powerMonitor
} = require('electron');

const {
  MODELS, HOLD_KEYS, MIN_RECORDING_SECONDS, SAMPLE_RATE,
  FEATURED_LANGUAGES, LANGUAGE_NAMES, languageName
} = require('../shared/constants');
const store = require('./store');
const { MIN_WIDTH, MIN_HEIGHT, restoreBounds } = require('./window-bounds');
const { cleanup } = require('./cleanup');
const writing = require('../shared/writing');
const { injectText, getLastTranscript, setLastTranscript, getFrontContext } = require('./injector');
const { HotkeyManager } = require('./hotkey');
const models = require('./models');
const { TranscriberManager } = require('./transcriber');
const { TrayController } = require('./tray');
const audioStore = require('./audio-store');
const systemAudio = require('./system-audio');
const { readWispr } = require('./wispr-import');
const { ControlPad } = require('./control-pad');
const globeKey = require('./globe-key');
const commands = require('./commands');
const { quietestPoint } = require('../shared/quiet-point');

let mainWindow = null;
let overlayWindow = null;
let captureWindow = null;
let tray = null;
let hotkeys = null;
let controlPad = null;
let commandMode = false; // this recording is a voice command (the pad was open when fn went down)
let padAccel = null;
const transcriber = new TranscriberManager();

// ---- Dictation state machine ----
// idle -> recording -> processing -> idle
let dictState = 'idle';
let chunks = [];
let chunkSamples = 0;
let recordStartedAt = 0;
let frontContextPromise = null;
let overlayHideTimer = null;
let overlayFadeTimer = null;
let overlayReady = false;
let overlayPayload = { state: 'hidden' };
let captureReady = false;
let captureWatchdog = null;
let lastAudioAt = 0;
let captureRestarts = 0, overlayRestarts = 0;
let stopWaiter = null; // resolves when capture:stopped arrives
let engineState = 'off'; // off | loading | ready | error
let engineCrashCount = 0;
let engineLoadGeneration = 0;
let maxDurationTimer = null;
let captureSession = 0; // increments per recording; stale capture events are dropped
let setupMode = 'off';
let setupHasDictated = false;
let lastKeyAt = 0;
let dictFeedback = { phase: 'idle', message: '' };
// Live decoding: finished stretches of a long dictation are transcribed while
// the speaker keeps talking, so releasing the key only waits for the tail.
let liveParts = [];
let liveOffset = 0;
let liveBusy = false;

// An isolated profile is useful for first-run QA without touching personal history.
if (process.env.SPEAKEASY_USER_DATA) app.setPath('userData', path.resolve(process.env.SPEAKEASY_USER_DATA));

const MAX_RECORDING_SECONDS = 15 * 60; // hard cap, like Wispr's 20-min limit

const isMac = process.platform === 'darwin';

process.on('uncaughtException', (e) => {
  console.error('[main] uncaught exception:', e);
});

// ---------------------------------------------------------------- windows

function createCaptureWindow() {
  captureReady = false;
  const win = captureWindow = new BrowserWindow({
    show: false,
    width: 60,
    height: 60,
    webPreferences: {
      preload: path.join(__dirname, '..', 'capture', 'preload.js'),
      backgroundThrottling: false
    }
  });
  win.webContents.on('did-finish-load', () => {
    if (captureWindow !== win) return;
    captureReady = true;
    setTimeout(() => { if (captureWindow === win && !win.isDestroyed()) captureRestarts = 0; }, 30000);
    win.webContents.send('capture:gen-icons');
    push('runtime', { captureReady, overlayReady });
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    if (captureWindow !== win || app.isQuittingForReal) return;
    captureReady = false;
    console.error('[capture] renderer gone:', details.reason);
    failCapture('Microphone disconnected');
    push('runtime', { captureReady, overlayReady });
    if (++captureRestarts > 3) return;
    setTimeout(() => {
      if (app.isQuittingForReal || captureWindow !== win) return;
      try { win.destroy(); } catch { /* gone */ }
      createCaptureWindow();
    }, 500 * captureRestarts);
  });
  win.loadFile(path.join(__dirname, '..', 'capture', 'capture.html'));
}

function createOverlayWindow() {
  overlayReady = false;
  const win = overlayWindow = new BrowserWindow({
    show: false,
    width: 340,
    height: 110,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'overlay', 'preload.js'),
      backgroundThrottling: false
    }
  });
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.on('did-finish-load', () => {
    if (overlayWindow !== win) return;
    overlayReady = true;
    setTimeout(() => { if (overlayWindow === win && !win.isDestroyed()) overlayRestarts = 0; }, 30000);
    renderOverlay(true);
    push('runtime', { captureReady, overlayReady });
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    if (overlayWindow !== win || app.isQuittingForReal) return;
    overlayReady = false;
    console.error('[overlay] renderer gone:', details.reason);
    push('runtime', { captureReady, overlayReady });
    if (++overlayRestarts > 3) return;
    setTimeout(() => {
      if (app.isQuittingForReal || overlayWindow !== win) return;
      try { win.destroy(); } catch { /* gone */ }
      createOverlayWindow();
    }, 500 * overlayRestarts);
  });
  win.loadFile(path.join(__dirname, '..', 'overlay', 'overlay.html'));
}

function positionOverlay() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w, h] = overlayWindow.getSize();
  overlayWindow.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height - h), false);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    ...restoreBounds(store.windowState(), screen.getAllDisplays(), screen.getPrimaryDisplay()),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'SpeakEasy',
    // Native window chrome keeps dragging, resizing and desktop controls
    // available even when onboarding covers the entire web content.
    titleBarStyle: 'default',
    frame: true,
    movable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor: '#f8f8f2',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'app', 'preload.js')
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  let boundsTimer;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    if (mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    try { store.saveWindowState(mainWindow.getNormalBounds()); }
    catch (e) { console.error('[window] could not save placement:', e.message); }
  };
  const scheduleBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(saveBounds, 400);
  };
  mainWindow.on('move', scheduleBounds);
  mainWindow.on('resize', scheduleBounds);
  mainWindow.on('closed', () => clearTimeout(boundsTimer));
  mainWindow.on('close', (e) => {
    saveBounds();
    // Keep running in the tray; quit only from the tray menu
    if (!app.isQuittingForReal) {
      e.preventDefault();
      if (setupMode !== 'off' && dictState === 'recording') onDictateCancel();
      setupMode = 'off';
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  if (!mainWindow) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function push(type, payload) {
  if (type === 'dictation') dictFeedback = { phase: payload.phase, message: payload.message || '' };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('push', { type, ...payload });
  }
}

function renderOverlay(replay = false) {
  if (!overlayReady || !overlayWindow || overlayWindow.isDestroyed()) return;
  if (overlayPayload.state !== 'hidden') {
    positionOverlay();
    if (!overlayWindow.isVisible()) overlayWindow.showInactive();
  }
  overlayWindow.webContents.send('overlay:state', { ...overlayPayload, sounds: replay ? false : overlayPayload.sounds });
  if (overlayPayload.state === 'hidden') overlayWindow.hide();
}

function overlayState(state, extra = {}) {
  clearTimeout(overlayHideTimer);
  clearTimeout(overlayFadeTimer);
  overlayPayload = {
    state,
    sounds: store.settings().sounds,
    subtleMotion: store.settings().subtleMotion !== false,
    ...extra
  };
  renderOverlay();
  if (['done', 'cancelled', 'error', 'preview', 'command'].includes(state)) {
    overlayHideTimer = setTimeout(() => {
      overlayPayload = { state: 'hidden' };
      if (overlayReady && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('overlay:state', overlayPayload);
      overlayFadeTimer = setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
      }, 250);
    }, state === 'preview' ? 3000 : 1300);
  }
}

// ---------------------------------------------------------------- engine

// One-time upgrades for existing installs. Version 1 (v2.5): Parakeet becomes
// the English voice when it is already downloaded (it made 22% fewer errors
// than Moonshine on real dictation), and Claude cleanup moves to current Haiku.
function migrateSettings() {
  const cfg = store.settings();
  if ((cfg.settingsVersion || 0) >= 1) return;
  const changes = { settingsVersion: 1 };
  if (cfg.model === 'moonshine-base' && models.isInstalled('parakeet-v2')) changes.model = 'parakeet-v2';
  if (cfg.polishAnthropicModel === 'claude-haiku-4-5') changes.polishAnthropicModel = 'claude-haiku-5-5';
  store.updateSettings(changes);
}

async function ensureEngine() {
  const generation = ++engineLoadGeneration;
  const cfg = store.settings();
  if (!cfg.model || !models.isInstalled(cfg.model)) {
    engineState = 'off';
    push('engine', { state: 'off' });
    tray && tray.setState('idle', 'No model installed');
    return;
  }
  engineState = 'loading';
  push('engine', { state: 'loading', model: cfg.model });
  tray && tray.setState('processing', 'Loading model...');
  try {
    await transcriber.load(cfg.model, cfg.language);
    if (generation !== engineLoadGeneration || app.isQuittingForReal) return;
    engineState = 'ready';
    console.log(`[engine] ready: ${cfg.model}`);
    push('engine', { state: 'ready', model: cfg.model });
    tray && tray.setState('idle', 'Ready');
  } catch (e) {
    if (generation !== engineLoadGeneration || app.isQuittingForReal) return;
    engineState = 'error';
    console.error(`[engine] load failed: ${e.message}`);
    push('engine', { state: 'error', message: e.message });
    tray && tray.setState('idle', `Engine error: ${e.message}`);
  }
}

transcriber.onStateChange = (state, detail) => {
  if (state === 'ready') engineCrashCount = 0;
  if (state === 'error' && engineState !== 'loading') {
    // Crashed at runtime: recover with backoff, give up after repeated crashes
    engineState = 'error';
    push('engine', { state: 'error', message: detail });
    engineCrashCount += 1;
    if (engineCrashCount <= 3) {
      setTimeout(ensureEngine, 1000 * engineCrashCount);
    } else {
      console.error('[engine] giving up after repeated crashes');
      tray && tray.setState('idle', 'Engine failed. Switch models in Settings.');
    }
  }
};

// ---------------------------------------------------------------- dictation

function onDictateStart() {
  if (setupMode === 'shortcut') return;
  if (dictState === 'processing') {
    hotkeys.reset();
    renderOverlay(); // retain the active progress indicator on repeated presses
    return;
  }
  if (dictState !== 'idle') return;
  if (engineState !== 'ready') {
    hotkeys.reset();
    overlayState('error', { message: engineState === 'loading' ? 'Model still loading' : 'Open SpeakEasy to finish setup' });
    return;
  }
  if (!captureReady || !captureWindow || captureWindow.isDestroyed()) {
    hotkeys.reset();
    overlayState('error', { message: 'Microphone reconnecting. Try again.' });
    return;
  }
  if (permStatus().mic !== 'granted') {
    hotkeys.reset();
    overlayState('error', { message: 'Allow microphone access in SpeakEasy' });
    return;
  }
  dictState = 'recording';
  commandMode = !!(controlPad && controlPad.isOpen() && store.settings().voiceCommands !== false);
  if (commandMode) controlPad.listening();
  else if (controlPad) controlPad.captureTarget(); // a "Hey computer" command acts on this window
  captureSession += 1;
  chunks = [];
  chunkSamples = 0;
  recordStartedAt = Date.now();
  lastAudioAt = recordStartedAt;
  resetLive();
  frontContextPromise = getFrontContext();
  if (store.settings().muteWhileDictating) systemAudio.setDictationMute(true);
  overlayState('listening');
  tray.setState('recording', 'Listening...');
  try {
    captureWindow.webContents.send('capture:start', { deviceId: store.settings().micDeviceId, session: captureSession });
  } catch {
    failCapture('Microphone disconnected. Try Repair connection.');
    return;
  }
  push('dictation', { phase: 'recording' });
  const checkAudio = () => {
    if (dictState !== 'recording') return;
    const remaining = 10000 - (Date.now() - lastAudioAt);
    if (remaining <= 0) failCapture('Microphone stopped responding');
    else captureWatchdog = setTimeout(checkAudio, remaining);
  };
  clearTimeout(captureWatchdog);
  captureWatchdog = setTimeout(checkAudio, 10000);
  clearTimeout(maxDurationTimer);
  maxDurationTimer = setTimeout(() => {
    if (dictState === 'recording') {
      hotkeys.reset();
      onDictateStop();
    }
  }, MAX_RECORDING_SECONDS * 1000);
}

async function collectAudio() {
  // Ask capture to stop, wait for trailing chunks to flush
  const stopped = new Promise((resolve) => {
    stopWaiter = resolve;
    setTimeout(resolve, 500); // safety net
  });
  try {
    if (captureReady && captureWindow && !captureWindow.isDestroyed()) captureWindow.webContents.send('capture:stop');
    else stopWaiter();
  } catch { stopWaiter(); }
  await stopped;
  stopWaiter = null;

  const pcm = takeAudio();
  captureSession += 1; // anything still in flight from this session is now stale
  return pcm;
}

function takeAudio() {
  const pcm = new Float32Array(chunkSamples);
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  chunks = [];
  chunkSamples = 0;
  return pcm;
}

function resetLive() {
  liveParts = [];
  liveOffset = 0;
  liveBusy = false;
}

// Copy recorded samples [from, chunkSamples) without consuming them.
function recordedSince(from) {
  const out = new Float32Array(chunkSamples - from);
  let position = 0;
  for (const c of chunks) {
    const start = Math.max(0, from - position);
    if (start < c.length) out.set(c.subarray(start), position + start - from);
    position += c.length;
  }
  return out;
}

// Seconds per live segment, inside each model's single-pass window. Parakeet
// keeps longer context: 30-40 s segments matched whole-recording accuracy.
const LIVE_WINDOW = { whisper: [20, 28], moonshine: [20, 28], nemo_transducer: [30, 40] };

function maybeDecodeAhead() {
  if (dictState !== 'recording' || liveBusy || engineState !== 'ready') return;
  const [minSeconds, maxSeconds] = LIVE_WINDOW[MODELS[store.settings().model]?.kind] || [20, 28];
  if (chunkSamples - liveOffset < maxSeconds * SAMPLE_RATE) return;
  const pending = recordedSince(liveOffset);
  const cut = quietestPoint(pending, minSeconds * SAMPLE_RATE, maxSeconds * SAMPLE_RATE, SAMPLE_RATE);
  const parts = liveParts;
  liveOffset += cut;
  liveBusy = true;
  const part = transcriber.transcribe(pending.slice(0, cut), SAMPLE_RATE);
  part.then(() => { if (liveParts === parts) liveBusy = false; }, () => {});
  parts.push(part);
}

// Join the parts decoded during recording with the remaining tail.
async function transcribeDictation(pcm) {
  const parts = liveParts;
  const tail = pcm.subarray(liveOffset);
  resetLive();
  if (!parts.length || tail.length / SAMPLE_RATE >= MIN_RECORDING_SECONDS) parts.push(transcriber.transcribe(tail, SAMPLE_RATE));
  const results = await Promise.all(parts);
  return {
    text: results.map((r) => r.text).filter(Boolean).join(' ').trim(),
    lang: (results.find((r) => r.lang) || {}).lang || '',
    ms: results.reduce((sum, r) => sum + (r.ms || 0), 0),
    liveParts: parts.length - 1
  };
}

async function onDictateStop() {
  if (dictState !== 'recording') return;
  dictState = 'processing';
  clearTimeout(maxDurationTimer);
  clearTimeout(captureWatchdog);
  systemAudio.setDictationMute(false);
  overlayState('processing');
  tray.setState('processing', 'Computing...');
  push('dictation', { phase: 'processing' });

  let wavName = null;
  let speechSeconds = 0;
  try {
    const pcm = await collectAudio();
    speechSeconds = pcm.length / SAMPLE_RATE;
    if (speechSeconds < MIN_RECORDING_SECONDS) {
      overlayState('cancelled');
      push('dictation', { phase: 'cancelled' });
      return;
    }

    // Safety net: the audio hits disk BEFORE transcription. Deleted on
    // success; survives a failed or crashed transcription for retry.
    try { wavName = audioStore.saveRecording(pcm); } catch (e) { console.error('[audio-store]', e.message); }

    const t0 = Date.now();
    const { text: rawText, lang, ms: engineMs } = await transcribeDictation(pcm);
    const voice = commandMode ? rawText
      : controlPad && store.settings().voiceCommands !== false ? commands.wakeCommand(rawText) : null;
    if (voice !== null) {
      audioStore.removeRecording(wavName);
      wavName = null;
      await runVoiceCommand(voice);
      return;
    }
    const context = await Promise.race([frontContextPromise, new Promise((r) => setTimeout(() => r({ app: '', title: '' }), 400))]) || { app: '', title: '' };
    // A second AI pass (polish or "organize my thoughts") is about to run:
    // tell the overlay so the pill switches to the refine words + spinner.
    if (rawText && writing.mode(store.settings()) === 'polished' && writing.providerReady(store.settings())) {
      overlayState('processing', { phase: 'refine', localPolish: store.settings().polishProvider === 'ollama' });
    }
    const { text, organized, polished, cleanupMode, fallbackReason } = rawText ? await cleanup(rawText, context) : { text: '', organized: false };
    if (!text) {
      audioStore.removeRecording(wavName);
      overlayState('error', { message: 'Nothing heard' });
      push('dictation', { phase: 'error', message: 'No speech detected. Check the microphone, then try again.' });
      return;
    }

    const ok = await injectText(text, { restoreClipboard: store.settings().restoreClipboard });
    if (setupMode === 'practice' && ok && mainWindow.isFocused()) setupHasDictated = true;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (!ok) {
      // Paste failed (no focused field, blocked app): the text stays on the
      // clipboard, tell the user how to recover instead of pretending success.
      overlayState('error', { message: isMac ? 'On clipboard, press ⌘V' : 'On clipboard, press Ctrl+V' });
    }
    store.recordTranscription(words, speechSeconds);
    store.addHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      text,
      raw: rawText !== text ? rawText : undefined,
      app: context.app,
      speechSeconds: Math.round(speechSeconds * 10) / 10,
      engineMs,
      totalMs: Date.now() - t0,
      model: store.settings().model,
      lang: lang || undefined,
      organized: organized || undefined,
      polished: polished || undefined,
      cleanupMode,
      fallbackReason,
      pasted: ok
    });
    audioStore.removeRecording(wavName);

    if (ok) overlayState('done', { words, fallbackReason });
    push('dictation', { phase: 'done', text, words, pasted: ok });
    push('stats', {});
  } catch (e) {
    console.error('[dictation]', e);
    if (wavName) {
      // Keep the audio and surface a retryable entry in History
      store.addHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        text: '',
        failed: true,
        audioFile: wavName,
        speechSeconds: Math.round(speechSeconds * 10) / 10,
        model: store.settings().model
      });
      overlayState('error', { message: 'Failed. Audio saved, retry in History' });
    } else {
      overlayState('error', { message: 'Transcription failed' });
    }
    push('dictation', { phase: 'error', message: e.message });
    push('stats', {});
  } finally {
    dictState = 'idle';
    commandMode = false;
    tray.setState('idle', 'Ready');
  }
}

// A spoken request for the Control Pad: plan it, show it on the pad, run it.
async function runVoiceCommand(text) {
  overlayState('processing', { phase: 'command' });
  if (controlPad.lastFrontPromise && !controlPad.isOpen()) await controlPad.lastFrontPromise;
  const pads = controlPad.pads();
  const front = controlPad.isOpen() ? controlPad.target : controlPad.lastFront;
  const result = await commands.plan(text, { pads, apps: commands.installedApps(), frontApp: front ? front.app : '' }, store.settings());
  const steps = result.steps.map((step) => ({ ...step, text: commands.describe(step, pads), confirm: commands.needsConfirm(step, pads) }));
  const waits = steps.some((step) => step.confirm);
  overlayState(steps.length ? 'command' : 'error', steps.length
    ? { message: steps.length === 1 ? steps[0].text : `${steps.length} steps`, hint: waits ? 'Press Return to run it' : 'On it' }
    : { message: text ? 'No command found' : 'Nothing heard' });
  push('dictation', { phase: 'idle' });
  await controlPad.showPlan({ ...result, steps });
}

function onDictateCancel() {
  if (dictState !== 'recording') return;
  dictState = 'idle';
  commandMode = false;
  clearTimeout(maxDurationTimer);
  clearTimeout(captureWatchdog);
  resetLive();
  systemAudio.setDictationMute(false);
  captureSession += 1; // drop any in-flight chunks from the cancelled session
  try { if (captureReady && captureWindow && !captureWindow.isDestroyed()) captureWindow.webContents.send('capture:stop'); }
  catch { /* a crashed renderer has already released the microphone */ }
  chunks = [];
  chunkSamples = 0;
  overlayState('cancelled');
  tray.setState('idle', 'Ready');
  push('dictation', { phase: 'cancelled' });
}

function failCapture(message) {
  if (dictState !== 'recording') return;
  const pcm = takeAudio();
  let saved = false;
  if (pcm.length / SAMPLE_RATE >= MIN_RECORDING_SECONDS) {
    try {
      const audioFile = audioStore.saveRecording(pcm);
      store.addHistory({ id: `${Date.now()}-${captureSession}`, ts: Date.now(), text: '', failed: true,
        audioFile, speechSeconds: pcm.length / SAMPLE_RATE, model: store.settings().model });
      saved = true;
    } catch (e) { console.error('[capture] recovery save failed:', e.message); }
  }
  onDictateCancel();
  hotkeys.reset();
  overlayState('error', { message: saved ? 'Mic stopped. Audio saved in History.' : message });
  tray.setState('idle', 'Check microphone');
  push('dictation', { phase: 'error', message: saved ? 'Microphone interrupted. Retry the saved audio in History.' : message });
  push('stats', {});
}

// ---------------------------------------------------------------- capture IPC

ipcMain.on('capture:chunk', (_e, session, pcm, rms) => {
  if (session !== captureSession) return; // stale audio from a previous session
  if (dictState !== 'recording' && dictState !== 'processing') return;
  const arr = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
  chunks.push(arr);
  chunkSamples += arr.length;
  if (arr.length) lastAudioAt = Date.now();
  if (dictState === 'recording' && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:level', rms);
  }
  maybeDecodeAhead();
});

ipcMain.on('capture:stopped', (_e, session) => {
  if (session !== captureSession) return; // a previous session finishing late
  if (stopWaiter) stopWaiter();
});

// Mic is actually flowing: play the "go" ping now, not when the key went down.
// getUserMedia takes 100-300 ms to arm; speaking before this loses words.
ipcMain.on('capture:armed', (_e, session) => {
  if (session !== captureSession) return;
  if (dictState === 'recording' && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayPayload = { ...overlayPayload, armed: true, startedAt: Date.now() };
    push('dictation', { phase: 'armed' });
    if (overlayReady) overlayWindow.webContents.send('overlay:armed', { sounds: store.settings().sounds, startedAt: overlayPayload.startedAt });
  }
});

ipcMain.on('capture:error', (_e, session, message) => {
  if (session !== captureSession) return;
  console.error('[capture]', message);
  failCapture('Microphone unavailable. Check Settings.');
});

ipcMain.on('capture:icons', (_e, icons) => {
  tray.init(icons);
  tray.setState('idle', engineState === 'ready' ? 'Ready' : 'Starting...');
});

// mic listing round-trip
const micWaiters = new Map();
let micReq = 0;
ipcMain.on('capture:mics', (_e, reqId, mics) => {
  const w = micWaiters.get(reqId);
  if (w) { micWaiters.delete(reqId); w(mics); }
});
function listMics() {
  return new Promise((resolve) => {
    const id = ++micReq;
    micWaiters.set(id, resolve);
    captureWindow.webContents.send('capture:list-mics', id);
    setTimeout(() => { if (micWaiters.delete(id)) resolve([]); }, 3000);
  });
}

// ---------------------------------------------------------------- app IPC

function permStatus() {
  if (isMac) {
    return {
      mic: systemPreferences.getMediaAccessStatus('microphone'),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false)
    };
  }
  return { mic: process.platform === 'win32' ? systemPreferences.getMediaAccessStatus('microphone') : 'granted', accessibility: true };
}

function fullState() {
  const cfg = store.settings();
  return {
    settings: cfg,
    stats: store.statsSummary(),
    models: {
      catalog: MODELS,
      installed: models.installedModels(),
      downloads: models.downloadStatus()
    },
    holdKeys: HOLD_KEYS,
    languages: { featured: FEATURED_LANGUAGES, names: LANGUAGE_NAMES },
    engine: { state: engineState },
    runtime: { captureReady, overlayReady, dictState, lastKeyAt, ...dictFeedback },
    shortcut: { ready: !!hotkeys?.running, error: hotkeys?.error || '', key: cfg.holdKey },
    pad: { available: isMac, shortcut: padAccel, shortcutError: padShortcutError },
    installation: { needsMove: isMac && app.isPackaged && !app.isInApplicationsFolder() },
    permissions: permStatus(),
    platform: process.platform,
    version: app.getVersion()
  };
}

ipcMain.handle('state:get', () => fullState());
ipcMain.handle('runtime:test-overlay', () => {
  if (dictState !== 'idle') return { ok: false, error: 'Finish the current dictation first.' };
  if (!overlayReady) return { ok: false, error: 'The indicator is reconnecting. Use Repair connection, then try again.' };
  overlayState('preview');
  return { ok: true };
});
ipcMain.handle('runtime:repair', async () => {
  if (dictState !== 'idle') return { ok: false, error: 'Finish the current dictation first.' };
  hotkeys.stop();
  if (hotkeyStarting) await hotkeyStarting;
  await startHotkeysWithRetry();
  if (!captureReady) {
    captureRestarts = 0;
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy();
    createCaptureWindow();
  }
  if (!overlayReady) {
    overlayRestarts = 0;
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    createOverlayWindow();
  }
  if (engineState !== 'ready' && engineState !== 'loading') await ensureEngine();
  return { ok: true, state: fullState() };
});

ipcMain.handle('app:install', () => {
  if (!isMac || !app.isPackaged || app.isInApplicationsFolder()) return { ok: true };
  try {
    const ok = app.moveToApplicationsFolder();
    return { ok, error: ok ? '' : 'Installation was cancelled. You can also drag SpeakEasy into Applications.' };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('app:hide', () => { setupMode = 'off'; mainWindow.hide(); });
ipcMain.handle('setup:mode', (_e, mode) => {
  if (!['off', 'shortcut', 'practice'].includes(mode)) return false;
  if (dictState === 'recording') onDictateCancel();
  hotkeys?.reset();
  setupMode = mode;
  if (mode === 'shortcut') setupHasDictated = false;
  return true;
});
ipcMain.handle('setup:complete', (_e, launchAtLogin) => {
  const perms = permStatus();
  if (!setupHasDictated || engineState !== 'ready' || !hotkeys?.running || !perms.accessibility || perms.mic !== 'granted') {
    return { ok: false, error: 'Finish a test dictation and check the permissions before continuing.' };
  }
  store.updateSettings({ onboarded: true, launchAtLogin: launchAtLogin === true });
  app.setLoginItemSettings({ openAtLogin: launchAtLogin === true });
  setupMode = 'off';
  return { ok: true };
});
ipcMain.handle('engine:retry', async () => { await ensureEngine(); return fullState(); });
ipcMain.handle('shortcut:retry', async () => {
  if (dictState !== 'idle') return fullState();
  hotkeys.stop();
  if (hotkeyStarting) await hotkeyStarting;
  await startHotkeysWithRetry();
  return fullState();
});

ipcMain.handle('settings:update', async (_e, partial) => {
  const before = store.settings();
  const modelChanged = partial.model !== undefined && partial.model !== before.model;
  const langChanged = partial.language !== undefined && partial.language !== before.language;
  const keyChanged = (partial.holdKey !== undefined && partial.holdKey !== before.holdKey) ||
    (partial.padMicKey !== undefined && partial.padMicKey !== before.padMicKey);
  const padKeyChanged = partial.padShortcut !== undefined && partial.padShortcut !== before.padShortcut;
  const loginChanged = partial.launchAtLogin !== undefined && partial.launchAtLogin !== before.launchAtLogin;

  const cfg = store.updateSettings(partial);
  if (keyChanged) {
    hotkeys.stop();
    if (hotkeyStarting) await hotkeyStarting;
    await startHotkeysWithRetry();
  }
  if (loginChanged) app.setLoginItemSettings({ openAtLogin: cfg.launchAtLogin });
  if (padKeyChanged) registerPadShortcut();
  if (modelChanged || langChanged) await ensureEngine();
  return fullState();
});

ipcMain.handle('models:download', async (_e, id) => {
  try {
    await models.downloadModel(id, (mid, f) => push('download-progress', { id: mid, progress: f }));
    push('download-progress', { id, progress: 1, done: true });
    return { ok: true };
  } catch (e) {
    push('download-progress', { id, error: e.message });
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('models:remove', (_e, id) => {
  if (store.settings().model === id) return { ok: false, error: 'Model is active. Switch models first.' };
  models.removeModel(id);
  return { ok: true };
});

ipcMain.handle('history:list', () => store.history().data);
ipcMain.handle('history:remove', (_e, id) => {
  const entry = store.history().data.find((h) => h.id === id);
  if (entry && entry.audioFile) audioStore.removeRecording(entry.audioFile);
  store.removeHistory(id);
  return store.history().data;
});
ipcMain.handle('history:clear', () => {
  for (const h of store.history().data) {
    if (h.audioFile) audioStore.removeRecording(h.audioFile);
  }
  store.clearHistory();
  return [];
});

// Retry a failed dictation from its saved audio. On success the text is
// placed on the clipboard (the original cursor position is long gone).
ipcMain.handle('history:retry', async (_e, id) => {
  const entry = store.history().data.find((h) => h.id === id);
  if (!entry || !entry.failed) return { ok: false, error: 'Nothing to retry' };
  if (engineState !== 'ready') return { ok: false, error: 'Engine not ready yet' };
  const file = entry.audioFile && audioStore.recordingPath(entry.audioFile);
  if (!file || !fs.existsSync(file)) return { ok: false, error: 'Audio no longer available' };
  try {
    const pcm = audioStore.readRecordingPcm(file);
    const { text: rawText, ms: engineMs } = await transcriber.transcribe(pcm, SAMPLE_RATE);
    const { text, organized, polished, cleanupMode, fallbackReason } = rawText ? await cleanup(rawText) : { text: '' };
    if (!text) return { ok: false, error: 'Nothing heard in the recording' };

    entry.text = text;
    entry.raw = rawText !== text ? rawText : undefined;
    Object.assign(entry, { organized, polished, cleanupMode, fallbackReason });
    entry.failed = false;
    entry.engineMs = engineMs;
    audioStore.removeRecording(entry.audioFile);
    delete entry.audioFile;
    delete entry.recovered;
    store.history().save();

    const words = text.split(/\s+/).filter(Boolean).length;
    store.recordTranscription(words, entry.speechSeconds || 0);
    clipboard.writeText(text);
    push('stats', {});
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('dict:list', () => store.dictionary().data);
ipcMain.handle('dict:save', (_e, entries) => {
  const d = store.dictionary();
  d.data = entries;
  d.save();
  return d.data;
});

ipcMain.handle('snippets:list', () => store.snippets().data);
ipcMain.handle('snippets:save', (_e, entries) => {
  const s = store.snippets();
  s.data = entries;
  s.save();
  return s.data;
});

ipcMain.handle('import:wispr-preview', async () => {
  try {
    const found = await readWispr({ dictionary: store.dictionary().data, snippets: store.snippets().data });
    return { available: found.available, words: found.words.length, snippets: found.snippets.length };
  } catch (e) { return { available: false, error: e.message }; }
});
ipcMain.handle('import:wispr', async () => {
  try {
    const d = store.dictionary();
    const s = store.snippets();
    const found = await readWispr({ dictionary: d.data, snippets: s.data });
    const stamp = Date.now();
    d.data = [...found.words.map((w, i) => ({ id: `wispr-${stamp}-${i}`, ...w })), ...d.data];
    d.save();
    s.data = [...found.snippets.map((x, i) => ({ id: `wispr-${stamp}-s${i}`, ...x })), ...s.data];
    s.save();
    return { ok: true, words: found.words.length, snippets: found.snippets.length };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- Control Pad + Globe key ----
let padShortcutError = '';
function registerPadShortcut() {
  if (!controlPad) return;
  if (padAccel) { try { globalShortcut.unregister(padAccel); } catch { /* gone */ } }
  padAccel = null;
  padShortcutError = '';
  const accel = store.settings().padShortcut;
  if (!accel || accel === 'off') return;
  try {
    if (globalShortcut.register(accel, () => controlPad.toggle())) padAccel = accel;
    else padShortcutError = 'Another app already uses this shortcut. Pick another.';
  } catch (e) { padShortcutError = e.message; }
}
const padOnly = (fn) => (...args) => controlPad ? fn(...args) : { ok: false, message: 'The Control Pad runs on Mac.' };
ipcMain.handle('pad:get', () => ({ pads: controlPad ? controlPad.pads() : {}, available: !!controlPad, shortcut: padAccel, shortcutError: padShortcutError }));
ipcMain.handle('pad:set', padOnly((_e, key, value) => {
  const pads = controlPad.pads();
  if (!Object.hasOwn(pads, key)) return { ok: false, message: 'No such pad' };
  pads[key] = value && typeof value === 'object' ? { ...value } : { type: 'none' };
  store.savePad(pads);
  return { ok: true, pads: controlPad.pads() };
}));
ipcMain.handle('pad:press', padOnly((_e, key, source) => controlPad.press(key, source === 'test' ? 'test' : 'click')));
ipcMain.handle('pad:save', padOnly((_e, key) => controlPad.save(key)));
ipcMain.handle('pad:open', padOnly(() => controlPad.open()));
ipcMain.handle('pad:close', padOnly(() => controlPad.close()));
ipcMain.handle('pad:confirm', padOnly(() => controlPad.confirm()));
ipcMain.handle('pad:camera', padOnly(() => ({ ok: true, on: controlPad.toggleCamera() })));
ipcMain.handle('globe:status', () => globeKey.status());
ipcMain.handle('globe:fix', async () => {
  if (!isMac) return { ok: false };
  try {
    const before = await globeKey.status();
    if (!before.opensPopup) return { ok: true, already: true };
    const res = await globeKey.fix();
    // Keep the first value we ever replaced so Undo returns the Mac to the user's own choice.
    if (res.ok && store.settings().globePrevious === undefined) store.updateSettings({ globePrevious: res.previous === null ? 'unset' : res.previous });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('globe:restore', async () => {
  const prev = store.settings().globePrevious;
  if (prev === undefined) return { ok: false };
  try {
    await globeKey.restore(prev === 'unset' ? null : prev);
    store.updateSettings({ globePrevious: undefined });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('mics:list', () => listMics());
ipcMain.handle('clipboard:copy', (_e, text) => { clipboard.writeText(text); return true; });

ipcMain.handle('perm:request-mic', async () => {
  if (isMac) {
    try { await systemPreferences.askForMediaAccess('microphone'); } catch { /* user decides */ }
  } else if (process.platform === 'win32') {
    await shell.openExternal('ms-settings:privacy-microphone');
  }
  return permStatus();
});
ipcMain.handle('perm:request-accessibility', () => {
  if (isMac) systemPreferences.isTrustedAccessibilityClient(true);
  if (hotkeys && !hotkeys.running) startHotkeysWithRetry();
  return permStatus();
});
ipcMain.handle('perm:open-settings', (_e, pane) => {
  if (isMac) {
    const urls = {
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      input: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
      keyboard: 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'
    };
    shell.openExternal(urls[pane] || urls.accessibility);
  } else if (process.platform === 'win32' && pane === 'microphone') {
    shell.openExternal('ms-settings:privacy-microphone');
  }
  return true;
});
ipcMain.handle('perm:status', () => permStatus());

// Global key listening needs Accessibility (mac). If it is not granted yet,
// keep retrying quietly so the hotkey comes alive the moment the user grants it.
let hotkeyRetryTimer = null;
let hotkeyStarting = null;
function startHotkeysWithRetry() {
  if (app.isQuittingForReal) return Promise.resolve(false);
  if (hotkeyStarting) return hotkeyStarting;
  const attempt = async () => {
    if (isMac && !systemPreferences.isTrustedAccessibilityClient(false)) {
      hotkeys.stop();
      hotkeys.error = 'Allow Accessibility to activate your dictation key.';
      push('shortcut', { ready: false, error: hotkeys.error });
      return false;
    }
    try {
      await hotkeys.start(store.settings().holdKey);
      clearInterval(hotkeyRetryTimer);
      hotkeyRetryTimer = null;
      console.log('[hotkey] listener active');
      return true;
    } catch (e) {
      hotkeys.error = e.message;
      push('shortcut', { ready: false, error: e.message });
      console.error('[hotkey] not available yet:', e.message);
      return false;
    }
  };
  hotkeyStarting = attempt().then((ok) => {
    if (!ok && !hotkeyRetryTimer && !app.isQuittingForReal) hotkeyRetryTimer = setInterval(startHotkeysWithRetry, 5000);
    return ok;
  }).finally(() => { hotkeyStarting = null; });
  return hotkeyStarting;
}

// ---------------------------------------------------------------- lifecycle

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // Cmd+Q and the native application menu must quit, while closing the window
  // alone keeps dictation in the menu bar. before-quit precedes window close.
  app.on('before-quit', () => { app.isQuittingForReal = true; });
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(async () => {
    if (isMac && app.dock) {
      const iconPng = path.join(__dirname, '..', '..', 'build', 'icon.png');
      if (fs.existsSync(iconPng)) app.dock.setIcon(iconPng);
    }
    createCaptureWindow();
    createOverlayWindow();
    createMainWindow();

    tray = new TrayController({
      onOpen: () => showMainWindow(),
      onQuit: () => { app.isQuittingForReal = true; app.quit(); }
    });
    tray.ensureTray();

    if (isMac) {
      controlPad = new ControlPad({
        electron: { BrowserWindow, screen, globalShortcut, shell, systemPreferences },
        store,
        injectText,
        helperPath: app.isPackaged
          ? path.join(process.resourcesPath, 'native', 'speakeasy-window')
          : path.join(__dirname, '..', '..', 'build', 'native', 'speakeasy-window'),
        onEvent: (event) => push('pad', event)
      });
      tray.onPad = () => controlPad.toggle();
      tray._menu();
      registerPadShortcut();
    }

    hotkeys = new HotkeyManager({
      onStart: onDictateStart,
      onStop: onDictateStop,
      onCancel: onDictateCancel,
      micKey: () => isMac && store.settings().padMicKey !== false,
      onMic: () => { if (dictState === 'idle') controlPad && controlPad.toggle(); },
      onKey: (event) => { lastKeyAt = Date.now(); push('shortcut-key', { ...event, at: lastKeyAt }); },
      onStatus: (status) => {
        push('shortcut', status);
        if (!status.ready && !hotkeyRetryTimer) hotkeyRetryTimer = setInterval(startHotkeysWithRetry, 5000);
      }
    });
    startHotkeysWithRetry();

    // Paste last transcript (Wispr parity: Cmd+Ctrl+V mac / Shift+Alt+Z win)
    const pasteAccel = isMac ? 'Command+Control+V' : 'Shift+Alt+Z';
    globalShortcut.register(pasteAccel, async () => {
      const last = getLastTranscript();
      if (last) await injectText(last, { restoreClipboard: store.settings().restoreClipboard });
    });

    powerMonitor.on('suspend', () => {
      // Recording across a sleep produces a broken capture: cancel cleanly
      if (dictState === 'recording') onDictateCancel();
      hotkeys.stop();
    });
    powerMonitor.on('resume', () => startHotkeysWithRetry());

    // Crash recovery: recordings on disk with no history entry are dictations
    // the app died on. Surface them as retryable, then prune old audio.
    // Runs BEFORE the slow engine load so the renderer sees them on first paint.
    try {
      const referenced = new Set(store.history().data.map((h) => h.audioFile).filter(Boolean));
      let recoveredAny = false;
      for (const rec of audioStore.listRecordings()) {
        if (referenced.has(rec.name)) continue;
        if (rec.seconds < MIN_RECORDING_SECONDS) { audioStore.removeRecording(rec.name); continue; }
        store.addHistory({
          id: `${Math.round(rec.mtimeMs)}-${Math.random().toString(36).slice(2, 7)}`,
          ts: Math.round(rec.mtimeMs),
          text: '',
          failed: true,
          recovered: true,
          audioFile: rec.name,
          speechSeconds: Math.round(rec.seconds * 10) / 10,
          model: store.settings().model
        });
        recoveredAny = true;
      }
      audioStore.pruneRecordings(14);
      if (recoveredAny) push('stats', {}); // refresh if the renderer beat us to it
    } catch (e) {
      console.error('[recovery]', e.message);
    }

    migrateSettings();
    await ensureEngine();

    app.on('activate', () => showMainWindow());

    // Dev utility: SPEAKEASY_SHOT=/path.png captures the main window after
    // load (used for docs/screenshots; no Screen Recording permission needed).
    if (process.env.SPEAKEASY_SHOT) {
      setTimeout(async () => {
        try {
          const img = await mainWindow.webContents.capturePage();
          fs.writeFileSync(process.env.SPEAKEASY_SHOT, img.toPNG());
          console.log('[shot] saved', process.env.SPEAKEASY_SHOT);
        } catch (e) {
          console.error('[shot]', e.message);
        }
      }, 3500);
    }
  });

  app.on('will-quit', () => {
    clearInterval(hotkeyRetryTimer);
    clearTimeout(overlayHideTimer);
    clearTimeout(overlayFadeTimer);
    clearTimeout(captureWatchdog);
    clearTimeout(maxDurationTimer);
    globalShortcut.unregisterAll();
    try { controlPad && controlPad.dispose(); } catch { /* shutting down */ }
    try { hotkeys && hotkeys.stop(); } catch { /* shutting down */ }
    systemAudio.restoreNow();
    transcriber.dispose();
  });

  app.on('window-all-closed', () => {
    // Stay alive in the tray on all platforms
  });
}
