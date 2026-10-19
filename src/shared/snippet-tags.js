'use strict';

// Tags inside a snippet's saved text, filled at the moment it is spoken:
// {date} October 18, 2026 · {time} 9:41 PM · {day} Sunday · {clipboard} what you last copied.
(function (root) {
  const TAGS = ['date', 'time', 'day', 'clipboard'];

  function expandTags(text, { now = new Date(), clipboard = () => '' } = {}) {
    if (!text || text.indexOf('{') < 0) return text;
    return text.replace(/\{(date|time|day|clipboard)\}/gi, (_m, tag) => {
      switch (tag.toLowerCase()) {
        case 'date': return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        case 'time': return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        case 'day': return now.toLocaleDateString('en-US', { weekday: 'long' });
        case 'clipboard': { try { return String(clipboard() || ''); } catch { return ''; } }
        default: return _m;
      }
    });
  }

  const api = { TAGS, expandTags };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpeakEasySnippetTags = api;
})(globalThis);
