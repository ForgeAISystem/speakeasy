'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('padBridge', {
  onShow: (cb) => ipcRenderer.on('pad:show', (_e, payload) => cb(payload)),
  onResult: (cb) => ipcRenderer.on('pad:result', (_e, payload) => cb(payload)),
  onListening: (cb) => ipcRenderer.on('pad:listening', () => cb()),
  onPlan: (cb) => ipcRenderer.on('pad:plan', (_e, payload) => cb(payload)),
  onStep: (cb) => ipcRenderer.on('pad:step', (_e, payload) => cb(payload)),
  onPeek: (cb) => ipcRenderer.on('pad:peek', (_e, payload) => cb(payload)),
  onTip: (cb) => ipcRenderer.on('tip:show', (_e, payload) => cb(payload)),
  starter: (goal) => ipcRenderer.invoke('pad:starter', goal),
  peek: () => ipcRenderer.invoke('pad:peek'),
  confirm: () => ipcRenderer.invoke('pad:confirm'),
  press: (key) => ipcRenderer.invoke('pad:press', key, 'click'),
  save: (key) => ipcRenderer.invoke('pad:save', key),
  close: () => ipcRenderer.invoke('pad:close')
});
