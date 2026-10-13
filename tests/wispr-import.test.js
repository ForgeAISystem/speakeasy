'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toEntries, newOnly } = require('../src/main/wispr-import');

test('Wispr rows become words, replacements, and snippets', () => {
  const found = toEntries([
    { phrase: 'Hormozi', replacement: null, isSnippet: 0 },
    { phrase: 'speak easy', replacement: 'SpeakEasy', isSnippet: 0 },
    { phrase: 'my email address', replacement: 'me@example.com', isSnippet: 1 },
    { phrase: 'empty snippet', replacement: '', isSnippet: 1 }
  ]);
  assert.deepEqual(found.words, [{ word: 'Hormozi' }, { word: 'SpeakEasy', misspelling: 'speak easy' }]);
  assert.deepEqual(found.snippets, [{ trigger: 'my email address', expansion: 'me@example.com' }]);
});

test('import skips words and triggers already saved, ignoring case and duplicates', () => {
  const found = { words: [{ word: 'Hudson' }, { word: 'hudson' }, { word: 'Vercel' }], snippets: [{ trigger: 'My Email', expansion: 'x' }, { trigger: 'sig', expansion: 'y' }] };
  const fresh = newOnly(found, { dictionary: [{ word: 'Vercel' }], snippets: [{ trigger: 'my email' }] });
  assert.deepEqual(fresh.words, [{ word: 'Hudson' }]);
  assert.deepEqual(fresh.snippets, [{ trigger: 'sig', expansion: 'y' }]);
});
