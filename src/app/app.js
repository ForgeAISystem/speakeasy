'use strict';

const api = window.speakeasy;
let S = null; // full state cache
let currentTab = 'home';
const writing = window.SpeakEasyWriting;
let historyQuery = '', historyFilter = 'all', historyRows = [], historyRequest = 0;
let toastTimer;
let runtimeOpen = false, repairing = false;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}

function modeButtons(detailed = false) {
  return Object.entries(writing.modes).map(([id, value]) => `<button class="${detailed ? 'writing-option' : ''}" data-writing="${id}" aria-pressed="${writing.mode(S.settings) === id}" title="${esc(value.description)}">${detailed ? `<strong>${value.label}</strong><span>${value.description}</span>` : value.label}</button>`).join('');
}

async function chooseWritingMode(id) {
  if (id === 'polished' && !writing.providerReady(S.settings)) {
    await switchTab('settings');
    const advanced = document.querySelector('.advanced-settings');
    advanced.open = true;
    document.getElementById('set-polish').focus();
    toast('Choose a cleanup provider, then select Polished.');
    return;
  }
  S = await api.updateSettings({ cleanupMode: id });
  renderers[currentTab]();
  toast(`${writing.modes[id].label} cleanup selected.`);
}
const setup = new window.SpeakEasySetup({
  api, state: () => S, update: (next) => { S = next; },
  finish: () => { renderAll(); document.querySelector('[data-tab=home]')?.focus(); }
});

