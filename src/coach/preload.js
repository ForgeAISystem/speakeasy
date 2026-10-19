'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coachBridge', {
  onState: (cb) => ipcRenderer.on('coach:state', (_e, view) => cb(view)),
  next: () => ipcRenderer.invoke('guide:next'),
  back: () => ipcRenderer.invoke('guide:back'),
  stop: () => ipcRenderer.invoke('guide:stop'),
  start: (id, mode) => ipcRenderer.invoke('guide:start', id, mode),
  action: (run) => ipcRenderer.invoke('guide:action', run)
});
