'use strict';
const bridge = window.padBridge;
const UI = window.SpeakEasyPadUI;
const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const padEl = document.getElementById('pad');
const askEl = document.getElementById('ask');
const sayEl = document.getElementById('say');
let pads = {};
let view = { locks: {}, examples: [] };
let sayTimer = null, sayPage = 0;

const planEl = document.getElementById('plan');
const READY = 'Tap a key, or hold <kbd>fn</kbd> and say it';
const PEEK = 'Hold <kbd>fn</kbd> and say the words on a key';

// "You can say": two of the owner's own lines at a time, changing every 5 seconds.
function showSay() {
  const lines = view.examples || [];
  clearInterval(sayTimer);
  sayEl.hidden = !lines.length;
  if (!lines.length) return;
  const paint = () => {
    const start = (sayPage * 2) % lines.length;
    const pick = [lines[start], lines[(start + 1) % lines.length]].filter((x, i, all) => all.indexOf(x) === i);
    document.getElementById('say-lines').innerHTML = pick.map((l) => `<span class="say-line">“${UI.esc(l)}”</span>`).join('');
  };
  sayPage = 0;
  paint();
  if (lines.length > 2) sayTimer = setInterval(() => { sayPage += 1; paint(); }, 5000);
}

function render() {
  gridEl.innerHTML = UI.grid(pads, { locks: view.locks });
  askEl.hidden = !view.ask || !planEl.hidden;
  showSay();
}

bridge.onShow((payload) => {
  pads = payload.pads;
  const wasAsking = view.ask;
  view = { locks: payload.locks || {}, examples: payload.examples || [], ask: !!payload.ask };
  if (payload.keepPlan) {
    render();
    if (wasAsking && !view.ask) { statusEl.textContent = 'Your starter keys are ready. Tap one.'; statusEl.className = 'ok'; }
    return;
  }
  planEl.hidden = true;
  padEl.classList.remove('listening', 'peek');
  document.getElementById('target').textContent = payload.target ? `Moving: ${payload.target}` : 'No window picked';
  render();
  statusEl.innerHTML = view.ask ? 'Press <kbd>1</kbd> to <kbd>4</kbd>, or click one' : READY;
  statusEl.className = '';
  padEl.classList.remove('in');
  void gridEl.offsetWidth;
  padEl.classList.add('in');
});

// Hold-to-peek: every key shows its name and the words that run it.
bridge.onPeek(({ on }) => {
  padEl.classList.toggle('peek', !!on);
  if (on) { askEl.hidden = true; statusEl.innerHTML = PEEK; statusEl.className = ''; } else { askEl.hidden = !view.ask; statusEl.innerHTML = READY; }
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

askEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-goal]');
  if (button) bridge.starter(button.dataset.goal);
});
document.getElementById('peek-btn').addEventListener('click', () => bridge.peek());

bridge.onListening(() => {
  padEl.classList.add('listening');
  padEl.classList.remove('peek');
  statusEl.textContent = 'Listening. Say what to do, then let go of fn.';
  statusEl.className = '';
});

const EYEBROW = { claude: 'YOU SAID · PLANNED BY CLAUDE', suggest: 'YOU SAID · DID YOU MEAN?', monitor: 'MONITOR BACK' };

bridge.onPlan((plan) => {
  padEl.classList.remove('listening', 'peek');
  planEl.hidden = false;
  askEl.hidden = true;
  planEl.classList.toggle('guess', plan.via === 'suggest');
  document.getElementById('plan-eyebrow').textContent = EYEBROW[plan.via] || 'YOU SAID';
  document.getElementById('plan-heard').textContent = plan.title || (plan.heard ? `“${plan.heard}”` : 'Nothing heard');
  document.getElementById('plan-steps').innerHTML = plan.steps.map((st, i) => `<li data-i="${i}" class="${st.confirm ? 'confirm' : ''}"><span class="mark"></span><span class="txt">${UI.esc(st.text)}</span><span class="msg"></span></li>`).join('');
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
