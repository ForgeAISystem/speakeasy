'use strict';
const bridge = window.padBridge;
const UI = window.SpeakEasyPadUI;
const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
let pads = {};

bridge.onShow(({ pads: next, target }) => {
  pads = next;
  document.getElementById('target').textContent = target ? `Moving: ${target}` : 'No window picked';
  gridEl.innerHTML = UI.grid(pads);
  statusEl.textContent = 'Tap a key or click a pad';
  statusEl.className = '';
  document.getElementById('pad').classList.remove('in');
  void gridEl.offsetWidth;
  document.getElementById('pad').classList.add('in');
});

bridge.onResult((event) => {
  UI.flash(gridEl, event);
  statusEl.textContent = event.message || '';
  statusEl.className = event.ok ? 'ok' : 'fail';
});

gridEl.addEventListener('click', (e) => {
  const tile = e.target.closest('.pad-tile');
  if (!tile) return;
  UI.flash(gridEl, { key: tile.dataset.key, phase: 'hit' });
  if (e.shiftKey) bridge.save(tile.dataset.key); else bridge.press(tile.dataset.key);
});
