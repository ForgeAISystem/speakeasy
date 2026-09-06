const { contextBridge } = require('electron');
let state, armed;
contextBridge.exposeInMainWorld('overlayBridge', {
  onState: (callback) => { state = callback; }, onArmed: (callback) => { armed = callback; }, onLevel() {}
});
contextBridge.exposeInMainWorld('overlayFixture', {
  show: (phase) => {
    state({ state: phase === 'armed' ? 'listening' : phase, sounds: false, subtleMotion: false,
      message: phase === 'error' ? 'Microphone unavailable. Check Settings.' : '' });
    if (phase === 'armed') armed({ sounds: false });
  }
});
