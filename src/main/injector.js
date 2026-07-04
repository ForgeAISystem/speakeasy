'use strict';

const { clipboard } = require('electron');
const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function simulatePaste() {
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
  } else if (process.platform === 'win32') {
    await run('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      '$w = New-Object -ComObject wscript.shell; $w.SendKeys(\'^v\')'
    ]);
  } else {
    await run('xdotool', ['key', '--clearmodifiers', 'ctrl+v']);
  }
}

let lastTranscript = '';
let injectChain = Promise.resolve();

/**
 * Insert text into the focused app: clipboard write -> simulated paste -> clipboard restore.
 * Same mechanism Wispr Flow uses. Restore is delayed so the paste lands first.
 * Calls are serialized: concurrent injections (dictation + paste-last hotkey)
 * would otherwise race the clipboard save/restore.
 */
function injectText(text, opts = {}) {
  const run = injectChain.then(() => doInject(text, opts), () => doInject(text, opts));
  injectChain = run.catch(() => {});
  return run;
}

let pendingRestore = null; // {timer, prevText, prevImage}

async function doInject(text, { restoreClipboard = true } = {}) {
  if (!text) return false;
  lastTranscript = text;

  // If a previous injection's restore hasn't fired yet, inherit ITS snapshot:
  // that snapshot is the user's real clipboard, ours would be the old transcript.
  let prevText, prevImage;
  if (pendingRestore) {
    clearTimeout(pendingRestore.timer);
    ({ prevText, prevImage } = pendingRestore);
    pendingRestore = null;
  } else {
    prevText = clipboard.readText();
    prevImage = prevText ? null : clipboard.readImage();
  }

  clipboard.writeText(text);
  // Small settle delay so the clipboard write is visible to the target app
  await new Promise((r) => setTimeout(r, 60));
  try {
    await simulatePaste();
  } catch (e) {
    console.error('[inject] paste failed, text remains on clipboard:', e.message);
    return false;
  }
  if (restoreClipboard) {
    const entry = { prevText, prevImage, timer: null };
    entry.timer = setTimeout(() => {
      if (pendingRestore === entry) pendingRestore = null;
      // Only restore if nothing else claimed the clipboard in the meantime
      if (clipboard.readText() !== text) return;
      if (prevText) clipboard.writeText(prevText);
      else if (prevImage && !prevImage.isEmpty()) clipboard.writeImage(prevImage);
      else clipboard.clear();
    }, 900);
    pendingRestore = entry;
  }
  return true;
}

function getLastTranscript() {
  return lastTranscript;
}
function setLastTranscript(t) {
  lastTranscript = t;
}

/** Frontmost app name (mac best-effort, used for history + context). */
async function getFrontAppName() {
  try {
    if (process.platform === 'darwin') {
      const out = await run('osascript', ['-e',
        'tell application "System Events" to get name of first application process whose frontmost is true']);
      return out.trim();
    }
    if (process.platform === 'win32') {
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Add-Type @"\nusing System;using System.Runtime.InteropServices;public class FG{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}\n"@; $h=[FG]::GetForegroundWindow(); $p=0; [FG]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null; (Get-Process -Id $p).ProcessName']);
      return out.trim();
    }
  } catch { /* best effort */ }
  return '';
}

module.exports = { injectText, getLastTranscript, setLastTranscript, getFrontAppName };