// ---------------------------------------------------------------- utils

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDuration(seconds) {
  seconds = Math.round(seconds);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function holdKeyLabel() {
  const k = S.holdKeys[S.settings.holdKey];
  if (!k) return S.settings.holdKey;
  return S.platform === 'darwin' ? k.label : k.winLabel;
}

function num(n) { return (n || 0).toLocaleString(); }

function langName(code) {
  if (!code) return '';
  const c = String(code).replace(/[<|>]/g, '').trim().toLowerCase();
  return (S.languages && S.languages.names[c]) || (c ? c.toUpperCase() : '');
}

// True when the active model can only do English (Moonshine / Parakeet), so the
// multilingual featured languages won't actually work until a Whisper model is on.
function activeModelIsEnglishOnly() {
  const m = S.settings.model && S.models.catalog[S.settings.model];
  return !!m && m.languages === 'en';
}

function pasteShortcutLabel() {
  return S.platform === 'darwin' ? '⌘⌃V' : 'Shift+Alt+Z';
}

// ---------------------------------------------------------------- engine pill

function renderEnginePill() {
  const pill = document.getElementById('engine-pill');
  const label = document.getElementById('engine-label');
  const phase = S.runtime?.phase;
  const st = phase === 'recording' || phase === 'armed' ? 'recording' : phase === 'processing' ? 'processing' : phase === 'error' ? 'error'
    : S.permissions.mic !== 'granted' || !S.permissions.accessibility ? 'permission'
    : S.engine.state === 'ready' && !S.shortcut?.ready ? 'shortcut'
    : S.engine.state === 'ready' && (S.runtime?.captureReady === false || S.runtime?.overlayReady === false) ? 'reconnecting' : S.engine.state;
  pill.className = st;
  label.textContent = st === 'ready' ? 'Ready to dictate'
    : st === 'recording' ? (phase === 'armed' ? 'Listening' : 'Opening microphone')
    : st === 'processing' ? 'Transcribing'
    : st === 'permission' ? 'Check permissions'
    : st === 'reconnecting' ? 'Reconnecting'
    : st === 'shortcut' ? 'Check shortcut'
    : st === 'loading' ? 'Loading model'
    : st === 'error' ? (phase === 'error' ? 'Check dictation' : 'Engine error')
    : 'No model';
}

function renderRuntime() {
  const target = document.getElementById('runtime-body');
  if (!target) return;
  const status = [
    ['Microphone permission', S.permissions.mic === 'granted'],
    ['Accessibility permission', S.permissions.accessibility],
    ['Dictation shortcut', S.shortcut?.ready],
    ['Local voice', S.engine.state === 'ready'],
    ['Microphone connection', S.runtime?.captureReady],
    ['Recording indicator', S.runtime?.overlayReady]
  ];
  target.innerHTML = `<div class="runtime-status">${status.map(([name, ok]) => `<div><span>${name}</span><strong class="${ok ? 'ok' : 'attention'}">${ok ? 'Ready' : 'Check'}</strong></div>`).join('')}</div>
    <p id="runtime-key">${S.runtime?.lastKeyAt ? `Shortcut detected at ${new Date(S.runtime.lastKeyAt).toLocaleTimeString()}.` : 'Press and release your shortcut to check detection.'}</p>
    <p class="runtime-error" role="status">${esc(S.runtime?.message || S.shortcut?.error || '')}</p>
    <div class="runtime-actions"><button class="btn ghost btn-sm" id="runtime-test">Test indicator</button><button class="btn ghost btn-sm" id="runtime-repair" ${repairing ? 'disabled' : ''}>${repairing ? 'Reconnecting…' : 'Repair connection'}</button><button class="muted-link" id="runtime-setup">Check permissions</button></div>`;
  document.getElementById('runtime-test').onclick = async () => {
    try { const result = await api.testOverlay(); if (!result.ok) toast(result.error); }
    catch { toast('The indicator could not be checked. Try Repair connection.'); }
  };
  document.getElementById('runtime-repair').onclick = async () => {
    repairing = true; renderRuntime();
    try {
      const result = await api.repairDictation();
      if (result.state) S = result.state;
      toast(result.ok ? 'Connection rechecked. Hold your shortcut to try again.' : result.error);
    } catch { toast('Connection could not restart. Quit and reopen SpeakEasy.'); }
    finally { repairing = false; renderRuntime(); renderEnginePill(); }
  };
  document.getElementById('runtime-setup').onclick = () => showOnboard(true);
}

// ---------------------------------------------------------------- home

function renderHome() {
  const el = document.getElementById('tab-home');
  const st = S.stats;
  const local = writing.mode(S.settings) !== 'polished' || S.settings.polishProvider !== 'anthropic';
  const ready = S.engine.state === 'ready' && S.shortcut?.ready && S.permissions.mic === 'granted' && S.permissions.accessibility && S.runtime?.captureReady !== false && S.runtime?.overlayReady !== false;
  const key = S.settings.holdKey === 'Fn' ? 'fn' : holdKeyLabel();
  el.innerHTML = `
    <div class="home-heading"><h1>${S.settings.userName ? 'Hello, ' + esc(S.settings.userName) + '.' : 'A little less typing.'}</h1><span class="local-badge"><span class="local-dot"></span>${local ? 'Local dictation' : 'Cloud polish enabled'}</span></div>
    ${!ready ? `<div class="readiness-message">${S.engine.state === 'loading' ? 'Your voice is getting ready.' : S.engine.state === 'error' ? 'Your voice needs a restart.' : 'Let’s check your voice and permissions.'} <button class="muted-link" id="home-setup">Open setup</button></div>` : ''}
    <div class="daily-hero"><div><div class="eyebrow">${ready ? 'READY WHEN YOU ARE' : 'YOUR DICTATION SHORTCUT'}</div><h2>Your thoughts.<br><em>Already written.</em></h2><p>Click where you want to write. Hold ${esc(holdKeyLabel())}, speak, then release.</p></div><div class="daily-art" data-parallax><img class="glass-art depth-layer" src="./assets/voice-glass.png" alt="" aria-hidden="true"><kbd class="daily-key depth-layer ${key.length > 3 ? 'long' : ''}" style="--depth:10px">${esc(key)}</kbd></div></div>
    <div class="home-shortcuts"><span><kbd>Double-tap</kbd> Hands-free</span><span><kbd>Esc</kbd> Cancel</span><span><kbd>${esc(pasteShortcutLabel())}</kbd> Paste last</span></div>
    <details class="runtime-check" id="runtime-check" ${runtimeOpen ? 'open' : ''}><summary>Check dictation</summary><div id="runtime-body"></div></details>
    <div class="writing-bar"><span class="writing-label">How your words arrive</span><div class="mode-switch" role="group" aria-label="Cleanup mode">${modeButtons()}</div></div>
    <div class="home-summary"><div><strong>${num(st.today.words)}</strong><span>words today</span></div><div><strong>${fmtDuration(st.today.timeSavedSeconds)}</strong><span>estimated time saved</span></div><div><strong>${num(st.allTime.transcriptions)}</strong><span>dictations so far</span></div></div>
    <div class="home-section-head"><h2>Recent words</h2><button class="muted-link" id="home-history">View history</button></div>
    <div class="row-list" id="home-recent"><div class="home-empty">Your next thought goes here.<br>Try a sentence in Notes, Mail, or your favorite app.</div></div>
    <div class="home-footer"><span>${activeModelIsEnglishOnly() ? 'English voice' : 'Multilingual voice'} · ${local ? 'Audio stays on your computer.' : 'Text cleanup uses Anthropic.'}</span><button class="btn ghost btn-sm" id="home-hide">Keep running in ${S.platform === 'darwin' ? 'menu bar' : 'tray'}</button></div>
  `;
  api.historyList().then((rows) => {
    const target = document.getElementById('home-recent');
    if (target && rows.length) target.innerHTML = rows.slice(0, 1).map((r) => historyRowHtml(r, true)).join('');
  });
  document.getElementById('home-setup')?.addEventListener('click', () => showOnboard(true));
  document.getElementById('home-history').addEventListener('click', () => switchTab('history'));
  document.getElementById('home-hide').addEventListener('click', () => api.hideApp());
  document.getElementById('runtime-check').ontoggle = async (event) => {
    runtimeOpen = event.target.open;
    if (runtimeOpen) { try { S = await api.getState(); renderRuntime(); renderEnginePill(); } catch { toast('Unable to refresh connection status.'); } }
  };
  renderRuntime();
}

function historyRowHtml(r, compact = false) {
  if (r.failed) {
    return `
      <div class="h-row failed" data-id="${esc(r.id)}">
        <div class="txt"><span class="failed-label">${r.recovered ? 'Recovered recording' : 'Transcription failed'}</span>
          <div class="meta">Audio saved &middot; ${timeAgo(r.ts)} &middot; ${r.speechSeconds}s</div>
        </div>
        <div class="actions">
          <button class="btn ghost btn-sm" data-action="retry">Retry</button>
          <button class="icon-btn danger" data-action="delete" aria-label="Delete recording" title="Delete">&#x2715;</button>
        </div>
      </div>`;
  }
  const tags = [
    r.lang ? langName(r.lang) : '',
    r.organized ? 'Organized' : r.polished ? 'Polished' : '',
    r.pasted === false ? 'On clipboard' : ''
  ].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  return `
    <div class="h-row" data-id="${esc(r.id)}">
      <div class="txt"><div class="transcript-text">${esc(r.text)}</div>
        <div class="meta">${tags}${r.app ? esc(r.app) + ' &middot; ' : ''}${timeAgo(r.ts)} &middot; ${Number(r.speechSeconds) || 0}s</div>
        ${r.fallbackReason ? '<p class="fallback-note">AI cleanup was unavailable. Local cleanup kept your words.</p>' : ''}
        ${!compact && r.raw && r.raw !== r.text ? `<details class="history-original"><summary>Compare original</summary><div class="original-box"><p>${esc(r.raw)}</p><button class="btn ghost btn-sm" data-action="copy-original">Copy original</button></div></details>` : ''}
      </div>
      <div class="actions">
        <button class="icon-btn" data-action="copy" aria-label="Copy transcript" title="Copy transcript">&#x2398;</button>
        <button class="icon-btn danger" data-action="delete" aria-label="Delete transcript" title="Delete transcript">&#x2715;</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- history

async function renderHistory() {
  const el = document.getElementById('tab-history');
  const request = ++historyRequest;
  const rows = await api.historyList();
  if (request !== historyRequest || currentTab !== 'history') return;
  historyRows = rows;
  el.innerHTML = `
    <h1>History</h1>
    <p class="sub">Find a thought. Recover the original. All saved on this computer.</p>
    <div class="toolbar">
      <input type="text" id="hist-search" aria-label="Search transcripts, originals, and apps" placeholder="Search your words…" value="${esc(historyQuery)}">
      <button class="btn ghost" id="hist-clear">Clear all</button>
    </div>
    <div class="clear-confirm" id="hist-confirm" hidden><span>Delete all saved transcripts and recovery audio?</span><button class="btn btn-sm" id="hist-confirm-delete">Delete all</button><button class="btn ghost btn-sm" id="hist-cancel">Keep them</button></div>
    <div class="history-tools"><div class="history-filters" role="group" aria-label="Filter history">${[['all','All words'],['changed','Cleaned up'],['attention','Needs attention']].map(([id,label]) => `<button data-filter="${id}" aria-pressed="${historyFilter === id}">${label}</button>`).join('')}</div><span class="history-count" id="hist-count" role="status"></span></div>
    <div class="row-list" id="hist-list"></div>
  `;
  document.getElementById('hist-search').addEventListener('input', (e) => {
    historyQuery = e.target.value;
    renderHistoryResults();
  });
  el.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    historyFilter = button.dataset.filter;
    el.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === historyFilter));
    renderHistoryResults();
  }));
  document.getElementById('hist-clear').addEventListener('click', () => {
    document.getElementById('hist-confirm').hidden = false;
    document.getElementById('hist-cancel').focus();
  });
  document.getElementById('hist-cancel').addEventListener('click', () => {
    document.getElementById('hist-confirm').hidden = true;
    document.getElementById('hist-clear').focus();
  });
  document.getElementById('hist-confirm-delete').addEventListener('click', async () => {
    await api.historyClear();
    renderHistory();
    toast('History cleared.');
  });
  renderHistoryResults();
}

function renderHistoryResults() {
  const q = historyQuery.trim().toLocaleLowerCase();
  const rows = historyRows.filter((r) => [r.text, r.raw, r.app].some((v) => (v || '').toLocaleLowerCase().includes(q)) &&
    (historyFilter === 'all' || (historyFilter === 'changed' ? r.raw && r.raw !== r.text : r.failed || r.pasted === false || r.fallbackReason)));
  let day = '';
  document.getElementById('hist-list').innerHTML = rows.map((r) => {
    const date = new Date(r.ts).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    const heading = date !== day ? `<h2 class="history-day">${esc(date)}</h2>` : '';
    day = date;
    return heading + historyRowHtml(r);
  }).join('') || '<div class="home-empty">No matching words yet. Your next dictation will appear here.</div>';
  document.getElementById('hist-count').textContent = `${rows.length} ${rows.length === 1 ? 'dictation' : 'dictations'}`;
}

// ---------------------------------------------------------------- dictionary

async function renderDictionary() {
  const el = document.getElementById('tab-dictionary');
  const [entries, wispr] = await Promise.all([api.dictList(), api.wisprImportPreview().catch(() => ({}))]);
  const wisprCount = (wispr.words || 0) + (wispr.snippets || 0);
  el.innerHTML = `
    <h1>Dictionary</h1>
    <p class="sub">Teach SpeakEasy your names, clients, products, and jargon. Add a correction to auto-fix a word the model keeps mishearing.</p>
    ${wispr.available && wisprCount ? `<div class="readiness-message import-card">Wispr Flow is on this Mac. Bring over the ${wispr.words ? `${num(wispr.words)} ${wispr.words === 1 ? 'word' : 'words'}` : ''}${wispr.words && wispr.snippets ? ' and ' : ''}${wispr.snippets ? `${num(wispr.snippets)} ${wispr.snippets === 1 ? 'snippet' : 'snippets'}` : ''} you taught it. <button class="btn btn-sm" id="dict-import-wispr">Import</button></div>` : ''}
    <div class="form-row">
      <label class="field-label">Correct word<input type="text" id="dict-word" placeholder="e.g. SpeakEasy"></label>
      <label class="field-label">What it hears (optional)<input type="text" id="dict-miss" placeholder="e.g. speak easy"></label>
      <button class="btn" id="dict-add">Add</button><button class="btn ghost" id="dict-cancel" hidden>Cancel</button>
    </div>
    <div class="row-list">
      ${entries.length ? entries.map((d) => `
        <div class="h-row" data-id="${d.id}">
          <div class="txt"><strong>${esc(d.word)}</strong>${d.misspelling ? ` <span style="color:var(--text-faint)">&larr; replaces &ldquo;${esc(d.misspelling)}&rdquo;</span>` : ''}</div>
          <div class="actions"><button class="btn ghost btn-sm" data-edit-dict="${esc(d.id)}">Edit</button><button class="icon-btn danger" data-action="dict-delete" aria-label="Delete dictionary word">&#x2715;</button></div>
        </div>`).join('') : '<div class="empty">No entries yet.</div>'}
    </div>
  `;
  let editing = null;
  el.querySelectorAll('[data-edit-dict]').forEach((button) => button.addEventListener('click', () => {
    const entry = entries.find((d) => d.id === button.dataset.editDict);
    if (!entry) return;
    editing = entry.id;
    document.getElementById('dict-word').value = entry.word;
    document.getElementById('dict-miss').value = entry.misspelling || '';
    document.getElementById('dict-add').textContent = 'Save';
    document.getElementById('dict-cancel').hidden = false;
    document.getElementById('dict-word').focus();
  }));
  document.getElementById('dict-cancel').addEventListener('click', renderDictionary);
  document.getElementById('dict-import-wispr')?.addEventListener('click', async (event) => {
    event.target.disabled = true;
    const res = await api.wisprImport();
    toast(res.ok ? `Imported ${num(res.words)} ${res.words === 1 ? 'word' : 'words'} and ${num(res.snippets)} ${res.snippets === 1 ? 'snippet' : 'snippets'}.` : res.error);
    renderDictionary();
  });
  document.getElementById('dict-add').addEventListener('click', async () => {
    const word = document.getElementById('dict-word').value.trim();
    const miss = document.getElementById('dict-miss').value.trim();
    if (!word) return;
    if (entries.some((d) => d.id !== editing && d.word.toLocaleLowerCase() === word.toLocaleLowerCase())) { toast('That word is already in your dictionary.'); return; }
    const value = { id: editing || String(Date.now()), word, misspelling: miss || undefined };
    if (editing) entries.splice(entries.findIndex((d) => d.id === editing), 1, value);
    else entries.unshift(value);
    await api.dictSave(entries);
    renderDictionary();
  });
}

// ---------------------------------------------------------------- snippets

async function renderSnippets() {
  const el = document.getElementById('tab-snippets');
  const entries = await api.snippetsList();
  el.innerHTML = `
    <h1>Snippets</h1>
    <p class="sub">Say a trigger phrase, get the full text. Signatures, addresses, links, canned replies.</p>
    <div class="form-row">
      <label class="field-label">When I say<input type="text" id="snip-trigger" placeholder="e.g. my calendar link"></label>
      <label class="field-label">Write this<textarea id="snip-expansion" placeholder="A link, signature, or a few paragraphs…"></textarea></label>
      <button class="btn" id="snip-add">Add</button><button class="btn ghost" id="snip-cancel" hidden>Cancel</button>
    </div>
    <div class="row-list">
      ${entries.length ? entries.map((s) => `
        <div class="h-row" data-id="${s.id}">
          <div class="txt"><strong>${esc(s.trigger)}</strong><div class="meta transcript-text">${esc(s.expansion)}</div></div>
          <div class="actions"><button class="btn ghost btn-sm" data-edit-snip="${esc(s.id)}">Edit</button><button class="icon-btn danger" data-action="snip-delete" aria-label="Delete snippet">&#x2715;</button></div>
        </div>`).join('') : '<div class="empty">No snippets yet.</div>'}
    </div>
  `;
  let editing = null;
  el.querySelectorAll('[data-edit-snip]').forEach((button) => button.addEventListener('click', () => {
    const entry = entries.find((s) => s.id === button.dataset.editSnip);
    if (!entry) return;
    editing = entry.id;
    document.getElementById('snip-trigger').value = entry.trigger;
    document.getElementById('snip-expansion').value = entry.expansion;
    document.getElementById('snip-add').textContent = 'Save';
    document.getElementById('snip-cancel').hidden = false;
    document.getElementById('snip-expansion').focus();
  }));
  document.getElementById('snip-cancel').addEventListener('click', renderSnippets);
  document.getElementById('snip-add').addEventListener('click', async () => {
    const trigger = document.getElementById('snip-trigger').value.trim();
    const expansion = document.getElementById('snip-expansion').value.trim();
    if (!trigger || !expansion) return;
    if (entries.some((s) => s.id !== editing && s.trigger.toLocaleLowerCase() === trigger.toLocaleLowerCase())) { toast('That trigger already exists. Edit its snippet instead.'); return; }
    const value = { id: editing || String(Date.now()), trigger, expansion };
    if (editing) entries.splice(entries.findIndex((s) => s.id === editing), 1, value);
    else entries.unshift(value);
    await api.snippetsSave(entries);
    renderSnippets();
  });
}

// ---------------------------------------------------------------- settings

function modelCardHtml(m) {
  const installed = S.models.installed.includes(m.id);
  const active = S.settings.model === m.id;
  const dl = S.models.downloads[m.id];
  const downloading = dl !== undefined;
  return `
    <div class="model-card ${active ? 'active-model' : ''}" data-model="${m.id}">
      <div class="m-info">
        <div class="m-name">${esc(m.label)}${active ? '<span class="badge">Active</span>' : ''}</div>
        <div class="m-desc">${esc(m.tagline)}</div>
        ${downloading ? `<div class="progress"><div class="fill" style="width:${dl === -1 ? 100 : Math.round(dl * 100)}%"></div></div>` : ''}
        ${S.models.lastError && S.models.lastError.id === m.id ? `<div class="m-desc" style="color:var(--red, #b3261e);margin-top:6px">Download failed: ${esc(S.models.lastError.message)}. Check your connection and retry.</div>` : ''}
      </div>
      ${downloading
        ? `<span class="mono" style="color:var(--text-dim);font-size:12px">${dl === -1 ? 'Extracting' : Math.round(dl * 100) + '%'}</span>`
        : installed
          ? (active ? '' : `<button class="btn ghost" data-action="model-activate">Use</button><button class="icon-btn danger" data-action="model-remove" title="Delete model">&#x2715;</button>`)
          : `<button class="btn ghost" data-action="model-download">Download</button>`}
    </div>`;
}

async function renderSettings() {
  const el = document.getElementById('tab-settings');
  const cfg = S.settings;
  const mics = await api.listMics();
  const isMac = S.platform === 'darwin';

  const keyOptions = Object.entries(S.holdKeys)
    .filter(([, v]) => !v.macOnly || isMac)
    .map(([k, v]) => `<option value="${k}" ${cfg.holdKey === k ? 'selected' : ''}>${isMac ? v.label : v.winLabel}</option>`).join('');

  const langs = [['auto', 'Auto-detect'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['hi', 'Hindi'], ['gu', 'Gujarati'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['it', 'Italian'], ['ru', 'Russian'], ['ar', 'Arabic']];
  const langOptions = langs.map(([v, l]) => `<option value="${v}" ${cfg.language === v ? 'selected' : ''}>${l}</option>`).join('');

  const micOptions = ['<option value="default">System default</option>']
    .concat(mics.filter((m) => m.deviceId !== 'default').map((m) =>
      `<option value="${esc(m.deviceId)}" ${cfg.micDeviceId === m.deviceId ? 'selected' : ''}>${esc(m.label)}</option>`))
    .join('');

  el.innerHTML = `
    <h1>Settings</h1>
    <p class="sub">Your voice, your shortcut, your preferences.</p>

    <div class="section-title">How your words arrive</div>
    <div class="writing-options" role="group" aria-label="Cleanup mode">${modeButtons(true)}</div>
    <p class="writing-note ${writing.mode(cfg) === 'polished' && !writing.providerReady(cfg) ? 'warning' : ''}">${writing.mode(cfg) === 'polished' && !writing.providerReady(cfg) ? 'Choose a provider under optional AI cleanup. Until then, Clean runs locally.' : 'Original transcripts stay available in History whenever cleanup changes your words.'}</p>

    <div class="section-title">Dictation</div>
    <div class="set-group">
      <div class="set-row">
        <div class="info"><div class="name">Dictation key</div><div class="desc">Hold to talk. Double-tap for hands-free. Tap again to stop. Esc cancels.</div></div>
        <select id="set-holdkey">${keyOptions}</select>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Microphone</div><div class="desc">System default follows whatever macOS/Windows has selected.</div></div>
        <select id="set-mic">${micOptions}</select>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Language</div><div class="desc">${activeModelIsEnglishOnly() ? 'Your current voice supports English. Choose a multilingual voice below for other languages.' : 'Write in the language you speak. Choose one, or let SpeakEasy detect it.'}</div></div>
        <select id="set-lang" ${activeModelIsEnglishOnly() ? 'disabled' : ''}>${activeModelIsEnglishOnly() ? '<option>English</option>' : langOptions}</select>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Match each app</div><div class="desc">Chat apps get a single sentence without a final period. Polished mode writes emails, chats, and AI prompts in the style each one needs.</div></div>
        <label class="switch"><input type="checkbox" id="set-appstyle" ${cfg.matchAppStyle !== false ? 'checked' : ''}><span class="track"></span></label>
      </div>
      ${isMac ? `<div class="set-row">
        <div class="info"><div class="name">Mute audio while dictating</div><div class="desc">Silences music and videos while you speak, then turns them back on.</div></div>
        <label class="switch"><input type="checkbox" id="set-mute" ${cfg.muteWhileDictating ? 'checked' : ''}><span class="track"></span></label>
      </div>` : ''}
    </div>

    <details class="advanced-settings"><summary>Voice models &amp; optional AI cleanup</summary><div class="section-title">Voice models</div>
    ${Object.values(S.models.catalog).map(modelCardHtml).join('')}

    <div class="section-title">Cleanup</div>
    <div class="set-group">
      <div class="set-row">
        <div class="info"><div class="name">Cleanup provider</div><div class="desc">Used only in Polished mode. Ollama runs locally and needs its own installed model. Claude API sends text (never audio) to Anthropic with the app name and your dictionary words, and may incur usage charges.</div></div>
        <select id="set-polish">
          <option value="off" ${cfg.polishProvider === 'off' ? 'selected' : ''}>None (use Clean)</option>
          <option value="ollama" ${cfg.polishProvider === 'ollama' ? 'selected' : ''}>Ollama (local LLM)</option>
          <option value="anthropic" ${cfg.polishProvider === 'anthropic' ? 'selected' : ''}>Claude API</option>
        </select>
      </div>
      <div class="set-row" id="row-ollama" style="display:${cfg.polishProvider === 'ollama' ? 'flex' : 'none'}">
        <div class="info"><div class="name">Ollama model</div><div class="desc">Must be pulled already: ollama pull llama3.2</div></div>
        <input type="text" id="set-ollama-model" value="${esc(cfg.polishOllamaModel)}">
      </div>
      <div class="set-row" id="row-anthropic" style="display:${cfg.polishProvider === 'anthropic' ? 'flex' : 'none'}">
        <div class="info"><div class="name">Anthropic API key</div><div class="desc">Stored locally in settings.json.</div></div>
        <input type="password" id="set-anthropic-key" value="${esc(cfg.polishAnthropicKey)}" placeholder="sk-ant-...">
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Organize my thoughts</div><div class="desc">Say &ldquo;organize my thoughts&rdquo; (or &ldquo;clean this up&rdquo;) at the start or end of a dictation and SpeakEasy restructures your rambling into clean, organized text. Needs an AI cleanup provider above.</div></div>
        <label class="switch"><input type="checkbox" id="set-organize" ${cfg.organizeOnCommand !== false ? 'checked' : ''}><span class="track"></span></label>
      </div>
    </div>

    </details><div class="section-title">System</div>
    <div class="set-group">
      <div class="set-row">
        <div class="info"><div class="name">Subtle motion</div><div class="desc">Gentle depth and transitions. Your system’s reduced-motion preference always takes priority.</div></div>
        <label class="switch"><input type="checkbox" id="set-motion" ${cfg.subtleMotion !== false ? 'checked' : ''}><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Sounds</div><div class="desc">Start, stop, and done blips.</div></div>
        <label class="switch"><input type="checkbox" id="set-sounds" ${cfg.sounds ? 'checked' : ''}><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Restore clipboard</div><div class="desc">SpeakEasy pastes through the clipboard, then puts your old clipboard back.</div></div>
        <label class="switch"><input type="checkbox" id="set-clip" ${cfg.restoreClipboard ? 'checked' : ''}><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">Launch at login</div><div class="desc">Start SpeakEasy in the ${isMac ? 'menu bar' : 'system tray'} when you sign in.</div></div>
        <label class="switch"><input type="checkbox" id="set-login" ${cfg.launchAtLogin ? 'checked' : ''}><span class="track"></span></label>
      </div>
    </div>

    <div class="section-title">About</div>
    <div class="set-group">
      <div class="set-row">
        <div class="info"><div class="name">SpeakEasy ${esc(S.version)}</div><div class="desc">Local voice dictation. MIT licensed. Built with sherpa-onnx (Whisper, Moonshine, Parakeet).</div></div>
        <button class="btn ghost" id="btn-rerun-onboard">Setup guide</button>
      </div>
    </div>
  `;

  el.querySelectorAll('.set-row').forEach((row) => {
    const label = row.querySelector('.name')?.textContent;
    row.querySelectorAll('input, select').forEach((input) => input.setAttribute('aria-label', label || 'Setting'));
  });

  const save = (partial) => api.updateSettings(partial).then((s) => { S = s; window.SpeakEasyMotion.setEnabled(S.settings.subtleMotion); renderEnginePill(); });
  document.getElementById('set-holdkey').addEventListener('change', (e) => save({ holdKey: e.target.value }).then(renderHomeIfActive));
  document.getElementById('set-mic').addEventListener('change', (e) => save({ micDeviceId: e.target.value }));
  document.getElementById('set-lang').addEventListener('change', (e) => save({ language: e.target.value }));
  document.getElementById('set-appstyle').addEventListener('change', (e) => save({ matchAppStyle: e.target.checked }));
  document.getElementById('set-mute')?.addEventListener('change', (e) => save({ muteWhileDictating: e.target.checked }));
  document.getElementById('set-motion').addEventListener('change', (e) => save({ subtleMotion: e.target.checked }));
  document.getElementById('set-sounds').addEventListener('change', (e) => save({ sounds: e.target.checked }));
  document.getElementById('set-clip').addEventListener('change', (e) => save({ restoreClipboard: e.target.checked }));
  document.getElementById('set-login').addEventListener('change', (e) => save({ launchAtLogin: e.target.checked }));
  document.getElementById('set-polish').addEventListener('change', (e) => {
    save({ polishProvider: e.target.value });
    document.getElementById('row-ollama').style.display = e.target.value === 'ollama' ? 'flex' : 'none';
    document.getElementById('row-anthropic').style.display = e.target.value === 'anthropic' ? 'flex' : 'none';
  });
  document.getElementById('set-organize').addEventListener('change', (e) => save({ organizeOnCommand: e.target.checked }));
  document.getElementById('set-ollama-model').addEventListener('change', (e) => save({ polishOllamaModel: e.target.value.trim() }));
  document.getElementById('set-anthropic-key').addEventListener('change', (e) => save({ polishAnthropicKey: e.target.value.trim() }));
  document.getElementById('btn-rerun-onboard').addEventListener('click', () => { showOnboard(true); });
}

function renderHomeIfActive() {
  if (currentTab === 'home') renderHome();
}

// ---------------------------------------------------------------- onboarding

function showOnboard(visible) {
  if (visible) setup.open();
  else setup.close();
}

// ---------------------------------------------------------------- tabs + delegation

const renderers = {
  home: renderHome,
  history: renderHistory,
  dictionary: renderDictionary,
  snippets: renderSnippets,
  settings: renderSettings
};

function renderAll() {
  renderEnginePill();
  renderers[currentTab]();
}

async function switchTab(tab) {
  if (!renderers[tab]) return;
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach((n) => { const active = n.getAttribute('data-tab') === tab; n.classList.toggle('active', active); n.setAttribute('aria-current', active ? 'page' : 'false'); });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${tab}`));
  await renderers[tab]();
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
});

