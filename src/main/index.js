'use strict';

const path = require('path');
const fs = require('fs');
const {
  app, BrowserWindow, ipcMain, screen, globalShortcut,
  systemPreferences, clipboard, shell, powerMonitor
} = require('electron');

const { MODELS, HOLD_KEYS, MIN_RECORDING_SECONDS, SAMPLE_RATE } = require('../shared/constants');
const store = require('./store');
const { cleanup } = require('./cleanup');
const { injectText, getLastTranscript, setLastTranscript, getFrontAppName } = require('./injector');
const { HotkeyManager } = require('./hotkey');
const models = require('./models');
const { TranscriberManager } = require('./transcriber');
const { TrayController } = require('./tray');

let mainWindow = null;
let overlayWindow = null;
let captureWindow = null;
let tray = null;
let hotkeys = null;
const transcriber = new TranscriberManager();

// ---- Dictation state machine ----
// idle -> recording -> processing -> idle
let dictState = 'idle';
let chunks = [];
let chunkSamples = 0;
let recordStartedAt = 0;
let frontAppPromise = null;
let overlayHideTimer = null;
let stopWaiter = null; // resolves when capture:stopped arrives
let engineState = 'off'; // off | loading | ready | error
let engineCrashCount = 0;
let maxDurationTimer = null;
let captureSession = 0; // increments per recording; stale capture events are dropped

const MAX_RECORDING_SECONDS = 15 * 60; // hard cap, like Wispr's 20-min limit

const isMac = process.platform === 'darwin';

process.on('uncaughtException', (e) => {
  console.error('[main] uncaught exception:', e);
});

// ---------------------------------------------------------------- windows

function createCaptureWindow() {
  captureWindow = new BrowserWindow({
    show: false,
    width: 60,
    height: 60,
    webPreferences: {
      preload: path.join(__dirname, '..', 'capture', 'preload.js'),
      backgroundThrottling: false
    }
  });
  captureWindow.loadFile(path.join(__dirname, '..', 'capture', 'capture.html'));
  captureWindow.webContents.on('did-finish-load', () => {
    captureWindow.webContents.send('capture:gen-icons');
  });
  captureWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[capture] renderer gone:', details.reason);
    if (dictState === 'recording') onDictateCancel();
    setTimeout(() => { try { captureWindow.destroy(); } catch { /* gone */ } createCaptureWindow(); }, 500);
  });
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
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
  overlayWindow.loadFile(path.join(__dirname, '..', 'overlay', 'overlay.html'));
  overlayWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[overlay] renderer gone:', details.reason);
    setTimeout(() => { try { overlayWindow.destroy(); } catch { /* gone */ } createOverlayWindow(); }, 500);
  });
}

function positionOverlay() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w, h] = overlayWindow.getSize();
  overlayWindow.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height - h), false);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: 'SpeakEasy',
    // Liquid glass: native vibrancy on mac (desktop blurs through the
    // chrome), acrylic on Win 11, plain warm canvas elsewhere.
    backgroundColor: isMac ? '#00000000' : '#f5f4f0',
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'active',
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'app', 'preload.js')
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  mainWindow.on('close', (e) => {
    // Keep running in the tray; quit only from the tray menu
    if (!app.isQuittingForReal) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  if (!mainWindow) createMainWindow();
  mainWindow.show();
  mainWindow.focus();
}

function push(type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('push', { type, ...payload });
  }
}

function overlayState(state, extra = {}) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  clearTimeout(overlayHideTimer);
  if (state !== 'hidden') {
    positionOverlay();
    if (!overlayWindow.isVisible()) overlayWindow.showInactive();
  }
  overlayWindow.webContents.send('overlay:state', {
    state,
    sounds: store.settings().sounds,
    ...extra
  });
  if (['done', 'cancelled', 'error'].includes(state)) {
    overlayHideTimer = setTimeout(() => {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      overlayWindow.webContents.send('overlay:state', { state: 'hidden' });
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
      }, 250);
    }, 1300);
  }
  if (state === 'hidden') overlayWindow.hide();
}

