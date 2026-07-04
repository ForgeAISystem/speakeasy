'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('speakeasy', {
  getState: () => ipcRenderer.invoke('state:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  downloadModel: (id) => ipcRenderer.invoke('models:download', id),
  removeModel: (id) => ipcRenderer.invoke('models:remove', id),
  historyList: () => ipcRenderer.invoke('history:list'),
  historyRemove: (id) => ipcRenderer.invoke('history:remove', id),
  historyClear: () => ipcRenderer.invoke('history:clear'),
  dictList: () => ipcRenderer.invoke('dict:list'),
  dictSave: (entries) => ipcRenderer.invoke('dict:save', entries),
  snippetsList: () => ipcRenderer.invoke('snippets:list'),
  snippetsSave: (entries) => ipcRenderer.invoke('snippets:save', entries),
  listMics: () => ipcRenderer.invoke('mics:list'),
  copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  permStatus: () => ipcRenderer.invoke('perm:status'),
  requestMic: () => ipcRenderer.invoke('perm:request-mic'),
  requestAccessibility: () => ipcRenderer.invoke('perm:request-accessibility'),
  openPermSettings: (pane) => ipcRenderer.invoke('perm:open-settings', pane),
  onPush: (cb) => ipcRenderer.on('push', (_e, payload) => cb(payload))
});
