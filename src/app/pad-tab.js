'use strict';
// Pad tab: watch the Control Pad live and map any pad to an action.
(function () {
  const P = window.SpeakEasyPad;
  const UI = window.SpeakEasyPadUI;
  const e = UI.esc;
  let pads = null, selected = 'Q', info = {}, log = [];

  const SHORTCUTS = [['Control+Option+P', 'Control + Option + P'], ['Control+Option+Space', 'Control + Option + Space'], ['Command+Shift+Space', 'Command + Shift + Space'], ['F19', 'F19'], ['off', 'Off']];

  function fieldsFor(pad) {
    const regionOptions = Object.entries(P.REGIONS).map(([id, r]) => `<option value="${id}" ${pad.region === id ? 'selected' : ''}>${r.label}</option>`).join('');
    switch (pad.type) {
      case 'snap': return `<label class="pad-field"><span>Where the window goes</span><select data-field="region">${regionOptions}</select></label><p class="pad-note">Hit the same pad twice to send the window to your next screen.</p>`;
      case 'layout': {
        const wins = pad.windows || [];
        return `<div class="pad-field"><span>Saved windows</span>${wins.length ? `<ul class="pad-windows">${wins.map((w) => `<li><strong>${e(w.app)}</strong><span class="mono">${w.w}×${w.h} at ${w.x}, ${w.y}</span></li>`).join('')}</ul>` : '<p class="pad-note">Nothing saved yet. Arrange your apps the way you work, then save.</p>'}<button class="btn ghost btn-sm" type="button" id="pad-capture">Save my current windows</button><p class="pad-note">Shortcut: open the pad and press Shift + ${e(selected)}.</p></div>`;
      }
      case 'app': return `<label class="pad-field"><span>App name</span><input data-field="app" value="${e(pad.app || '')}" placeholder="Google Chrome"></label>`;
      case 'url': return `<label class="pad-field"><span>Link, file or folder</span><input data-field="url" value="${e(pad.url || '')}" placeholder="https://claude.ai or ~/Desktop"></label>`;
      case 'shortcut': return `<label class="pad-field"><span>Shortcut name</span><input data-field="name" value="${e(pad.name || '')}" placeholder="Exactly as in the Shortcuts app"></label><p class="pad-note">Shortcuts can open apps, start Focus, run scripts, and much more.</p>`;
      case 'keys': return `<label class="pad-field"><span>Keys to press</span><input data-field="keys" value="${e(pad.keys || '')}" placeholder="cmd+shift+4"></label><p class="pad-note">Pressed in the app you were using. Words: cmd, shift, opt, ctrl, space, return, tab, esc, left, right, up, down, f1 to f12.</p>`;
      case 'text': return `<label class="pad-field"><span>Prompt to paste</span><textarea data-field="text" rows="7" placeholder="You are my chief of staff. Here is what I need today...">${e(pad.text || '')}</textarea></label><p class="pad-note">Pastes where your cursor is. Great for long starter prompts.</p>`;
      case 'record': return '<p class="pad-note">Opens the macOS recorder toolbar (pick Record Entire Screen or a window) and turns on your camera bubble. Stop from the menu bar.</p>';
      case 'camera': return '<p class="pad-note">A round camera window that floats over everything. Drag it anywhere. Tap again to hide.</p>';
      default: return '<p class="pad-note">Pick what this pad does.</p>';
    }
  }

  function editorHtml() {
    const pad = pads[selected];
    const types = Object.entries(P.ACTIONS).map(([id, a]) => `<option value="${id}" ${pad.type === id ? 'selected' : ''}>${a.label}</option>`).join('');
    return `<div class="pad-editor-head"><kbd>${e(selected)}</kbd><div><div class="name">${e(P.label(pad) || 'Empty pad')}</div><div class="desc">${e(P.ACTIONS[pad.type].hint)}</div></div></div>
      <label class="pad-field"><span>Action</span><select id="pad-type">${types}</select></label>
      ${fieldsFor(pad)}
      ${pad.type !== 'none' ? `<label class="pad-field"><span>Name on the pad (optional)</span><input data-field="label" value="${e(pad.label || '')}" placeholder="${e(P.label({ ...pad, label: '' }))}"></label>` : ''}
      <div class="pad-editor-actions"><button class="btn btn-sm" type="button" id="pad-try">Try it</button>${pad.type !== 'none' ? '<button class="btn ghost btn-sm" type="button" id="pad-clear">Clear pad</button>' : ''}</div>`;
  }

  function logHtml() {
    if (!log.length) return '<li class="empty">Tap a pad. Every hit shows up here.</li>';
    return log.map((ev) => `<li class="${ev.ok ? 'ok' : 'fail'}"><kbd>${e(ev.key)}</kbd><span>${e(ev.label || '')}</span><span class="msg">${e(ev.message || '')}</span><time>${new Date(ev.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time></li>`).join('');
  }

  async function savePad(next) {
    const res = await api.padSet(selected, next);
    if (res.ok) pads = res.pads; else toast(res.message || 'Could not save that pad.');
  }

  function bindEditor() {
    const root = document.getElementById('pad-editor');
    root.querySelector('#pad-type').addEventListener('change', async (ev) => {
      const type = ev.target.value;
      const base = { type };
      if (type === 'snap') base.region = 'left';
      if (type === 'layout') base.windows = [];
      await savePad(base);
      renderPad();
    });
    root.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('change', async () => {
        await savePad({ ...pads[selected], [input.dataset.field]: input.value.trim() === '' && input.dataset.field === 'label' ? undefined : input.value });
        document.getElementById('pad-grid').innerHTML = UI.grid(pads, { selected });
        root.querySelector('.pad-editor-head .name').textContent = P.label(pads[selected]) || 'Empty pad';
      });
    });
    root.querySelector('#pad-capture')?.addEventListener('click', async () => {
      const ev = await api.padSave(selected);
      const res = await api.padGet();
      pads = res.pads;
      toast(ev.message || 'Saved.');
      renderPad();
    });
    root.querySelector('#pad-try').addEventListener('click', () => api.padPress(selected));
    root.querySelector('#pad-clear')?.addEventListener('click', async () => { await savePad({ type: 'none' }); renderPad(); });
  }

  async function renderPad() {
    const el = document.getElementById('tab-pad');
    const res = await api.padGet();
    info = res;
    pads = res.pads;
    if (!res.available) {
      el.innerHTML = '<h1>Control Pad</h1><p class="sub">The Control Pad runs on Mac.</p>';
      return;
    }
    const cfg = S.settings;
    const opener = cfg.padMicKey !== false ? 'Tap the microphone key' : res.shortcut ? `Press ${res.shortcut.replace(/\+/g, ' + ')}` : 'Use the menu bar icon';
    el.innerHTML = `
      <h1>Control Pad</h1>
      <p class="sub">Your keyboard is a drum pad. ${e(opener)}, then hit a key. Snap windows, bring back a whole workflow, open apps, paste prompts, record your screen.</p>
      <div class="pad-layout">
        <div class="pad-device">
          <div class="pad-device-head"><span>LIVE</span><span class="live-dot"></span><button class="btn btn-sm" type="button" id="pad-open">Open the pad</button></div>
          <div class="grid" id="pad-grid">${UI.grid(pads, { selected })}</div>
          <ul class="pad-log" id="pad-log">${logHtml()}</ul>
        </div>
        <div class="pad-editor" id="pad-editor">${editorHtml()}</div>
      </div>
      <div class="section-title">How you open it</div>
      <div class="set-group">
        <div class="set-row">
          <div class="info"><div class="name">Microphone key</div><div class="desc">The mic key on the top row (F5 on newer MacBooks) opens the pad instead of macOS dictation. Works while Fn is your dictation key.</div></div>
          <label class="switch"><input type="checkbox" id="pad-mic" aria-label="Microphone key" ${cfg.padMicKey !== false ? 'checked' : ''}><span class="track"></span></label>
        </div>
        <div class="set-row">
          <div class="info"><div class="name">Keyboard shortcut</div><div class="desc">${res.shortcutError ? e(res.shortcutError) : 'Opens the pad from any app. The menu bar icon has it too.'}</div></div>
          <select id="pad-shortcut" aria-label="Keyboard shortcut">${SHORTCUTS.map(([v, l]) => `<option value="${v}" ${(cfg.padShortcut || 'off') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="set-row">
          <div class="info"><div class="name">Camera bubble</div><div class="desc">A round camera on top of your screen for recordings.</div></div>
          <button class="btn ghost btn-sm" type="button" id="pad-camera">Show or hide</button>
        </div>
      </div>`;
    document.getElementById('pad-grid').addEventListener('click', (ev) => {
      const tile = ev.target.closest('.pad-tile');
      if (!tile) return;
      selected = tile.dataset.key;
      document.getElementById('pad-grid').innerHTML = UI.grid(pads, { selected });
      document.getElementById('pad-editor').innerHTML = editorHtml();
      bindEditor();
    });
    document.getElementById('pad-open').addEventListener('click', async () => { await api.hideApp(); setTimeout(() => api.padOpen(), 350); });
    document.getElementById('pad-camera').addEventListener('click', () => api.padCamera());
    document.getElementById('pad-mic').addEventListener('change', async (ev) => { S = await api.updateSettings({ padMicKey: ev.target.checked }); renderPad(); });
    document.getElementById('pad-shortcut').addEventListener('change', async (ev) => { S = await api.updateSettings({ padShortcut: ev.target.value }); renderPad(); });
    bindEditor();
  }

  renderers.pad = renderPad;
  TAB_ORDER.splice(4, 0, 'pad');

  api.onPush(async (msg) => {
    if (msg.type !== 'pad' || !msg.key) return;
    const grid = document.getElementById('pad-grid');
    UI.flash(grid, msg);
    if (msg.phase === 'hit') return;
    log = [msg, ...log].slice(0, 8);
    const list = document.getElementById('pad-log');
    if (list) list.innerHTML = logHtml();
    if (msg.source === 'save' && currentTab === 'pad') renderPad();
  });
})();