// Cmd/Ctrl+1-5 jumps straight to a tab
const TAB_ORDER = ['home', 'history', 'dictionary', 'snippets', 'settings'];
document.addEventListener('keydown', (e) => {
  if (setup.visible) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    switchTab('history').then(() => document.getElementById('hist-search')?.focus());
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    switchTab(TAB_ORDER[Number(e.key) - 1]);
  }
});

document.getElementById('content').addEventListener('click', async (e) => {
  const mode = e.target.closest('[data-writing]');
  if (mode) { await chooseWritingMode(mode.dataset.writing); return; }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const row = btn.closest('[data-id]');
  const modelCard = btn.closest('[data-model]');

  if (['copy', 'copy-original'].includes(action) && row) {
    const rows = await api.historyList();
    const r = rows.find((x) => x.id === row.getAttribute('data-id'));
    if (r) { await api.copy(action === 'copy-original' ? r.raw || r.text : r.text); toast(action === 'copy-original' ? 'Original transcript copied.' : 'Copied to clipboard.'); }
  } else if (action === 'retry' && row) {
    btn.disabled = true;
    btn.textContent = 'Retrying';
    const res = await api.historyRetry(row.getAttribute('data-id'));
    if (res.ok) {
      renderers[currentTab]();
    } else {
      btn.disabled = false;
      btn.textContent = 'Retry';
      const meta = row.querySelector('.meta');
      if (meta) meta.textContent = res.error;
    }
  } else if (action === 'delete' && row) {
    await api.historyRemove(row.getAttribute('data-id'));
    renderers[currentTab]();
  } else if (action === 'dict-delete' && row) {
    const entries = (await api.dictList()).filter((d) => d.id !== row.getAttribute('data-id'));
    await api.dictSave(entries);
    renderDictionary();
  } else if (action === 'snip-delete' && row) {
    const entries = (await api.snippetsList()).filter((s) => s.id !== row.getAttribute('data-id'));
    await api.snippetsSave(entries);
    renderSnippets();
  } else if (action === 'model-download' && modelCard) {
    const id = modelCard.getAttribute('data-model');
    api.downloadModel(id).then(async (res) => {
      if (res.ok && !S.settings.model) S = await api.updateSettings({ model: id });
      S = await api.getState();
      if (currentTab === 'settings') renderSettings();
    });
    S.models.downloads[id] = 0;
    renderSettings();
  } else if (action === 'model-activate' && modelCard) {
    S = await api.updateSettings({ model: modelCard.getAttribute('data-model') });
    renderSettings();
    renderEnginePill();
  } else if (action === 'model-remove' && modelCard) {
    await api.removeModel(modelCard.getAttribute('data-model'));
    S = await api.getState();
    renderSettings();
  }
});

