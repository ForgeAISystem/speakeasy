'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scratchBridge', {
  load: () => ipcRenderer.invoke('scratch:load'),
  save: (text) => ipcRenderer.invoke('scratch:save', text),
  send: (text) => ipcRenderer.invoke('scratch:send', text),
  close: () => ipcRenderer.invoke('scratch:close'),
  onFocus: (cb) => ipcRenderer.on('scratch:focus', () => cb())
});
