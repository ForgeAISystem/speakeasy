'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureBridge', {
  onStart: (cb) => ipcRenderer.on('capture:start', (_e, opts) => cb(opts)),
  onStop: (cb) => ipcRenderer.on('capture:stop', () => cb()),
  onListMics: (cb) => ipcRenderer.on('capture:list-mics', (_e, reqId) => cb(reqId)),
  onGenIcons: (cb) => ipcRenderer.on('capture:gen-icons', () => cb()),
  sendChunk: (pcm, rms) => ipcRenderer.send('capture:chunk', pcm, rms),
  sendStopped: () => ipcRenderer.send('capture:stopped'),
  sendError: (message) => ipcRenderer.send('capture:error', message),
  sendMics: (reqId, mics) => ipcRenderer.send('capture:mics', reqId, mics),
  sendIcons: (icons) => ipcRenderer.send('capture:icons', icons)
});
