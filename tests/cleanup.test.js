'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const writing = require('../src/shared/writing');

function fixture(settings, options = {}) {
  let requests = 0;
  const context = { module: { exports: {} }, console: { error() {} }, AbortSignal,
    require(id) {
      if (id === '../shared/writing') return writing;
      return { settings: () => settings, dictionary: () => ({ data: options.dictionary || [] }), snippets: () => ({ data: options.snippets || [] }) };
    }, fetch: async (...args) => { requests++; return options.fetch(...args); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/cleanup.js'), 'utf8'), context);
  return { ...context.module.exports, requests: () => requests };
}

test('original mode preserves every recognized word and never invokes a configured provider', async () => {
  const f = fixture({ cleanupMode: 'original', polishProvider: 'anthropic', polishAnthropicKey: 'test' }, { snippets: [{ trigger: 'my signature', expansion: 'Changed' }] });
  const text = 'um, my signature.\nOrganize my thoughts.';
  assert.equal((await f.cleanup(text)).text, text);
  assert.equal(f.requests(), 0);
});

test('clean mode applies local vocabulary and multiline snippets without a network request', async () => {
  const f = fixture({ cleanupMode: 'clean', polishProvider: 'ollama' }, {
    dictionary: [{ word: 'SpeakEasy', misspelling: 'speak easy' }],
    snippets: [{ trigger: 'my signature', expansion: 'Harsh Patel\nSpeakEasy\n$5 & <hello>' }]
  });
  assert.equal((await f.cleanup('um, use speak easy.')).text, 'Use SpeakEasy.');
  assert.equal((await f.cleanup('my signature.')).text, 'Harsh Patel\nSpeakEasy\n$5 & <hello>');
  assert.equal(f.requests(), 0);
});

test('clean mode preserves paragraph boundaries', async () => {
  const f = fixture({ cleanupMode: 'clean' });
  assert.equal((await f.cleanup('First thought.\n\nSecond thought.')).text, 'First thought.\n\nSecond thought.');
});

test('missing AI provider retains spoken organize instructions and labels the fallback', async () => {
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'off', organizeOnCommand: true });
  const result = await f.cleanup('Organize my thoughts. Send the invoice.');
  assert.equal(result.text, 'Organize my thoughts. Send the invoice.');
  assert.equal(result.fallbackReason, 'missing-provider');
  assert.equal(f.requests(), 0);
});

test('provider failure keeps complete local text including the original spoken request', async () => {
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'ollama', organizeOnCommand: true }, { fetch: async () => { throw new Error('connection refused'); } });
  const result = await f.cleanup('Organize my thoughts. Send the invoice.');
  assert.equal(result.text, 'Organize my thoughts. Send the invoice.');
  assert.equal(result.organized, false);
  assert.equal(result.fallbackReason, 'provider-unavailable');
});

test('successful AI cleanup expands multiline snippets after the provider returns', async () => {
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'ollama' }, {
    fetch: async () => ({ ok: true, json: async () => ({ message: { content: 'My signature.' } }) }),
    snippets: [{ trigger: 'my signature', expansion: 'Harsh\nhttps://example.com/?q=$1' }]
  });
  const result = await f.cleanup('uh my signature.');
  assert.equal(result.text, 'Harsh\nhttps://example.com/?q=$1');
  assert.equal(result.polished, true);
  assert.equal(f.requests(), 1);
});

test('legacy preference resolution never silently enables a cloud provider', () => {
  assert.equal(writing.mode({ fillerRemoval: true, polishProvider: 'off' }), 'clean');
  assert.equal(writing.mode({ fillerRemoval: false, polishProvider: 'off' }), 'original');
  assert.equal(writing.mode({ polishProvider: 'ollama' }), 'polished');
  assert.equal(writing.mode({ cleanupMode: 'original', polishProvider: 'ollama' }), 'original');
});
