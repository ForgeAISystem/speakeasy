'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const archive = path.join(root, 'dist/mac-arm64/SpeakEasy.app/Contents/Resources/app.asar');
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(path.relative(root, file));
  }
}
walk(path.join(root, 'src'));
const failures = files.filter((file) => digest(fs.readFileSync(path.join(root, file))) !== digest(asar.extractFile(archive, file)));
const packed = JSON.parse(asar.extractFile(archive, 'package.json'));
if (packed.version !== version) failures.push('package.json version');
const helper = 'Contents/Resources/native/speakeasy-fn';
if (digest(fs.readFileSync(path.join(root, 'build/native/speakeasy-fn'))) !== digest(fs.readFileSync(path.join(root, 'dist/mac-arm64/SpeakEasy.app', helper)))) failures.push('native Fn helper');
const windowHelper = 'Contents/Resources/native/speakeasy-window';
if (digest(fs.readFileSync(path.join(root, 'build/native/speakeasy-window'))) !== digest(fs.readFileSync(path.join(root, 'dist/mac-arm64/SpeakEasy.app', windowHelper)))) failures.push('native window helper');
const dmg = path.join(root, `dist/SpeakEasy-${version}-arm64.dmg`);
const result = { version, sourceFilesChecked: files.length, failures,
  artworkPackaged: files.includes('src/app/assets/voice-glass.png'),
  dmg: { file: path.basename(dmg), bytes: fs.statSync(dmg).size, sha256: digest(fs.readFileSync(dmg)) } };
const out = path.join(root, 'docs/verification', `v${version}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'package-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (failures.length) process.exitCode = 1;
