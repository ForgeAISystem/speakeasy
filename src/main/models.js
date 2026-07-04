'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');
const { spawn } = require('child_process');
const { MODELS } = require('../shared/constants');

function modelsRoot() {
  const dir = path.join(app.getPath('userData'), 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function modelDir(id) {
  const m = MODELS[id];
  return m ? path.join(modelsRoot(), m.dir) : null;
}

function isInstalled(id) {
  const dir = modelDir(id);
  if (!dir) return false;
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.onnx'));
  } catch {
    return false;
  }
}

function installedModels() {
  return Object.keys(MODELS).filter(isInstalled);
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'speakeasy' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location, dest, onProgress).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress && total) onProgress(received / total);
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('download timeout')));
  });
}

function extractTarBz2(file, destDir) {
  return new Promise((resolve, reject) => {
    // System tar handles .tar.bz2 on macOS, Windows 10+ (bsdtar), and Linux
    const p = spawn('tar', ['-xjf', file, '-C', destDir]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}: ${err}`))));
    p.on('error', reject);
  });
}

const activeDownloads = new Map(); // id -> progress 0..1 (-1 = extracting)

/**
 * Download + extract a model. onProgress(id, fraction) — fraction of download,
 * then -1 while extracting, then 1 when done.
 */
async function downloadModel(id, onProgress) {
  const m = MODELS[id];
  if (!m) throw new Error(`unknown model ${id}`);
  if (isInstalled(id)) return modelDir(id);
  if (activeDownloads.has(id)) throw new Error('download already in progress');

  const root = modelsRoot();
  const tarball = path.join(root, `${m.dir}.tar.bz2`);
  activeDownloads.set(id, 0);
  try {
    await download(m.url, tarball, (f) => {
      activeDownloads.set(id, f);
      onProgress && onProgress(id, f);
    });
    activeDownloads.set(id, -1);
    onProgress && onProgress(id, -1);
    await extractTarBz2(tarball, root);
    if (!isInstalled(id)) throw new Error('extraction finished but no .onnx files found');
    onProgress && onProgress(id, 1);
    return modelDir(id);
  } finally {
    activeDownloads.delete(id);
    fs.rmSync(tarball, { force: true });
  }
}

function removeModel(id) {
  const dir = modelDir(id);
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}

function downloadStatus() {
  return Object.fromEntries(activeDownloads);
}

module.exports = { modelsRoot, modelDir, isInstalled, installedModels, downloadModel, removeModel, downloadStatus };
