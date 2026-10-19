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

// One key press in the front app. mac: System Events key code + modifiers;
// other platforms: the closest SendKeys / xdotool form.
const KEYS = {
  paste: { mac: 'keystroke "v" using command down', win: '^v', x11: 'ctrl+v' },
  copy: { mac: 'keystroke "c" using command down', win: '^c', x11: 'ctrl+c' },
  undo: { mac: 'keystroke "z" using command down', win: '^z', x11: 'ctrl+z' },
  newline: { mac: 'key code 36 using shift down', win: '+{ENTER}', x11: 'shift+Return' }
};

async function press(name, times = 1) {
  const k = KEYS[name];
  const n = Math.max(1, Math.floor(times));
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', n === 1 ? `tell application "System Events" to ${k.mac}` : `tell application "System Events"\nrepeat ${n} times\n${k.mac}\nend repeat\nend tell`]);
  } else if (process.platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$w = New-Object -ComObject wscript.shell; $w.SendKeys('${k.win.repeat(n)}')`]);
  } else {
    await run('xdotool', ['key', '--clearmodifiers', '--repeat', String(n), k.x11]);
  }
}

async function simulatePaste() {
  await press('paste');
}

// Deletes characters before the cursor (terminal undo, where Cmd+Z does nothing).
async function backspace(count) {
  const n = Math.min(4000, Math.max(0, Math.floor(count)));
  if (!n) return;
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', `tell application "System Events"\nrepeat ${n} times\nkey code 51\nend repeat\nend tell`]);
  } else if (process.platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$w = New-Object -ComObject wscript.shell; $w.SendKeys('{BACKSPACE ${n}}')`]);
  } else {
    await run('xdotool', ['key', '--clearmodifiers', '--repeat', String(n), 'BackSpace']);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastTranscript = '';
let injectChain = Promise.resolve();

/**
 * Insert text into the focused app: clipboard write -> simulated paste -> clipboard restore.
 * Same mechanism Wispr Flow uses. Restore is delayed so the paste lands first.
 * Calls are serialized: concurrent injections (dictation + paste-last hotkey)
 * would otherwise race the clipboard save/restore.
 */
function injectText(text, opts = {}) {
  return serial(() => doInject(text, opts));
}

function serial(task) {
  const job = injectChain.then(task, task);
  injectChain = job.catch(() => {});
  return job;
}

// The clipboard the user really owns right now: a pending restore's snapshot
// beats what is on the clipboard (that is our own pasted text).
function takeSnapshot() {
  if (pendingRestore) {
    clearTimeout(pendingRestore.timer);
    const { prevText, prevImage } = pendingRestore;
    pendingRestore = null;
    return { prevText, prevImage };
  }
  const prevText = clipboard.readText();
  return { prevText, prevImage: prevText ? null : clipboard.readImage() };
}

function putBack({ prevText, prevImage }) {
  if (prevText) clipboard.writeText(prevText);
  else if (prevImage && !prevImage.isEmpty()) clipboard.writeImage(prevImage);
  else clipboard.clear();
}

let pendingRestore = null; // {timer, prevText, prevImage}

/**
 * opts.terminal: paste line by line and press Shift+Return between lines, so
 * a newline never reaches a terminal as Return (which would send the prompt).
 */
async function doInject(text, { restoreClipboard = true, terminal = false } = {}) {
  if (!text) return false;
  lastTranscript = text;

  const snapshot = takeSnapshot();
  const parts = terminal ? text.split('\n') : [text];
  let written = '';
  try {
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        if (written) await sleep(80); // let the app read the previous line first
        written = parts[i];
        clipboard.writeText(written);
        // Small settle delay so the clipboard write is visible to the target app
        await sleep(60);
        await simulatePaste();
      }
      if (i < parts.length - 1) {
        if (written) await sleep(40);
        await press('newline');
      }
    }
  } catch (e) {
    console.error('[inject] paste failed, text remains on clipboard:', e.message);
    if (!written) clipboard.writeText(text);
    return false;
  }
  if (!written) { putBack(snapshot); return true; }
  if (restoreClipboard) {
    const entry = { ...snapshot, timer: null };
    entry.timer = setTimeout(() => {
      if (pendingRestore === entry) pendingRestore = null;
      // Only restore if nothing else claimed the clipboard in the meantime
      if (clipboard.readText() !== written) return;
      putBack(snapshot);
    }, 900);
    pendingRestore = entry;
  }
  return true;
}

/**
 * Copies the selection in the front app with Cmd+C and puts the clipboard
 * back. Returns the selected text, or '' when nothing text-like is selected.
 */
function copySelection({ timeoutMs = 700 } = {}) {
  return serial(async () => {
    const snapshot = takeSnapshot();
    const marker = `speakeasy-selection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    clipboard.writeText(marker);
    let text = '';
    try {
      await sleep(30);
      await press('copy');
      for (let waited = 0; waited < timeoutMs; waited += 40) {
        await sleep(40);
        const now = clipboard.readText();
        if (now !== marker) { text = now; break; }
      }
    } catch (e) {
      console.error('[inject] copy failed:', e.message);
    } finally {
      putBack(snapshot);
    }
    return text;
  });
}

/**
 * Takes back the last paste and, when given, puts `restore` in its place.
 * Text fields: Cmd+Z undoes the paste (a rewrite gets its selection back).
 * Terminals ignore Cmd+Z, so the pasted characters are deleted instead.
 */
function undoPaste({ terminal = false, pasted = '', restore = '', restoreClipboard = true } = {}) {
  return serial(async () => {
    try {
      if (terminal) await backspace(pasted.length);
      else await press('undo');
      await sleep(120);
    } catch (e) {
      console.error('[inject] undo failed:', e.message);
      return false;
    }
    return restore ? doInject(restore, { restoreClipboard, terminal }) : true;
  });
}

function getLastTranscript() {
  return lastTranscript;
}
function setLastTranscript(t) {
  lastTranscript = t;
}

/**
 * Frontmost app and window title (best effort). The app name lands in History;
 * both pick the writing style. The title never leaves this computer.
 */
async function getFrontContext() {
  try {
    if (process.platform === 'darwin') {
      const out = await run('osascript', ['-e', `tell application "System Events"
  set p to first application process whose frontmost is true
  set t to ""
  try
    set t to name of front window of p
  end try
  return (name of p) & linefeed & t
end tell`]);
      const [app = '', title = ''] = out.replace(/\n$/, '').split('\n');
      return { app: app.trim(), title: title.trim() };
    }
    if (process.platform === 'win32') {
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Add-Type @"\nusing System;using System.Runtime.InteropServices;public class FG{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}\n"@; $h=[FG]::GetForegroundWindow(); $p=0; [FG]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null; $q=Get-Process -Id $p; $q.ProcessName; $q.MainWindowTitle']);
      const [app = '', title = ''] = out.split(/\r?\n/);
      return { app: app.trim(), title: title.trim() };
    }
  } catch { /* best effort */ }
  return { app: '', title: '' };
}

module.exports = { injectText, copySelection, undoPaste, getLastTranscript, setLastTranscript, getFrontContext };
