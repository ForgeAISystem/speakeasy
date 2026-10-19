'use strict';
// Learn tab and the What's new screen. Walkthroughs run in the coach panel so
// the user practices in real apps; this tab starts them and shows progress.
(function () {
  const e = window.SpeakEasyPadUI ? window.SpeakEasyPadUI.esc : (s) => String(s ?? '');
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let summary = null;

  async function load() { summary = await api.guideSummary(); return summary; }

  function isNew(g) { return g.doneSteps === 0 && window.SpeakEasyGuides.newer(g.version, '2.5.0'); }

  function cardHtml(g) {
    const pct = g.totalSteps ? Math.round((g.doneSteps / g.totalSteps) * 100) : 0;
    const start = g.doneSteps === 0 ? 'Walk me through it' : g.doneSteps < g.totalSteps ? 'Keep going' : 'Walk through again';
    const best = g.challenge.best;
    return `<article class="learn-card" data-guide="${e(g.id)}">
      <div class="learn-main">
        <div class="learn-meta"><span class="learn-chip ${isNew(g) ? 'new' : ''}">${isNew(g) ? 'NEW IN ' + e(g.version) : 'SINCE ' + e(g.version)}</span><span class="learn-steps">${g.doneSteps} of ${g.totalSteps} steps</span></div>
        <h2>${e(g.title)}</h2>
        <p class="learn-tagline">${e(g.tagline)}</p>
        <ul class="learn-new">${g.whatsNew.map((w) => `<li>${e(w)}</li>`).join('')}</ul>
        <div class="learn-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="learn-actions">
        <button class="btn" data-learn="lesson">${start}</button>
        <button class="btn ghost" data-learn="challenge">Take the challenge</button>
        <div class="learn-best">${best ? `<span class="learn-level">${e(best.level.toUpperCase())}</span> best ${clock(best.seconds)}` : `${e(g.challenge.title)} · ${g.challenge.tasks} jobs`}</div>
      </div>
    </article>`;
  }

  async function renderLearn() {
    const el = document.getElementById('tab-learn');
    const s = await load();
    const active = s.active && s.active.active ? s.active : null;
    el.innerHTML = `
      <h1>Learn SpeakEasy</h1>
      <p class="sub">Short walkthroughs in your real apps. Each step checks itself the moment you do it. Then a challenge to prove it stuck.</p>
      ${active ? `<div class="readiness-message learn-live">In progress: ${e(active.title)}${active.mode === 'lesson' && !active.finished ? `, step ${active.index + 1} of ${active.total}` : active.mode === 'challenge' ? ', challenge' : ''}. The coach is in the top right corner. <button class="btn ghost btn-sm" id="learn-stop">Stop</button></div>` : ''}
      <div class="learn-list">${s.guides.map(cardHtml).join('')}</div>`;
    document.getElementById('learn-stop')?.addEventListener('click', async () => { await api.guideStop(); renderLearn(); });
    el.querySelectorAll('[data-learn]').forEach((b) => b.addEventListener('click', () => {
      api.guideStart(b.closest('[data-guide]').dataset.guide, b.dataset.learn);
    }));
    markNav();
  }

  function markNav() {
    const nav = document.querySelector('.nav-item[data-tab="learn"]');
    if (nav && summary) nav.classList.toggle('has-new', summary.guides.some(isNew));
  }

  // What's new: once per update, oldest new feature first.
  async function whatsNew(given) {
    const s = given || await load();
    markNav();
    if (!s.fresh.length) return;
    const fresh = s.fresh.map((id) => s.guides.find((g) => g.id === id)).filter(Boolean)
      .sort((a, b) => (window.SpeakEasyGuides.newer(a.version, b.version) ? 1 : -1));
    const box = document.createElement('div');
    box.id = 'whats-new';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'whats-new-title');
    box.innerHTML = `<div class="wn-sheet">
      <div class="eyebrow">WHAT’S NEW IN ${e(s.version)}</div>
      <h2 id="whats-new-title">${fresh.length === 1 ? e(fresh[0].title) : `${fresh.length} new things to try`}</h2>
      ${fresh.map((g) => `<section><h3>${e(g.title)}</h3><ul>${g.whatsNew.map((w) => `<li>${e(w)}</li>`).join('')}</ul></section>`).join('')}
      <p class="wn-note">The walkthrough takes about ${Math.max(3, fresh.reduce((n, g) => n + g.totalSteps, 0))} minutes. You practice in your own apps and each step checks itself.</p>
      <div class="wn-actions"><button class="btn" id="wn-go">Walk me through it</button><button class="btn ghost" id="wn-later">Later</button></div>
    </div>`;
    document.body.appendChild(box);
    const close = async () => { box.remove(); await api.guideSeen(); };
    document.getElementById('wn-go').addEventListener('click', async () => { await close(); api.guideStart(fresh[0].id, 'lesson'); });
    document.getElementById('wn-later').addEventListener('click', async () => { await close(); switchTab('learn'); });
    document.getElementById('wn-go').focus();
  }

  renderers.learn = renderLearn;
  TAB_ORDER.splice(5, 0, 'learn');

  api.onPush((msg) => {
    if (msg.type === 'open-tab') switchTab(msg.tab);
    else if (msg.type === 'guide' && currentTab === 'learn') renderLearn();
  });

  window.SpeakEasyLearn = { whatsNew };
})();
