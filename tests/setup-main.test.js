'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const handlers = new Map();
  const writes = [];
  const lifecycle = new Map(), windowEvents = new Map();
  const permissions = { mic: 'granted', accessibility: true };
  const app = {
    requestSingleInstanceLock: () => true, on: (event, fn) => lifecycle.set(event, fn), whenReady: () => new Promise(() => {}),
    setLoginItemSettings: (value) => writes.push(['login', value]),
    isPackaged: true, isInApplicationsFolder: () => false,
    moveToApplicationsFolder: () => { writes.push(['install']); return true; }
  };
  const modules = {
    electron: { app, BrowserWindow: class {
      constructor(options) { writes.push(['window', options]); }
      loadFile() {} once() {} on(event, fn) { windowEvents.set(event, fn); }
      hide() { writes.push(['hide']); } show() {} focus() {}
      isDestroyed() { return false; } isMinimized() { return false; }
      getNormalBounds() { return { x: -1100, y: 100, width: 600, height: 500 }; }
    },
      screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 25, width: 1440, height: 875 } }],
        getPrimaryDisplay: () => ({ workArea: { x: 0, y: 25, width: 1440, height: 875 } }) },
      ipcMain: { handle: (name, cb) => handlers.set(name, cb), on() {} },
      systemPreferences: { getMediaAccessStatus: () => permissions.mic, isTrustedAccessibilityClient: () => permissions.accessibility } },
    './store': { updateSettings: (value) => writes.push(['settings', value]), settings: () => ({}),
      windowState: () => ({}), saveWindowState: (value) => writes.push(['bounds', value]) },
    './window-bounds': require('../src/main/window-bounds'),
    './cleanup': {}, './injector': {}, './hotkey': {}, './models': {}, './tray': {}, './audio-store': {},
    './transcriber': { TranscriberManager: class {} },
    './system-audio': { setDictationMute() {}, restoreNow() {} }, './control-pad': { ControlPad: class {} }, './globe-key': {}, './commands': { wakeCommand: () => null }, './guide': { GuideRunner: class {}, toGuideEvent: () => null }, '../shared/guides': require('../src/shared/guides'), './wispr-import': { readWispr: async () => ({ available: false, words: [], snippets: [] }) },
    '../shared/quiet-point': require('../src/shared/quiet-point'),
    '../shared/constants': require('../src/shared/constants'),
    '../shared/writing': require('../src/shared/writing')
  };
  const context = vm.createContext({ require: (id) => modules[id] || require(id),
    __dirname: path.join(__dirname, '../src/main'),
    process: { platform: 'darwin', env: {}, on() {} }, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/main/index.js'), 'utf8'), context);
  return { handlers, writes, permissions, lifecycle, windowEvents, set: (code) => vm.runInContext(code, context) };
}

test('main process refuses setup completion without a successful practice dictation', () => {
  const f = fixture();
  f.set("engineState = 'ready'; hotkeys = { running: true };");
  assert.equal(f.handlers.get('setup:complete')(null, true).ok, false);
  assert.equal(f.writes.length, 0);
});

test('revoked permissions block completion even after a successful test', () => {
  const f = fixture();
  f.set("setupHasDictated = true; engineState = 'ready'; hotkeys = { running: true };");
  f.permissions.mic = 'denied';
  assert.equal(f.handlers.get('setup:complete')(null, true).ok, false);
  f.permissions.mic = 'granted';
  f.permissions.accessibility = false;
  assert.equal(f.handlers.get('setup:complete')(null, true).ok, false);
  assert.equal(f.writes.length, 0);
});

test('completed setup saves only the explicit launch preference', () => {
  const f = fixture();
  f.set("setupHasDictated = true; engineState = 'ready'; hotkeys = { running: true };");
  assert.equal(f.handlers.get('setup:complete')(null, false).ok, true);
  assert.equal(f.writes[0][1].onboarded, true);
  assert.equal(f.writes[0][1].launchAtLogin, false);
  assert.equal(f.writes[1][1].openAtLogin, false);
});

test('install button delegates the move only for a packaged Mac app outside Applications', () => {
  const f = fixture();
  assert.equal(f.handlers.get('app:install')().ok, true);
  assert.equal(f.writes[0][0], 'install');
});

test('closing the window hides it, but a native Quit closes it without interception', () => {
  const f = fixture();
  f.set('createMainWindow()');
  let prevented = 0;
  const close = () => f.windowEvents.get('close')({ preventDefault: () => prevented++ });
  close();
  assert.equal(prevented, 1);
  assert.equal(f.writes.at(-2)[0], 'bounds');
  assert.equal(f.writes.at(-1)[0], 'hide');
  f.lifecycle.get('before-quit')();
  close();
  assert.equal(prevented, 1);
});

test('main window retains native movement and resize controls during onboarding', () => {
  const f = fixture();
  f.set('createMainWindow()');
  const options = f.writes.find((row) => row[0] === 'window')[1];
  assert.equal(options.titleBarStyle, 'default');
  for (const key of ['frame', 'movable', 'resizable', 'minimizable', 'maximizable', 'fullscreenable']) assert.equal(options[key], true);
  assert.equal(options.minWidth, 560);
  assert.equal(options.minHeight, 480);
  assert.equal(options.vibrancy, undefined);
  assert.equal(options.alwaysOnTop, undefined);
});

test('explicitly reopening a minimized main window restores it', () => {
  const f = fixture();
  f.set('createMainWindow(); mainWindow.isMinimized = () => true; mainWindow.restore = () => { mainWindow.restored = true; }; showMainWindow();');
  assert.equal(f.set('mainWindow.restored'), true);
});

test('window movement is saved once after settling and flushed before close', async () => {
  const f = fixture();
  f.set('createMainWindow()');
  f.windowEvents.get('move')();
  f.windowEvents.get('resize')();
  f.windowEvents.get('move')();
  assert.equal(f.writes.filter((row) => row[0] === 'bounds').length, 0);
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(f.writes.filter((row) => row[0] === 'bounds').length, 1);
  assert.equal(f.writes.find((row) => row[0] === 'bounds')[1].x, -1100);
  f.windowEvents.get('resize')();
  f.windowEvents.get('close')({ preventDefault() {} });
  assert.equal(f.writes.filter((row) => row[0] === 'bounds').length, 2);
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(f.writes.filter((row) => row[0] === 'bounds').length, 2);
});
