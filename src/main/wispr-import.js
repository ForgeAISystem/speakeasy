'use strict';

// Reads the personal dictionary and snippets from a local Wispr Flow install so
// a switcher keeps the vocabulary they already taught it. Read-only: the
// database is opened immutable and never written.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const WISPR_DB = path.join(os.homedir(), 'Library', 'Application Support', 'Wispr Flow', 'flow.sqlite');

const QUERY = `select phrase, replacement, isSnippet from Dictionary
  where isDeleted = 0 and coalesce(source, '') <> 'default' and trim(coalesce(phrase, '')) <> ''`;

function queryRows(dbPath) {
  return new Promise((resolve, reject) => {
    const uri = `file:${encodeURI(dbPath)}?mode=ro&immutable=1`;
    execFile('/usr/bin/sqlite3', ['-json', uri, QUERY], { timeout: 10000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error('Could not read the Wispr Flow dictionary.'));
      try { resolve(stdout.trim() ? JSON.parse(stdout) : []); } catch { reject(new Error('Unexpected Wispr Flow data.')); }
    });
  });
}

// Wispr rows: a plain word (phrase only), a replacement (phrase -> replacement),
// or a snippet (isSnippet, trigger -> expansion).
function toEntries(rows) {
  const words = [];
  const snippets = [];
  for (const row of rows) {
    const phrase = String(row.phrase).trim();
    const replacement = String(row.replacement || '').trim();
    if (row.isSnippet) { if (replacement) snippets.push({ trigger: phrase, expansion: replacement }); }
    else if (replacement) words.push({ word: replacement, misspelling: phrase });
    else words.push({ word: phrase });
  }
  return { words, snippets };
}

function newOnly(found, existing) {
  const key = (s) => s.toLocaleLowerCase();
  const haveWords = new Set(existing.dictionary.map((d) => key(d.word || '')));
  const haveTriggers = new Set(existing.snippets.map((s) => key(s.trigger || '')));
  const words = found.words.filter((w) => !haveWords.has(key(w.word)) && haveWords.add(key(w.word)));
  const snippets = found.snippets.filter((s) => !haveTriggers.has(key(s.trigger)) && haveTriggers.add(key(s.trigger)));
  return { words, snippets };
}

async function readWispr(existing, dbPath = WISPR_DB) {
  if (process.platform !== 'darwin' || !fs.existsSync(dbPath)) return { available: false, words: [], snippets: [] };
  return { available: true, ...newOnly(toEntries(await queryRows(dbPath)), existing) };
}

module.exports = { readWispr, toEntries, newOnly, WISPR_DB };
