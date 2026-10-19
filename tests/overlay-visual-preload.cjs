const { contextBridge } = require('electron');
let state, armed;
contextBridge.exposeInMainWorld('overlayBridge', {
  onState: (callback) => { state = callback; }, onArmed: (callback) => { armed = callback; }, onLevel() {}
});
contextBridge.exposeInMainWorld('overlayFixture', {
  show: (phase) => {
    if (phase === 'rewrite-armed') { state({ state: 'listening', rewrite: true, sounds: false, subtleMotion: false }); armed({ sounds: false }); return; }
    if (phase === 'rewriting') { state({ state: 'processing', phase: 'rewrite', transform: 'Shorter', sounds: false, subtleMotion: false }); return; }
    if (phase === 'rewrite') {
      state({ state: 'rewrite', transform: 'Shorter', before: 64, after: 22, undo: 'Command+Control+Z', sounds: false, subtleMotion: false,
        preview: 'Ship the first version this week. Keep it to one clear idea, and cut everything that does not serve it.' });
      return;
    }
    state({ state: phase === 'armed' ? 'listening' : phase, sounds: false, subtleMotion: false,
      message: phase === 'error' ? 'Microphone unavailable. Check Settings.' : '' });
    if (phase === 'armed') armed({ sounds: false });
  }
});
