'use strict';
const bridge = window.padBridge;
const UI = window.SpeakEasyPadUI;
const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
let pads = {};

const planEl = document.getElementById('plan');
const READY = 'Tap a key, or hold <kbd>fn</kbd> and say it';

bridge.onShow(({ pads: next, target, keepPlan }) => {
  pads = next;
  if (keepPlan) { gridEl.innerHTML = UI.grid(pads); return; }
  planEl.hidden = true;
  document.getElementById('pad').classList.remove('listening');
  document.getElementById('target').textContent = target ? `Moving: ${target}` : 'No window picked';
  gridEl.innerHTML = UI.grid(pads);
  statusEl.innerHTML = READY;
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

bridge.onListening(() => {
  document.getElementById('pad').classList.add('listening');
  statusEl.textContent = 'Listening. Say what to do, then let go of fn.';
  statusEl.className = '';
});

bridge.onPlan((plan) => {
  document.getElementById('pad').classList.remove('listening');
  planEl.hidden = false;
  document.getElementById('plan-eyebrow').textContent = plan.via === 'claude' ? 'YOU SAID · PLANNED BY CLAUDE' : 'YOU SAID';
  document.getElementById('plan-heard').textContent = plan.heard ? `“${plan.heard}”` : 'Nothing heard';
  document.getElementById('plan-steps').innerHTML = plan.steps.map((st, i) => `<li data-i="${i}" class="${st.confirm ? 'confirm' : ''}"><span class="mark"></span><span class="txt">${UI.esc(st.text)}</span><span class="msg"></span></li>`).join('');
  document.getElementById('plan-reply').classList.remove('note');
  document.getElementById('plan-reply').textContent = plan.reply || (plan.steps.length ? '' : 'Nothing to run.');
  document.getElementById('plan-actions').hidden = !plan.confirm;
  statusEl.textContent = plan.confirm ? 'Check it, then press Return' : plan.steps.length ? 'Running' : 'Try again with fn';
  statusEl.className = plan.steps.length ? '' : 'fail';
});

bridge.onStep(({ i, state, message }) => {
  const li = document.querySelector(`#plan-steps li[data-i="${i}"]`);
  if (!li) return;
  document.getElementById('plan-actions').hidden = true;
  li.classList.remove('run', 'ok', 'fail');
  li.classList.add(state);
  if (message && state !== 'run') li.querySelector('.msg').textContent = state === 'fail' ? message : '';
  const all = [...document.querySelectorAll('#plan-steps li')];
  if (all.every((x) => x.classList.contains('ok') || x.classList.contains('fail'))) {
    const failed = all.filter((x) => x.classList.contains('fail')).length;
    statusEl.textContent = failed ? `${failed} step${failed === 1 ? '' : 's'} did not work` : 'Done';
    statusEl.className = failed ? 'fail' : 'ok';
  }
});

document.getElementById('plan-run').addEventListener('click', () => bridge.confirm());

bridge.onNote(({ title, text }) => {
  const reply = document.getElementById('plan-reply');
  reply.classList.add('note');
  reply.textContent = (title ? title + '\n\n' : '') + text + '\n\nCopied. Paste it anywhere.';
});
