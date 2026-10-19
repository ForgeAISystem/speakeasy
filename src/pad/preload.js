'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('padBridge', {
  onShow: (cb) => ipcRenderer.on('pad:show', (_e, payload) => cb(payload)),
  onResult: (cb) => ipcRenderer.on('pad:result', (_e, payload) => cb(payload)),
  press: (key) => ipcRenderer.invoke('pad:press', key, 'click'),
  save: (key) => ipcRenderer.invoke('pad:save', key),
  close: () => ipcRenderer.invoke('pad:close')
});
