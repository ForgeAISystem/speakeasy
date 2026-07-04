'use strict';

const api = window.speakeasy;
let S = null; // full state cache
let currentTab = 'home';
let obStep = 0; // onboarding step index

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

// ---------------------------------------------------------------- engine pill

function renderEnginePill() {
  const pill = document.getElementById('engine-pill');
  const label = document.getElementById('engine-label');
  const st = S.engine.state;
  pill.className = st;
  label.textContent = st === 'ready' ? 'Engine ready'
    : st === 'loading' ? 'Loading model'
    : st === 'error' ? 'Engine error'
    : 'No model';
}

// ---------------------------------------------------------------- home

function renderHome() {
  const el = document.getElementById('tab-home');
  const st = S.stats;
  const hour = new Date().getHours();
  const period = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greeting = S.settings.userName ? `${period}, ${esc(S.settings.userName)}` : period;

  el.innerHTML = `
    <h1>${greeting}.</h1>
    <p class="sub">Local dictation. No cloud. No subscription. Your words never leave this machine.</p>
    <div class="hero-card">
      <div class="headline">Hold <em>${esc(holdKeyLabel())}</em> to dictate</div>
      <div class="subcopy">Speak naturally, release, and clean text lands wherever your cursor is. Double-tap for hands-free. <kbd>Esc</kbd> cancels.</div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">Today</div>
        <div class="value">${num(st.today.words)} <small>words</small></div>
        <div class="detail">${fmtDuration(st.today.timeSavedSeconds)} saved &middot; ${num(st.today.transcriptions)} dictations</div>
      </div>
      <div class="stat-card">
        <div class="label">This week</div>
        <div class="value">${num(st.week.words)} <small>words</small></div>
        <div class="detail">${fmtDuration(st.week.timeSavedSeconds)} saved &middot; ${num(st.week.transcriptions)} dictations</div>
      </div>
      <div class="stat-card">
        <div class="label">All time</div>
        <div class="value">${num(st.allTime.words)} <small>words</small></div>
        <div class="detail">${fmtDuration(st.allTime.timeSavedSeconds)} saved &middot; ${num(st.allTime.transcriptions)} dictations</div>
      </div>
      <div class="stat-card stat-wide">
        <div class="stat-inline">
          <div>
            <div class="label">Speaking pace</div>
            <div class="value">${st.wpm ? num(st.wpm) : '&ndash;'} <small>wpm</small></div>
          </div>
          <div>
            <div class="label">vs typing (40 wpm)</div>
            <div class="value">${st.wpm ? Math.max(1, Math.round(st.wpm / 40)) : '&ndash;'}<small>x faster</small></div>
          </div>
          <div>
            <div class="label">Daily streak</div>
            <div class="value">${num(st.streak)} <small>day${st.streak === 1 ? '' : 's'}</small></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">Recent dictations</div>
    <div class="row-list" id="home-recent"><div class="empty">Nothing yet. Hold ${esc(holdKeyLabel())} and start talking.</div></div>
  `;

  api.historyList().then((rows) => {
    const target = document.getElementById('home-recent');
    if (!target || !rows.length) return;
    target.innerHTML = rows.slice(0, 5).map(historyRowHtml).join('');
  });
}