// ---------------------------------------------------------------- engine

async function ensureEngine() {
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
    engineState = 'ready';
    console.log(`[engine] ready: ${cfg.model}`);
    push('engine', { state: 'ready', model: cfg.model });
    tray && tray.setState('idle', 'Ready');
  } catch (e) {
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
  if (dictState === 'processing') {
    hotkeys.reset();
    overlayState('error', { message: 'Still finishing the last one' });
    return;
  }
  if (dictState !== 'idle') return;
  if (engineState !== 'ready') {
    hotkeys.reset();
    overlayState('error', { message: engineState === 'loading' ? 'Model still loading' : 'Open SpeakEasy to finish setup' });
    return;
  }
  dictState = 'recording';
  captureSession += 1;
  chunks = [];
  chunkSamples = 0;
  recordStartedAt = Date.now();
  frontAppPromise = getFrontAppName();
  overlayState('listening');
  tray.setState('recording', 'Listening...');
  captureWindow.webContents.send('capture:start', {
    deviceId: store.settings().micDeviceId,
    session: captureSession
  });
  push('dictation', { phase: 'recording' });
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
  captureWindow.webContents.send('capture:stop');
  await stopped;
  stopWaiter = null;

  const pcm = new Float32Array(chunkSamples);
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  chunks = [];
  chunkSamples = 0;
  captureSession += 1; // anything still in flight from this session is now stale
  return pcm;
}

async function onDictateStop() {
  if (dictState !== 'recording') return;
  dictState = 'processing';
  clearTimeout(maxDurationTimer);
  overlayState('processing');
  tray.setState('processing', 'Computing...');
  push('dictation', { phase: 'processing' });

  try {
    const pcm = await collectAudio();
    const speechSeconds = pcm.length / SAMPLE_RATE;
    if (speechSeconds < MIN_RECORDING_SECONDS) {
      overlayState('cancelled');
      return;
    }

    const t0 = Date.now();
    const { text: rawText, ms: engineMs } = await transcriber.transcribe(pcm, SAMPLE_RATE);
    if (!rawText) {
      overlayState('error', { message: 'Nothing heard' });
      return;
    }

    const { text } = await cleanup(rawText);
    if (!text) {
      overlayState('error', { message: 'Nothing heard' });
      return;
    }

    const ok = await injectText(text, { restoreClipboard: store.settings().restoreClipboard });
    const words = text.split(/\s+/).filter(Boolean).length;
    if (!ok) {
      // Paste failed (no focused field, blocked app): the text stays on the
      // clipboard, tell the user how to recover instead of pretending success.
      overlayState('error', { message: isMac ? 'On clipboard, press ⌘V' : 'On clipboard, press Ctrl+V' });
    }
    const frontApp = await Promise.race([frontAppPromise, Promise.resolve('')]) || '';

    store.recordTranscription(words, speechSeconds);
    store.addHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      text,
      raw: rawText !== text ? rawText : undefined,
      app: frontApp,
      speechSeconds: Math.round(speechSeconds * 10) / 10,
      engineMs,
      totalMs: Date.now() - t0,
      model: store.settings().model,
      pasted: ok
    });

    if (ok) overlayState('done', { words });
    push('dictation', { phase: 'done', text, words });
    push('stats', {});
  } catch (e) {
    console.error('[dictation]', e);
    overlayState('error', { message: 'Transcription failed' });
    push('dictation', { phase: 'error', message: e.message });
  } finally {
    dictState = 'idle';
    tray.setState('idle', 'Ready');
  }
}

function onDictateCancel() {
  if (dictState !== 'recording') return;
  dictState = 'idle';
  clearTimeout(maxDurationTimer);
  captureSession += 1; // drop any in-flight chunks from the cancelled session
  captureWindow.webContents.send('capture:stop');
  chunks = [];
  chunkSamples = 0;
  overlayState('cancelled');
  tray.setState('idle', 'Ready');
  push('dictation', { phase: 'cancelled' });
}

// ---------------------------------------------------------------- capture IPC

