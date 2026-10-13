'use strict';

// Optional "mute while dictating": silences system output for the length of a
// recording, then restores it. Only audio this module muted is unmuted, and
// calls are chained so a quick cancel never races the mute.
const { execFile, execFileSync } = require('child_process');

let mutedByUs = false;
let chain = Promise.resolve();

function osascript(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 3000 }, (err, stdout) => (err ? reject(err) : resolve(stdout.trim())));
  });
}

function setDictationMute(on) {
  if (process.platform !== 'darwin') return chain;
  chain = chain.then(async () => {
    if (on && !mutedByUs) {
      if (await osascript('output muted of (get volume settings)') !== 'false') return;
      await osascript('set volume with output muted');
      mutedByUs = true;
    } else if (!on && mutedByUs) {
      mutedByUs = false;
      await osascript('set volume without output muted');
    }
  }).catch((e) => console.error('[audio] mute toggle failed:', e.message));
  return chain;
}

// Synchronous restore for app shutdown, where async work may never finish.
function restoreNow() {
  if (!mutedByUs) return;
  mutedByUs = false;
  try { execFileSync('osascript', ['-e', 'set volume without output muted'], { timeout: 3000 }); } catch { /* best effort */ }
}

module.exports = { setDictationMute, restoreNow };
