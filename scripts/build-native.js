'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform === 'darwin') {
  const root = path.join(__dirname, '..');
  const output = path.join(root, 'build', 'native');
  fs.mkdirSync(output, { recursive: true });
  // Universal helper: both Mac installer architectures use the same resource.
  execFileSync('xcrun', ['clang', '-O2', '-Wall', '-Wextra', '-Wno-unused-parameter',
    '-arch', 'arm64', '-arch', 'x86_64', '-mmacosx-version-min=12.0',
    '-framework', 'ApplicationServices', path.join(root, 'native', 'fn-key.c'),
    '-o', path.join(output, 'speakeasy-fn')], { stdio: 'inherit' });
  execFileSync('xcrun', ['clang', '-O2', '-Wall', '-Wextra', '-Wno-unused-parameter',
    '-arch', 'arm64', '-arch', 'x86_64', '-mmacosx-version-min=12.0',
    '-framework', 'ApplicationServices', path.join(root, 'native', 'window.c'),
    '-o', path.join(output, 'speakeasy-window')], { stdio: 'inherit' });
  console.log('Built universal Mac Fn listener and window helper.');
}
