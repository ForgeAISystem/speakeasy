'use strict';

// "What did I say about X": search the local History, fully offline. Nothing
// leaves the computer. Scores whole-word hits above partial ones, needs most
// of the topic words, and breaks ties by recency.

const QUERY = [
  /^(?:so\s+)?(?:what|when|where)\s+(?:did|have)\s+i\s+(?:say|said|talk(?:ed)?|mention(?:ed)?|write|wrote|dictate[d]?|speak|spoke|note[d]?)\s+(?:(?:about|on|regarding|re)\s+)?(.+)$/i,
  /^(?:search|find|look up|look for|check)\s+(?:in\s+)?(?:my\s+)?(?:history|dictations?|notes|transcripts?)\s+(?:for|about|on)\s+(.+)$/i,
  /^(?:find|show me|pull up)\s+(?:what|where|when|everything)\s+i\s+(?:said|talked|mentioned|dictated)\s+(?:about\s+)?(.+)$/i
];

/** "what did I say about the Legacy invoices?" -> "the Legacy invoices", else null. */
function parseQuery(text) {
  const t = String(text || '').trim().replace(/[?.!,]+$/, '');
  for (const re of QUERY) {
    const m = t.match(re);
    const topic = m && m[1].trim().replace(/[?.!,]+$/, '').replace(/^(?:with|to)\s+/i, '');
    if (topic) return topic;
  }
  return null;
}

const STOP = new Set(('a an the and or but of to in on at for with about from by is are was were be been it this that these those my our your ' +
  'their his her its me we you they i what when where who how did do does said say talk talked thing things stuff some any').split(' '));

function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 3 && w.endsWith('es') && /(?:ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

const words = (text) => String(text || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

function terms(query) {
  return [...new Set(words(query).filter((w) => !STOP.has(w)).map(stem))];
}

function snippet(text, query, terms, width = 150) {
  const lower = text.toLowerCase();
  let at = lower.indexOf(String(query).toLowerCase());
  if (at < 0) for (const t of terms) { at = lower.indexOf(t); if (at >= 0) break; }
  if (at < 0 || text.length <= width) return text.length <= width ? text : text.slice(0, width - 3).trimEnd() + '...';
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '');
}

/** entries: History rows (newest first). Returns up to `limit` matches, best first. */
function search(entries, query, { limit = 5 } = {}) {
  const want = terms(query);
  if (!want.length) return [];
  const phrase = String(query).toLowerCase().trim();
  const need = Math.max(1, Math.ceil(want.length * 0.6));
  const scored = [];
  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    if (!entry || entry.failed || entry.transform || !entry.text) return;
    const text = String(entry.text);
    const lower = text.toLowerCase();
    const have = new Set(words(text).map(stem));
    let hits = 0, score = 0;
    for (const t of want) {
      if (have.has(t)) { hits++; score += 2; } else if (t.length >= 4 && lower.includes(t)) { hits++; score += 1; }
    }
    if (hits < need) return;
    if (want.length > 1 && lower.includes(phrase)) score += 3;
    scored.push({ entry, score, index });
  });
  scored.sort((a, b) => b.score - a.score || (b.entry.ts || 0) - (a.entry.ts || 0) || a.index - b.index);
  return scored.slice(0, limit).map(({ entry }) => ({
    id: entry.id, ts: entry.ts, app: entry.app || '', text: entry.text, snippet: snippet(entry.text, phrase, want)
  }));
}

module.exports = { parseQuery, search, terms, stem, snippet };
