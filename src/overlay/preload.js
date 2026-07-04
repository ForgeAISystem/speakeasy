'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onState: (cb) => ipcRenderer.on('overlay:state', (_e, payload) => cb(payload)),
  onLevel: (cb) => ipcRenderer.on('overlay:level', (_e, rms) => cb(rms)),
  onArmed: (cb) => ipcRenderer.on('overlay:armed', (_e, payload) => cb(payload))
});