// ---------------------------------------------------------------- push events

api.onPush(async (msg) => {
  if (!S) return;
  if (msg.type === 'download-progress') {
    if (msg.error || msg.done) {
      const err = msg.error ? { id: msg.id, message: msg.error } : null;
      S = await api.getState();
      S.models.lastError = err;
    } else {
      S.models.downloads[msg.id] = msg.progress;
    }
    if (setup.visible) setup.push(msg);
    else if (currentTab === 'settings') {
      // Update just the progress bar to avoid re-rendering inputs mid-typing
      const card = document.querySelector(`.model-card[data-model="${msg.id}"]`);
      if (card) {
        const fill = card.querySelector('.fill');
        const pct = msg.progress === -1 ? 100 : Math.round((msg.progress || 0) * 100);
        if (fill) fill.style.width = pct + '%';
        const label = card.querySelector('.mono');
        if (label) label.textContent = msg.progress === -1 ? 'Extracting' : pct + '%';
        if (msg.done || msg.error) renderSettings();
      }
    }
  } else if (msg.type === 'engine') {
    S.engine.state = msg.state;
    renderEnginePill();
    if (currentTab === 'home' && !setup.visible) renderHome();
  } else if (msg.type === 'shortcut') {
    S.shortcut = msg;
    renderEnginePill();
    if (setup.visible && setup.step === 3) setup.render();
    else if (!setup.visible && currentTab === 'home') renderHome();
  } else if (msg.type === 'shortcut-key') {
    S.runtime = { ...S.runtime, lastKeyAt: msg.at || Date.now() };
    const keyStatus = document.getElementById('runtime-key');
    if (keyStatus) keyStatus.textContent = `Shortcut detected at ${new Date(S.runtime.lastKeyAt).toLocaleTimeString()}.`;
    setup.push(msg);
  } else if (msg.type === 'runtime') {
    S.runtime = { ...S.runtime, ...msg };
    renderEnginePill(); renderRuntime();
  } else if (msg.type === 'stats') {
    S = await api.getState();
    if (currentTab === 'home') renderHome();
    else if (currentTab === 'history') renderHistory();
  } else if (msg.type === 'dictation') {
    S.runtime = { ...S.runtime, phase: msg.phase, message: msg.message || '' };
    renderEnginePill(); renderRuntime();
    if (msg.phase === 'error' && !setup.visible) toast(msg.message || 'Dictation interrupted. Check dictation on Home.');
    setup.push(msg);
  }
});

// ---------------------------------------------------------------- boot

(async function boot() {
  S = await api.getState();
  window.SpeakEasyMotion.setEnabled(S.settings.subtleMotion);
  renderAll();
  if (!S.settings.onboarded || !S.settings.model) showOnboard(true);
})();
