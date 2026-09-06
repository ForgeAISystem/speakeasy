'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const handlers = new Map();
  const writes = [];
  const permissions = { mic: 'granted', accessibility: true };
  const app = {
    requestSingleInstanceLock: () => true, on() {}, whenReady: () => new Promise(() => {}),
    setLoginItemSettings: (value) => writes.push(['login', value]),
    isPackaged: true, isInApplicationsFolder: () => false,
    moveToApplicationsFolder: () => { writes.push(['install']); return true; }
  };
  const modules = {
    electron: { app, ipcMain: { handle: (name, cb) => handlers.set(name, cb), on() {} },
      systemPreferences: { getMediaAccessStatus: () => permissions.mic, isTrustedAccessibilityClient: () => permissions.accessibility } },
    './store': { updateSettings: (value) => writes.push(['settings', value]), settings: () => ({}) },
    './cleanup': {}, './injector': {}, './hotkey': {}, './models': {}, './tray': {}, './audio-store': {},
    './transcriber': { TranscriberManager: class {} },
    '../shared/constants': require('../src/shared/constants')
  };
  const context = vm.createContext({ require: (id) => modules[id] || require(id),
    __dirname: path.join(__dirname, '../src/main'),
    process: { platform: 'darwin', env: {}, on() {} }, console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/main/index.js'), 'utf8'), context);
  return { handlers, writes, permissions, set: (code) => vm.runInContext(code, context) };
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
