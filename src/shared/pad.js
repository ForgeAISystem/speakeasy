'use strict';

// The Control Pad: a 4x4 grid of pads, laid out on the keyboard the way an MPC
// lays out drum pads. The key's position matches the screen region it snaps to
// (Q = top left, S = full screen, C = bottom right). Every pad can be remapped.
(function (root) {
  const ROWS = [['1', '2', '3', '4'], ['Q', 'W', 'E', 'R'], ['A', 'S', 'D', 'F'], ['Z', 'X', 'C', 'V']];
  const KEYS = ROWS.flat();

  // [x, y, width, height] as fractions of the screen's usable area.
  const REGIONS = {
    'top-left': { label: 'Top left', r: [0, 0, 0.5, 0.5] },
    top: { label: 'Top half', r: [0, 0, 1, 0.5] },
    'top-right': { label: 'Top right', r: [0.5, 0, 0.5, 0.5] },
    left: { label: 'Left half', r: [0, 0, 0.5, 1] },
    full: { label: 'Full screen', r: [0, 0, 1, 1] },
    right: { label: 'Right half', r: [0.5, 0, 0.5, 1] },
    'bottom-left': { label: 'Bottom left', r: [0, 0.5, 0.5, 0.5] },
    bottom: { label: 'Bottom half', r: [0, 0.5, 1, 0.5] },
    'bottom-right': { label: 'Bottom right', r: [0.5, 0.5, 0.5, 0.5] },
    'left-third': { label: 'Left third', r: [0, 0, 1 / 3, 1] },
    'center-third': { label: 'Center third', r: [1 / 3, 0, 1 / 3, 1] },
    'right-third': { label: 'Right third', r: [2 / 3, 0, 1 / 3, 1] },
    'left-two-thirds': { label: 'Left two thirds', r: [0, 0, 2 / 3, 1] },
    'right-two-thirds': { label: 'Right two thirds', r: [1 / 3, 0, 2 / 3, 1] },
    center: { label: 'Center', r: [0.15, 0.1, 0.7, 0.8] }
  };

  const ACTIONS = {
    none: { label: 'Empty', hint: 'Nothing yet. Pick an action.' },
    snap: { label: 'Snap window', hint: 'Moves the window you were using.' },
    layout: { label: 'Workflow layout', hint: 'Puts every saved app back where you saved it.' },
    app: { label: 'Open app', hint: 'Opens or switches to an app.' },
    url: { label: 'Open link', hint: 'Opens a website, file or folder.' },
    shortcut: { label: 'Run Shortcut', hint: 'Runs a Shortcut from the Shortcuts app.' },
    keys: { label: 'Press keys', hint: 'Presses a key combo in the app you were using.' },
    text: { label: 'Paste prompt', hint: 'Pastes your saved text where your cursor is.' },
    record: { label: 'Record screen', hint: 'Opens the macOS screen recorder and your camera bubble.' },
    camera: { label: 'Camera bubble', hint: 'Shows or hides a round camera window on top.' }
  };

  const SNAP_KEYS = { Q: 'top-left', W: 'top', E: 'top-right', A: 'left', S: 'full', D: 'right', Z: 'bottom-left', X: 'bottom', C: 'bottom-right' };

  function defaultPads() {
    const pads = {};
    for (const key of KEYS) pads[key] = { type: 'none' };
    for (const [key, region] of Object.entries(SNAP_KEYS)) pads[key] = { type: 'snap', region };
    ['1', '2', '3', '4'].forEach((key, i) => { pads[key] = { type: 'layout', label: `Workflow ${i + 1}`, windows: [] }; });
    pads.R = { type: 'record' };
    pads.F = { type: 'camera' };
    pads.V = { type: 'text', label: 'Starter prompt', text: '' };
    return pads;
  }

  function normalize(saved) {
    const pads = defaultPads();
    if (saved && typeof saved === 'object') {
      for (const key of KEYS) {
        const pad = saved[key];
        if (pad && Object.hasOwn(ACTIONS, pad.type)) pads[key] = { ...pad };
      }
    }
    return pads;
  }

  function label(pad) {
    if (!pad) return '';
    if (pad.label) return pad.label;
    if (pad.type === 'snap') return REGIONS[pad.region]?.label || 'Snap';
    if (pad.type === 'app') return pad.app || 'Open app';
    if (pad.type === 'shortcut') return pad.name || 'Shortcut';
    if (pad.type === 'keys') return pad.keys || 'Keys';
    if (pad.type === 'url') return (pad.url || 'Link').replace(/^https?:\/\/(www\.)?/, '').slice(0, 22);
    return ACTIONS[pad.type]?.label || '';
  }

  /** A whole-pixel frame inside workArea. Neighbors share an edge with no gap. */
  function frameFor(region, area) {
    const r = (REGIONS[region] || REGIONS.full).r;
    const x0 = Math.round(area.x + r[0] * area.width), x1 = Math.round(area.x + (r[0] + r[2]) * area.width);
    const y0 = Math.round(area.y + r[1] * area.height), y1 = Math.round(area.y + (r[1] + r[3]) * area.height);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  function sameFrame(a, b, slack = 12) {
    return !!a && !!b && ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= slack);
  }

  // "cmd+shift+4" -> { key: '4', modifiers: ['command', 'shift'] } for System Events.
  const MOD = { cmd: 'command', command: 'command', shift: 'shift', opt: 'option', option: 'option', alt: 'option', ctrl: 'control', control: 'control' };
  const CODES = { space: 49, return: 36, enter: 36, tab: 48, esc: 53, escape: 53, delete: 51, left: 123, right: 124, down: 125, up: 126,
    f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111 };
  function parseKeys(text) {
    const parts = String(text || '').toLowerCase().split(/[+\s]+/).filter(Boolean);
    const modifiers = [];
    let key = '';
    for (const part of parts) {
      if (MOD[part]) { if (!modifiers.includes(MOD[part])) modifiers.push(MOD[part]); } else key = part;
    }
    if (!key) return null;
    if (Object.hasOwn(CODES, key)) return { code: CODES[key], modifiers };
    if (key.length === 1) return { key, modifiers };
    return null;
  }

  const pad = { ROWS, KEYS, REGIONS, ACTIONS, defaultPads, normalize, label, frameFor, sameFrame, parseKeys };
  if (typeof module === 'object' && module.exports) module.exports = pad;
  else root.SpeakEasyPad = pad;
})(globalThis);
