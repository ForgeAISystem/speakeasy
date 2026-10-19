'use strict';
const bridge = window.coachBridge;
const card = document.getElementById('card');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let view = null, tick = null;

function lessonHtml(v) {
  if (v.finished) {
    return `<div class="top"><span class="eyebrow">LEARN · ${esc(v.title)}</span><button class="x" data-do="stop" aria-label="Close">&times;</button></div>
      <div class="big">You did it.</div>
      <div class="hint">You just used every part of ${esc(v.title)} for real. Ready to prove it without help?</div>
      <div class="row"><button class="b primary" data-do="challenge">Take the challenge</button><span class="spacer"></span><button class="b link" data-do="stop">Done</button></div>`;
  }
  const ok = v.status === 'done';
  return `<div class="top"><span class="eyebrow">LEARN · ${esc(v.title)}</span><span class="count">${v.index + 1} / ${v.total}</span><button class="x" data-do="stop" aria-label="Close">&times;</button></div>
    <div class="lesson">${esc(v.step ? v.lesson : '')}</div>
    <div class="do">${esc(v.step.do)}</div>
    <div class="hint">${esc(v.step.hint || '')}</div>
    <div class="status ${ok ? 'ok' : ''}">${ok ? '<span class="tick">&#10003;</span>Nice. That’s it.' : '<span class="pulse"></span>Waiting for you to do it'}</div>
    <div class="row">${v.index > 0 ? '<button class="b link" data-do="back">Back</button>' : ''}${v.step.action ? `<button class="b" data-do="action" data-run="${esc(v.step.action.run)}">${esc(v.step.action.label)}</button>` : ''}<span class="spacer"></span><button class="b link" data-do="next">Skip</button></div>
    <div class="bar"><span style="width:${Math.round(((v.index + (ok ? 1 : 0)) / v.total) * 100)}%"></span></div>`;
}

function challengeHtml(v) {
  if (v.finished) {
    return `<div class="top"><span class="eyebrow">CHALLENGE · ${esc(v.challenge)}</span><button class="x" data-do="stop" aria-label="Close">&times;</button></div>
      <span class="badge">${esc(v.finished.level.toUpperCase())}</span>
      <div class="big">${clock(v.finished.seconds * 1000)}${v.finished.record ? ' · new best' : ''}</div>
      <div class="hint">${v.finished.level === 'Pro' ? 'That is muscle memory. You own this now.' : v.finished.level === 'Operator' ? 'Solid. Run it again to hit Pro.' : 'Every run gets faster. Go again while it is fresh.'}${v.finished.record ? '' : ` Your best: ${clock(v.finished.best * 1000)}.`}</div>
      <div class="row"><button class="b primary" data-do="again">Go again</button><span class="spacer"></span><button class="b link" data-do="stop">Done</button></div>`;
  }
  const left = v.tasks.filter((t) => !t.done).length;
  return `<div class="top"><span class="eyebrow">CHALLENGE · ${esc(v.challenge)}</span><span class="timer" id="timer">${clock(Date.now() - v.startedAt)}</span><button class="x" data-do="stop" aria-label="Close">&times;</button></div>
    <div class="hint">${esc(v.intro)} No hints. ${left} to go.</div>
    <ul class="tasks">${v.tasks.map((t) => `<li class="${t.done ? 'done' : ''}"><span class="box">${t.done ? '&#10003;' : ''}</span>${esc(t.goal)}</li>`).join('')}</ul>
    <div class="row"><span class="spacer"></span><button class="b link" data-do="stop">Quit</button></div>`;
}

function render() {
  clearInterval(tick);
  if (!view || !view.active) { card.innerHTML = ''; return; }
  card.classList.toggle('done', view.status === 'done' || !!view.finished);
  card.innerHTML = view.mode === 'challenge' ? challengeHtml(view) : lessonHtml(view);
  if (view.mode === 'challenge' && !view.finished) {
    tick = setInterval(() => { const t = document.getElementById('timer'); if (t) t.textContent = clock(Date.now() - view.startedAt); }, 500);
  }
}

bridge.onState((v) => { view = v; render(); });

card.addEventListener('click', (e) => {
  const b = e.target.closest('[data-do]');
  if (!b || !view) return;
  const act = b.dataset.do;
  if (act === 'stop') bridge.stop();
  else if (act === 'next') bridge.next();
  else if (act === 'back') bridge.back();
  else if (act === 'action') bridge.action(b.dataset.run);
  else if (act === 'challenge' || act === 'again') bridge.start(view.id, 'challenge');
});
