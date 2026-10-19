'use strict';

const { execFile } = require('child_process');

// macOS decides what the Globe/Fn key does before any app sees it, so an event
// tap cannot stop "Press Globe key to: Show Emoji & Symbols" (the picker that
// opens on a double-tap). The fix is the same preference System Settings writes:
// com.apple.HIToolbox AppleFnUsageType. 0 = Do Nothing, 1 = Change Input Source,
// 2 = Show Emoji & Symbols, 3 = Start Dictation. Unset behaves like 2.
const DOMAIN = 'com.apple.HIToolbox';
const KEY = 'AppleFnUsageType';
const ACTIVATE = '/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings';

function run(cmd, args, exec = execFile) {
  return new Promise((resolve, reject) => {
    exec(cmd, args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) { err.stderr = String(stderr || ''); reject(err); } else resolve(String(stdout || ''));
    });
  });
}

/** null = never set (macOS treats it as Show Emoji & Symbols). */
async function readUsage(exec) {
  try {
    const value = parseInt((await run('defaults', ['read', DOMAIN, KEY], exec)).trim(), 10);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

async function status({ platform = process.platform, exec } = {}) {
  if (platform !== 'darwin') return { supported: false, value: null, opensPopup: false };
  const value = await readUsage(exec);
  return { supported: true, value, opensPopup: value !== 0 };
}

async function apply(value, exec) {
  if (value === null) await run('defaults', ['delete', DOMAIN, KEY], exec).catch(() => {});
  else await run('defaults', ['write', DOMAIN, KEY, '-int', String(value)], exec);
  // Asks running apps to reread keyboard preferences without a logout.
  await run(ACTIVATE, ['-u'], exec).catch(() => {});
}

/** Sets the Globe key to Do Nothing. Returns the old value so Undo can put it back. */
async function fix({ exec } = {}) {
  const previous = await readUsage(exec);
  await apply(0, exec);
  const now = await readUsage(exec);
  return { ok: now === 0, previous };
}

async function restore(previous, { exec } = {}) {
  await apply(previous === undefined ? null : previous, exec);
  return { ok: true };
}

module.exports = { status, fix, restore, DOMAIN, KEY };
