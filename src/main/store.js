'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { DEFAULT_SETTINGS } = require('../shared/constants');

class JsonStore {
  constructor(name, defaults) {
    this.file = path.join(app.getPath('userData'), name + '.json');
    this.defaults = defaults;
    this.data = this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(this.defaults)) {
        return Array.isArray(raw) ? raw : [...this.defaults];
      }
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { ...this.defaults, ...raw };
      }
      return { ...this.defaults };
    } catch (e) {
      // Keep a copy of a corrupt file instead of silently overwriting it
      if (e.code !== 'ENOENT' && fs.existsSync(this.file)) {
        try { fs.copyFileSync(this.file, this.file + '.corrupt'); } catch { /* best effort */ }
        console.error(`[store] ${path.basename(this.file)} unreadable, backed up as .corrupt`);
      }
      return Array.isArray(this.defaults) ? [...this.defaults] : { ...this.defaults };
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

// ---- Settings ----
let settingsStore;
function settings() {
  if (!settingsStore) settingsStore = new JsonStore('settings', DEFAULT_SETTINGS);
  return settingsStore.data;
}
function updateSettings(partial) {
  Object.assign(settings(), partial);
  settingsStore.save();
  return settingsStore.data;
}

// Window placement is separate from dictation preferences and personal data.
let windowStore;
function windowState() {
  if (!windowStore) windowStore = new JsonStore('window', {});
  return windowStore.data;
}
function saveWindowState(bounds) {
  windowState();
  windowStore.data = bounds;
  windowStore.save();
}

// Control Pad mapping (pads keyed by keyboard key) lives apart from settings.
let padStore;
function pad() {
  if (!padStore) padStore = new JsonStore('pad', {});
  return padStore.data;
}
function savePad(pads) {
  pad();
  padStore.data = pads;
  padStore.save();
  return padStore.data;
}

// ---- History (most recent first, capped) ----
const HISTORY_CAP = 500;
let historyStore;
function history() {
  if (!historyStore) historyStore = new JsonStore('history', []);
  return historyStore;
}
function addHistory(entry) {
  const h = history();
  h.data.unshift(entry);
  if (h.data.length > HISTORY_CAP) h.data.length = HISTORY_CAP;
  h.save();
  return entry;
}
function removeHistory(id) {
  const h = history();
  h.data = h.data.filter((e) => e.id !== id);
  h.save();
}
function clearHistory() {
  const h = history();
  h.data = [];
  h.save();
}

// ---- Dictionary: [{id, word, misspelling}] ----
// word = the correct form. misspelling (optional) = what the model tends to hear.
let dictStore;
function dictionary() {
  if (!dictStore) dictStore = new JsonStore('dictionary', []);
  return dictStore;
}

// ---- Snippets: [{id, trigger, expansion}] ----
let snippetStore;
function snippets() {
  if (!snippetStore) snippetStore = new JsonStore('snippets', []);
  return snippetStore;
}

// ---- Stats ----
const STATS_DEFAULTS = {
  totalWords: 0,
  totalTranscriptions: 0,
  totalSpeechSeconds: 0,
  days: {} // 'YYYY-MM-DD' -> {words, transcriptions, speechSeconds}
};
let statsStore;
function stats() {
  if (!statsStore) statsStore = new JsonStore('stats', STATS_DEFAULTS);
  return statsStore;
}
// Local-time day key. toISOString() is UTC and would credit evening
// dictations to tomorrow, zeroing "Today" and breaking streaks.
function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function recordTranscription(words, speechSeconds) {
  const s = stats();
  const day = dayKey(new Date());
  s.data.totalWords += words;
  s.data.totalTranscriptions += 1;
  s.data.totalSpeechSeconds += speechSeconds;
  const d = s.data.days[day] || { words: 0, transcriptions: 0, speechSeconds: 0 };
  d.words += words;
  d.transcriptions += 1;
  d.speechSeconds += speechSeconds;
  s.data.days[day] = d;
  s.save();
}

const TYPING_WPM = 40; // average keyboard typist, used for "time saved"

function statsSummary() {
  const s = stats().data;
  const today = new Date();
  const todayStats = s.days[dayKey(today)] || { words: 0, transcriptions: 0, speechSeconds: 0 };

  let weekWords = 0, weekSeconds = 0, weekTranscriptions = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const st = s.days[dayKey(d)];
    if (st) { weekWords += st.words; weekSeconds += st.speechSeconds; weekTranscriptions += st.transcriptions; }
  }

  // streak: consecutive days with at least one transcription, ending today or yesterday
  let streak = 0;
  const cursor = new Date(today);
  if (!s.days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (s.days[dayKey(cursor)] && s.days[dayKey(cursor)].transcriptions > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const timeSaved = (words, seconds) => Math.max(0, (words / TYPING_WPM) * 60 - seconds);
  const wpm = s.totalSpeechSeconds > 3 ? Math.round(s.totalWords / (s.totalSpeechSeconds / 60)) : 0;

  return {
    today: { ...todayStats, timeSavedSeconds: timeSaved(todayStats.words, todayStats.speechSeconds) },
    week: { words: weekWords, transcriptions: weekTranscriptions, speechSeconds: weekSeconds, timeSavedSeconds: timeSaved(weekWords, weekSeconds) },
    allTime: {
      words: s.totalWords,
      transcriptions: s.totalTranscriptions,
      speechSeconds: s.totalSpeechSeconds,
      timeSavedSeconds: timeSaved(s.totalWords, s.totalSpeechSeconds)
    },
    wpm,
    streak,
    days: s.days
  };
}

module.exports = {
  settings, updateSettings,
  windowState, saveWindowState,
  pad, savePad,
  history, addHistory, removeHistory, clearHistory,
  dictionary, snippets,
  recordTranscription, statsSummary
};