ipcMain.on('capture:chunk', (_e, session, pcm, rms) => {
  if (session !== captureSession) return; // stale audio from a previous session
  if (dictState !== 'recording' && dictState !== 'processing') return;
  const arr = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
  chunks.push(arr);
  chunkSamples += arr.length;
  if (dictState === 'recording' && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:level', rms);
  }
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
    overlayWindow.webContents.send('overlay:armed', { sounds: store.settings().sounds });
  }
});

ipcMain.on('capture:error', (_e, message) => {
  console.error('[capture]', message);
  if (dictState === 'recording') {
    dictState = 'idle';
    hotkeys.reset();
    overlayState('error', { message: 'Microphone error' });
    tray.setState('idle', 'Mic error');
  }
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
  return { mic: 'granted', accessibility: true };
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
    engine: { state: engineState },
    permissions: permStatus(),
    platform: process.platform,
    version: app.getVersion()
  };
}

ipcMain.handle('state:get', () => fullState());

ipcMain.handle('settings:update', async (_e, partial) => {
  const before = store.settings();
  const modelChanged = partial.model !== undefined && partial.model !== before.model;
  const langChanged = partial.language !== undefined && partial.language !== before.language;
  const keyChanged = partial.holdKey !== undefined && partial.holdKey !== before.holdKey;
  const loginChanged = partial.launchAtLogin !== undefined && partial.launchAtLogin !== before.launchAtLogin;

  const cfg = store.updateSettings(partial);
  if (keyChanged) hotkeys.setKey(cfg.holdKey);
  if (loginChanged) app.setLoginItemSettings({ openAtLogin: cfg.launchAtLogin });
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
ipcMain.handle('history:remove', (_e, id) => { store.removeHistory(id); return store.history().data; });
ipcMain.handle('history:clear', () => { store.clearHistory(); return []; });

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

ipcMain.handle('mics:list', () => listMics());
ipcMain.handle('clipboard:copy', (_e, text) => { clipboard.writeText(text); return true; });

ipcMain.handle('perm:request-mic', async () => {
  if (isMac) {
    try { await systemPreferences.askForMediaAccess('microphone'); } catch { /* user decides */ }
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
      input: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
    };
    shell.openExternal(urls[pane] || urls.accessibility);
  }
  return true;
});
ipcMain.handle('perm:status', () => permStatus());

// Global key listening needs Accessibility (mac). If it is not granted yet,
// keep retrying quietly so the hotkey comes alive the moment the user grants it.
let hotkeyRetryTimer = null;
function startHotkeysWithRetry() {
  const attempt = () => {
    try {
      hotkeys.start(store.settings().holdKey);
      clearInterval(hotkeyRetryTimer);
      hotkeyRetryTimer = null;
      console.log('[hotkey] listener active');
      return true;
    } catch (e) {
      console.error('[hotkey] not available yet:', e.message);
      return false;
    }
  };
  if (!attempt() && !hotkeyRetryTimer) {
    hotkeyRetryTimer = setInterval(attempt, 8000);
  }
}

// ---------------------------------------------------------------- lifecycle

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(async () => {
    createCaptureWindow();
    createOverlayWindow();
    createMainWindow();

    tray = new TrayController({
      onOpen: () => showMainWindow(),
      onQuit: () => { app.isQuittingForReal = true; app.quit(); }
    });
    tray.ensureTray();

    hotkeys = new HotkeyManager({
      onStart: onDictateStart,
      onStop: onDictateStop,
      onCancel: onDictateCancel
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
    });

    await ensureEngine();

    const cfg = store.settings();
    if (!cfg.onboarded || !cfg.model) {
      showMainWindow();
    } else {
      mainWindow.show(); // first paint, then straight to tray? Keep visible on manual launch.
    }

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
    clearTimeout(overlayHideTimer);
    clearTimeout(maxDurationTimer);
    globalShortcut.unregisterAll();
    try { hotkeys && hotkeys.stop(); } catch { /* shutting down */ }
    transcriber.dispose();
  });

  app.on('window-all-closed', () => {
    // Stay alive in the tray on all platforms
  });
}