function historyRowHtml(r) {
  if (r.failed) {
    return `
      <div class="h-row failed" data-id="${r.id}">
        <div class="txt"><span class="failed-label">${r.recovered ? 'Recovered recording' : 'Transcription failed'}</span>
          <div class="meta">Audio saved &middot; ${timeAgo(r.ts)} &middot; ${r.speechSeconds}s</div>
        </div>
        <div class="actions">
          <button class="btn ghost btn-sm" data-action="retry">Retry</button>
          <button class="icon-btn danger" data-action="delete" title="Delete">&#x2715;</button>
        </div>
      </div>`;
  }
  return `
    <div class="h-row" data-id="${r.id}">
      <div class="txt">${esc(r.text)}
        <div class="meta">${r.app ? esc(r.app) + ' &middot; ' : ''}${timeAgo(r.ts)} &middot; ${r.speechSeconds}s &middot; ${r.engineMs}ms engine</div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-action="copy" title="Copy">&#x2398;</button>
        <button class="icon-btn danger" data-action="delete" title="Delete">&#x2715;</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- history

async function renderHistory() {
  const el = document.getElementById('tab-history');
  const rows = await api.historyList();
  el.innerHTML = `
    <h1>History</h1>
    <p class="sub">Everything you dictated, stored locally on this machine only.</p>
    <div class="toolbar">
      <input type="text" id="hist-search" placeholder="Search transcripts">
      <button class="btn ghost" id="hist-clear">Clear all</button>
    </div>
    <div class="row-list" id="hist-list">
      ${rows.length ? rows.map(historyRowHtml).join('') : '<div class="empty">No dictations yet.</div>'}
    </div>
  `;
  document.getElementById('hist-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = rows.filter((r) => r.text.toLowerCase().includes(q) || (r.app || '').toLowerCase().includes(q));
    document.getElementById('hist-list').innerHTML =
      filtered.length ? filtered.map(historyRowHtml).join('') : '<div class="empty">No matches.</div>';
  });
  document.getElementById('hist-clear').addEventListener('click', async () => {
    await api.historyClear();
    renderHistory();
  });
}

// ---------------------------------------------------------------- dictionary

async function renderDictionary() {
  const el = document.getElementById('tab-dictionary');
  const entries = await api.dictList();
  el.innerHTML = `
    <h1>Dictionary</h1>
    <p class="sub">Teach SpeakEasy your names, clients, products, and jargon. Add a correction to auto-fix a word the model keeps mishearing.</p>
    <div class="form-row">
      <input type="text" id="dict-word" placeholder="Correct word or phrase (e.g. Esmeralda)">
      <input type="text" id="dict-miss" placeholder="What it mishears (optional, e.g. Esmerelda)">
      <button class="btn" id="dict-add">Add</button>
    </div>
    <div class="row-list">
      ${entries.length ? entries.map((d) => `
        <div class="h-row" data-id="${d.id}">
          <div class="txt"><strong>${esc(d.word)}</strong>${d.misspelling ? ` <span style="color:var(--text-faint)">&larr; replaces &ldquo;${esc(d.misspelling)}&rdquo;</span>` : ''}</div>
          <div class="actions"><button class="icon-btn danger" data-action="dict-delete">&#x2715;</button></div>
        </div>`).join('') : '<div class="empty">No entries yet.</div>'}
    </div>
  `;
  document.getElementById('dict-add').addEventListener('click', async () => {
    const word = document.getElementById('dict-word').value.trim();
    const miss = document.getElementById('dict-miss').value.trim();
    if (!word) return;
    entries.unshift({ id: String(Date.now()), word, misspelling: miss || undefined });
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
      <input type="text" id="snip-trigger" placeholder="Trigger phrase (e.g. my calendar link)" style="max-width:260px">
      <input type="text" id="snip-expansion" placeholder="Expands to (e.g. https://cal.com/...)">
      <button class="btn" id="snip-add">Add</button>
    </div>
    <div class="row-list">
      ${entries.length ? entries.map((s) => `
        <div class="h-row" data-id="${s.id}">
          <div class="txt"><strong>${esc(s.trigger)}</strong><div class="meta" style="font-family:'Figtree'">${esc(s.expansion)}</div></div>
          <div class="actions"><button class="icon-btn danger" data-action="snip-delete">&#x2715;</button></div>
        </div>`).join('') : '<div class="empty">No snippets yet.</div>'}
    </div>
  `;
  document.getElementById('snip-add').addEventListener('click', async () => {
    const trigger = document.getElementById('snip-trigger').value.trim();
    const expansion = document.getElementById('snip-expansion').value.trim();
    if (!trigger || !expansion) return;
    entries.unshift({ id: String(Date.now()), trigger, expansion });
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
    .map(([k, v]) => `<option value="${k}" ${cfg.holdKey === k ? 'selected' : ''}>${isMac ? v.label : v.winLabel}</option>`).join('');

  const langs = [['auto', 'Auto-detect'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['hi', 'Hindi'], ['gu', 'Gujarati'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['it', 'Italian'], ['ru', 'Russian'], ['ar', 'Arabic']];
  const langOptions = langs.map(([v, l]) => `<option value="${v}" ${cfg.language === v ? 'selected' : ''}>${l}</option>`).join('');

  const micOptions = ['<option value="default">System default</option>']
    .concat(mics.filter((m) => m.deviceId !== 'default').map((m) =>
      `<option value="${esc(m.deviceId)}" ${cfg.micDeviceId === m.deviceId ? 'selected' : ''}>${esc(m.label)}</option>`))
    .join('');

  el.innerHTML = `
    <h1>Settings</h1>
    <p class="sub">Everything runs on this machine. Change anything, it applies instantly.</p>

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
        <div class="info"><div class="name">Language</div><div class="desc">Applies to Whisper models. Moonshine and Parakeet are English-only.</div></div>
        <select id="set-lang">${langOptions}</select>
      </div>
    </div>

    <div class="section-title">Model</div>
    ${Object.values(S.models.catalog).map(modelCardHtml).join('')}

    <div class="section-title">Cleanup</div>
    <div class="set-group">
      <div class="set-row">
        <div class="info"><div class="name">Remove filler words</div><div class="desc">Strips um, uh, er before pasting.</div></div>
        <label class="switch"><input type="checkbox" id="set-filler" ${cfg.fillerRemoval ? 'checked' : ''}><span class="track"></span></label>
      </div>
      <div class="set-row">
        <div class="info"><div class="name">AI polish</div><div class="desc">Optional second pass: fixes self-corrections ("2pm, actually 3pm"), formats lists. Ollama runs 100% local. Claude API sends text (not audio) to Anthropic.</div></div>
        <select id="set-polish">
          <option value="off" ${cfg.polishProvider === 'off' ? 'selected' : ''}>Off (rule-based only)</option>
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
    </div>

    <div class="section-title">System</div>
    <div class="set-group">
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

  const save = (partial) => api.updateSettings(partial).then((s) => { S = s; renderEnginePill(); });
  document.getElementById('set-holdkey').addEventListener('change', (e) => save({ holdKey: e.target.value }).then(renderHomeIfActive));
  document.getElementById('set-mic').addEventListener('change', (e) => save({ micDeviceId: e.target.value }));
  document.getElementById('set-lang').addEventListener('change', (e) => save({ language: e.target.value }));
  document.getElementById('set-filler').addEventListener('change', (e) => save({ fillerRemoval: e.target.checked }));
  document.getElementById('set-sounds').addEventListener('change', (e) => save({ sounds: e.target.checked }));
  document.getElementById('set-clip').addEventListener('change', (e) => save({ restoreClipboard: e.target.checked }));
  document.getElementById('set-login').addEventListener('change', (e) => save({ launchAtLogin: e.target.checked }));
  document.getElementById('set-polish').addEventListener('change', (e) => {
    save({ polishProvider: e.target.value });
    document.getElementById('row-ollama').style.display = e.target.value === 'ollama' ? 'flex' : 'none';
    document.getElementById('row-anthropic').style.display = e.target.value === 'anthropic' ? 'flex' : 'none';
  });
  document.getElementById('set-ollama-model').addEventListener('change', (e) => save({ polishOllamaModel: e.target.value.trim() }));
  document.getElementById('set-anthropic-key').addEventListener('change', (e) => save({ polishAnthropicKey: e.target.value.trim() }));
  document.getElementById('btn-rerun-onboard').addEventListener('click', () => { obStep = 0; showOnboard(true); });
}

function renderHomeIfActive() {
  if (currentTab === 'home') renderHome();
}

// ---------------------------------------------------------------- onboarding

function obPermRow(name, desc, ok, btnId) {
  return `
    <div class="ob-perm">
      <div class="info"><div class="name" style="font-weight:600;margin-bottom:2px">${name}</div><div class="desc" style="color:var(--text-dim);font-size:12.5px">${desc}</div></div>
      ${ok ? '<span class="status ok">GRANTED</span>' : `<button class="btn ghost" id="${btnId}">Grant</button>`}
    </div>`;
}

async function renderOnboard() {
  const el = document.getElementById('onboard');
  const perms = await api.permStatus();
  const isMac = S.platform === 'darwin';
  const micOk = perms.mic === 'granted';
  const axOk = perms.accessibility === true;
  const dl = S.models.downloads;
  const downloadingId = Object.keys(dl)[0];
  const hasModel = S.settings.model && S.models.installed.includes(S.settings.model);

  el.innerHTML = `
    <div class="ob-step ${obStep === 0 ? 'active' : ''}">
      <img class="ob-logo" src="../../build/icon.png" alt="">
      <h2 class="ob-brand">Speak<em>Easy</em></h2>
      <p class="lead">Voice dictation that lives on your machine. Hold a key, talk, release. Clean text lands wherever your cursor is. No cloud. No subscription. No audio ever leaves this computer.</p>
      <div class="ob-actions"><button class="btn" data-ob="next">Set it up</button></div>
      <div class="ob-forge">Coded by <span>The Forge</span></div>
    </div>

    <div class="ob-step ${obStep === 1 ? 'active' : ''}">
      <h2>First, your <em>name</em></h2>
      <p class="lead">SpeakEasy greets you by name and personalizes your dashboard. Stored locally, like everything else here.</p>
      <input type="text" id="ob-name" placeholder="What should we call you?" value="${esc(S.settings.userName)}" autofocus>
      <div class="ob-actions">
        <button class="btn" id="ob-name-save">Continue</button>
        <button class="muted-link" data-ob="next">Skip</button>
      </div>
    </div>

    <div class="ob-step ${obStep === 2 ? 'active' : ''}">
      <h2>Permissions</h2>
      <p class="lead">${isMac ? 'macOS needs two approvals: the microphone to hear you, Accessibility to type for you. Input Monitoring may also be requested for the hotkey.' : 'Windows will ask for microphone access on first recording.'}</p>
      ${obPermRow('Microphone', 'To hear you dictate', micOk, 'ob-mic')}
      ${isMac ? obPermRow('Accessibility', 'To paste text into other apps', axOk, 'ob-ax') : ''}
      <div class="ob-actions">
        <button class="btn" data-ob="next" ${micOk && (!isMac || axOk) ? '' : 'disabled'}>Continue</button>
        <button class="muted-link" data-ob="next">Skip for now</button>
      </div>
    </div>

    <div class="ob-step ${obStep === 3 ? 'active' : ''}">
      <h2>Pick your <em>engine</em></h2>
      <p class="lead">Both run fully offline. You can switch or add more later in Settings.</p>
      <div class="ob-model" data-ob-model="moonshine-base">
        <div class="t">Fast start</div>
        <div class="d">Moonshine Base &middot; 240 MB &middot; quick download, snappy on any machine</div>
        ${downloadingId === 'moonshine-base' ? `<div class="progress"><div class="fill" style="width:${dl['moonshine-base'] === -1 ? 100 : Math.round((dl['moonshine-base'] || 0) * 100)}%"></div></div>` : ''}
      </div>
      <div class="ob-model" data-ob-model="parakeet-v2">
        <div class="t">Best accuracy <span style="color:#a35708;font-size:11px;letter-spacing:0.06em;">RECOMMENDED</span></div>
        <div class="d">Parakeet 0.6B v2 &middot; 460 MB &middot; the model the best dictation apps use</div>
        ${downloadingId === 'parakeet-v2' ? `<div class="progress"><div class="fill" style="width:${dl['parakeet-v2'] === -1 ? 100 : Math.round((dl['parakeet-v2'] || 0) * 100)}%"></div></div>` : ''}
      </div>
      <div class="ob-actions">
        ${hasModel ? '<button class="btn" data-ob="next">Continue</button>' : downloadingId ? `<span class="ob-phase">Downloading ${downloadingId === 'moonshine-base' ? 'Moonshine' : 'Parakeet'}... ${dl[downloadingId] === -1 ? 'extracting' : Math.round((dl[downloadingId] || 0) * 100) + '%'}</span>` : ''}
      </div>
    </div>

    <div class="ob-step ${obStep === 4 ? 'active' : ''}">
      <h2>Try it${S.settings.userName ? ', ' + esc(S.settings.userName) : ''}</h2>
      <p class="lead">Click into the box, hold <strong>${esc(holdKeyLabel())}</strong>, say something, release.</p>
      <textarea class="ob-test" id="ob-test" placeholder="Your words land here..."></textarea>
      <div class="ob-phase" id="ob-phase"></div>
      <div class="ob-actions">
        <button class="btn" data-ob="finish">Start using SpeakEasy</button>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-ob="next"]').forEach((b) => b.addEventListener('click', () => { obStep += 1; renderOnboard(); }));
  const nameSave = document.getElementById('ob-name-save');
  if (nameSave) {
    const saveName = async () => {
      const v = document.getElementById('ob-name').value.trim();
      if (v) S = await api.updateSettings({ userName: v });
      obStep = 2;
      renderOnboard();
    };
    nameSave.addEventListener('click', saveName);
    document.getElementById('ob-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
    setTimeout(() => { const i = document.getElementById('ob-name'); if (i && obStep === 1) i.focus(); }, 50);
  }
  const fin = el.querySelector('[data-ob="finish"]');
  if (fin) fin.addEventListener('click', async () => {
    S = await api.updateSettings({ onboarded: true });
    showOnboard(false);
    renderAll();
  });
  const micBtn = document.getElementById('ob-mic');
  if (micBtn) micBtn.addEventListener('click', async () => {
    await api.requestMic();
    setTimeout(renderOnboard, 500);
  });
  const axBtn = document.getElementById('ob-ax');
  if (axBtn) axBtn.addEventListener('click', async () => {
    await api.requestAccessibility();
    api.openPermSettings('accessibility');
    pollPerms();
  });
  el.querySelectorAll('[data-ob-model]').forEach((card) => card.addEventListener('click', async () => {
    const id = card.getAttribute('data-ob-model');
    if (S.models.installed.includes(id)) {
      S = await api.updateSettings({ model: id });
      obStep = 4;
      renderOnboard();
      return;
    }
    if (Object.keys(S.models.downloads).length) return; // already downloading
    api.downloadModel(id).then(async (res) => {
      if (res.ok) {
        S = await api.updateSettings({ model: id });
        obStep = 4;
      }
      renderOnboard();
    });
    S.models.downloads[id] = 0;
    renderOnboard();
  }));
}

let permPoll = null;
function pollPerms() {
  clearInterval(permPoll);
  permPoll = setInterval(async () => {
    const p = await api.permStatus();
    if (p.accessibility) { clearInterval(permPoll); renderOnboard(); }
  }, 1500);
}

function showOnboard(visible) {
  document.getElementById('onboard').classList.toggle('visible', visible);
  if (visible) renderOnboard();
  else clearInterval(permPoll);
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

function switchTab(tab) {
  if (!renderers[tab]) return;
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.getAttribute('data-tab') === tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${tab}`));
  renderers[tab]();
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
});

// Cmd/Ctrl+1-5 jumps straight to a tab
const TAB_ORDER = ['home', 'history', 'dictionary', 'snippets', 'settings'];
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    switchTab(TAB_ORDER[Number(e.key) - 1]);
  }
});

document.getElementById('content').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const row = btn.closest('[data-id]');
  const modelCard = btn.closest('[data-model]');

  if (action === 'copy' && row) {
    const rows = await api.historyList();
    const r = rows.find((x) => x.id === row.getAttribute('data-id'));
    if (r) await api.copy(r.text);
    btn.textContent = '✓';
    setTimeout(() => { btn.innerHTML = '&#x2398;'; }, 900);
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
  if (msg.type === 'download-progress') {
    if (msg.error || msg.done) {
      const err = msg.error ? { id: msg.id, message: msg.error } : null;
      S = await api.getState();
      S.models.lastError = err;
    } else {
      S.models.downloads[msg.id] = msg.progress;
    }
    if (document.getElementById('onboard').classList.contains('visible')) renderOnboard();
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
  } else if (msg.type === 'stats') {
    S = await api.getState();
    if (currentTab === 'home') renderHome();
  } else if (msg.type === 'dictation') {
    const phase = document.getElementById('ob-phase');
    if (phase) {
      phase.textContent = msg.phase === 'recording' ? 'Listening...'
        : msg.phase === 'processing' ? 'Computing...'
        : msg.phase === 'done' ? `Done. ${msg.words} words in.`
        : msg.phase === 'cancelled' ? 'Cancelled.'
        : msg.phase === 'error' ? `Error: ${msg.message}` : '';
    }
  }
});

// ---------------------------------------------------------------- boot

(async function boot() {
  S = await api.getState();
  renderAll();
  if (!S.settings.onboarded || !S.settings.model) showOnboard(true);
})();
