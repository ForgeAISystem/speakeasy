'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureBridge', {
  onStart: (cb) => ipcRenderer.on('capture:start', (_e, opts) => cb(opts)),
  onStop: (cb) => ipcRenderer.on('capture:stop', () => cb()),
  onListMics: (cb) => ipcRenderer.on('capture:list-mics', (_e, reqId) => cb(reqId)),
  onGenIcons: (cb) => ipcRenderer.on('capture:gen-icons', () => cb()),
  sendChunk: (session, pcm, rms) => ipcRenderer.send('capture:chunk', session, pcm, rms),
  sendArmed: (session) => ipcRenderer.send('capture:armed', session),
  sendStopped: (session) => ipcRenderer.send('capture:stopped', session),
  sendError: (session, message) => ipcRenderer.send('capture:error', session, message),
  sendMics: (reqId, mics) => ipcRenderer.send('capture:mics', reqId, mics),
  sendIcons: (icons) => ipcRenderer.send('capture:icons', icons)
});
