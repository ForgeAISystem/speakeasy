'use strict';
// Shared pad tile markup for the floating pad and the Pad tab monitor.
(function (root) {
  const P = root.SpeakEasyPad;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TAGS = { none: '', snap: 'SNAP', layout: 'WORKFLOW', app: 'APP', url: 'LINK', shortcut: 'SHORTCUT', keys: 'KEYS', text: 'PROMPT', record: 'REC', camera: 'CAM' };

  function art(pad) {
    if (pad.type === 'snap') {
      const r = (P.REGIONS[pad.region] || P.REGIONS.full).r;
      return `<svg class="art" viewBox="0 0 40 26" aria-hidden="true"><rect x="0.75" y="0.75" width="38.5" height="24.5" rx="3" class="screen"/><rect x="${2 + r[0] * 36}" y="${2 + r[1] * 22}" width="${Math.max(r[2] * 36 - 1, 2)}" height="${Math.max(r[3] * 22 - 1, 2)}" rx="1.5" class="zone"/></svg>`;
    }
    if (pad.type === 'layout') {
      const n = (pad.windows || []).length;
      return `<svg class="art" viewBox="0 0 40 26" aria-hidden="true"><rect x="0.75" y="0.75" width="38.5" height="24.5" rx="3" class="screen"/>${n ? '<rect x="3" y="3" width="16" height="20" rx="1.5" class="zone"/><rect x="21" y="3" width="16" height="9" rx="1.5" class="zone"/><rect x="21" y="14" width="16" height="9" rx="1.5" class="zone"/>' : '<rect x="3" y="3" width="34" height="20" rx="1.5" class="zone empty"/>'}</svg>`;
    }
    if (pad.type === 'record') return '<svg class="art" viewBox="0 0 40 26" aria-hidden="true"><circle cx="20" cy="13" r="8" class="rec"/></svg>';
    if (pad.type === 'camera') return '<svg class="art" viewBox="0 0 40 26" aria-hidden="true"><circle cx="20" cy="13" r="10" class="screen"/><circle cx="20" cy="13" r="4.5" class="zone"/></svg>';
    return '';
  }

  // opts: selected, locked (the lesson that unlocks this key). Every tile carries
  // the words that run it; the cheat sheet (.peek) shows them.
  function tile(key, pad, opts = {}) {
    const name = P.label(pad) || 'Empty';
    const sub = opts.locked ? `After ${opts.locked}` : pad.type === 'layout' ? `${(pad.windows || []).length || 'No'} windows` : pad.type === 'none' ? 'Empty' : '';
    const say = P.phrase(key, pad);
    return `<button class="pad-tile type-${pad.type}${opts.selected ? ' selected' : ''}${opts.locked ? ' locked' : ''}" data-key="${esc(key)}" type="button" aria-label="${esc(key)}: ${esc(name)}${opts.locked ? ', locked' : ''}">
      <span class="pad-key">${esc(key)}</span><span class="pad-tag">${opts.locked ? 'LOCKED' : TAGS[pad.type] || ''}</span>
      ${art(pad)}
      <span class="pad-label">${esc(name)}</span>${sub ? `<span class="pad-sub">${esc(sub)}</span>` : ''}
      ${say ? `<span class="pad-say">“${esc(say)}”</span>` : ''}
    </button>`;
  }

  function grid(pads, opts = {}) {
    const locks = opts.locks || {};
    return P.KEYS.map((k) => tile(k, pads[k], { selected: opts.selected === k, locked: locks[k] })).join('');
  }

  function flash(container, event) {
    const el = container && container.querySelector(`.pad-tile[data-key="${event.key}"]`);
    if (!el) return;
    const cls = event.phase === 'hit' ? 'hit' : event.ok ? 'ok' : 'fail';
    el.classList.remove('hit', 'ok', 'fail');
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._flash);
    el._flash = setTimeout(() => el.classList.remove(cls), cls === 'hit' ? 700 : 1400);
  }

  root.SpeakEasyPadUI = { tile, grid, flash, esc };
})(globalThis);
