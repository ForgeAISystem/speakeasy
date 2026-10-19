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
      if (id === '../shared/snippet-tags') return require('../src/shared/snippet-tags');
      if (id === 'electron') return { clipboard: { readText: () => options.clipboard || '' } };
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

test('clean mode removes measured verbal tics but keeps meaningful phrasing', async () => {
  const f = fixture({ cleanupMode: 'clean' });
  const cases = [
    ["It's, you know, fine.", "It's fine."],
    ["It's late, you know.", "It's late."],
    ['Like, we should ship it.', 'We should ship it.'],
    ['I I think the the plan works.', 'I think the plan works.'],
    ["So yeah, let's do it.", "Let's do it."],
    ['Do you know what time it is?', 'Do you know what time it is?'],
    ['You know the drill.', 'You know the drill.'],
    ['It works like a charm.', 'It works like a charm.'],
    ['What it is, is a problem.', 'What it is, is a problem.'],
    ['We meet at 9 a.m. and then lunch.', 'We meet at 9 a.m. and then lunch.']
  ];
  for (const [input, expected] of cases) assert.equal((await f.cleanup(input)).text, expected, input);
});

test('spoken punctuation, line breaks, and scratch that are applied locally', async () => {
  const f = fixture({ cleanupMode: 'clean' });
  assert.equal((await f.cleanup('Why do you need a new secret? Question mark. And tell me.')).text, 'Why do you need a new secret? And tell me.');
  assert.equal((await f.cleanup('First line. New line. Second line.')).text, 'First line.\nSecond line.');
  assert.equal((await f.cleanup('Fix the bug, new line')).text, 'Fix the bug');
  assert.equal((await f.cleanup('Is it ready question mark')).text, 'Is it ready?');
  for (const literal of ['Put a question mark at the end.', 'Add a new line of code.', "Don't scratch that surface.", 'I started a new paragraph today.']) {
    assert.equal((await f.cleanup(literal)).text, literal, literal);
  }
  assert.equal((await f.cleanup('Done. New paragraph. Next part')).text, 'Done.\n\nNext part');
  assert.equal((await f.cleanup("Let's meet at two. Scratch that. Let's meet at three.")).text, "Let's meet at three.");
  assert.equal((await f.cleanup('That is amazing exclamation point')).text, 'That is amazing!');
});

test('vocabulary matches split and joined forms but leaves domains and lowercase capitals alone', async () => {
  const f = fixture({ cleanupMode: 'clean' }, { dictionary: [{ word: 'Bella Vita' }, { word: 'SpeakEasy' }, { word: 'codebase' }, { word: 'claude' }, { word: 'open claw' }] });
  assert.equal((await f.cleanup('The bellavita dashboard uses speak easy.')).text, 'The Bella Vita dashboard uses SpeakEasy.');
  assert.equal((await f.cleanup('Open go.bellavita.dance now.')).text, 'Open go.bellavita.dance now.');
  assert.equal((await f.cleanup('Codebase is ready. Ask Claude.')).text, 'Codebase is ready. Ask Claude.');
  assert.equal((await f.cleanup('Restart open-claw today. Openclaw works.')).text, 'Restart open claw today. Open claw works.');
});

test('chat apps drop the final period of a single sentence only', async () => {
  const f = fixture({ cleanupMode: 'clean' });
  assert.equal((await f.cleanup('Running five minutes late.', { app: 'Messages' })).text, 'Running five minutes late');
  assert.equal((await f.cleanup('Running late. Start without me.', { app: 'Messages' })).text, 'Running late. Start without me.');
  assert.equal((await f.cleanup('Running five minutes late.', { app: 'Mail' })).text, 'Running five minutes late.');
  const off = fixture({ cleanupMode: 'clean', matchAppStyle: false });
  assert.equal((await off.cleanup('Running five minutes late.', { app: 'Messages' })).text, 'Running five minutes late.');
});

test('AI cleanup sends the app style and saved spellings, never the window title', async () => {
  let body;
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'ollama' }, {
    dictionary: [{ word: 'Hormozi' }, { word: 'claude' }],
    fetch: async (_url, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ message: { content: 'Send it to Hormozi.' } }) }; }
  });
  await f.cleanup('send it to hormozzy', { app: 'Google Chrome', title: 'Inbox (3) - private@example.com - Gmail' });
  const user = body.messages[1].content;
  assert.match(user, /App: Google Chrome\. An email\./);
  assert.match(user, /Vocabulary: Hormozi\n/);
  assert.match(user, /<transcript>\nSend it to hormozzy\n<\/transcript>/);
  assert.doesNotMatch(user, /private@example\.com|Gmail/);
});

test('an AI reply that answers the dictation instead of cleaning it is discarded', async () => {
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'ollama' }, {
    fetch: async () => ({ ok: true, json: async () => ({ message: { content: 'Sure! Here is a detailed plan with ten steps covering research, design, development, testing, launch, marketing, sales, support, analytics, and growth for your new product idea.' } }) })
  });
  const result = await f.cleanup('Write me a launch plan.');
  assert.equal(result.text, 'Write me a launch plan.');
  assert.equal(result.polished, false);
});

test('long dictations are polished in sentence-aligned parts in parallel', async () => {
  let calls = 0;
  const f = fixture({ cleanupMode: 'polished', polishProvider: 'ollama' }, {
    fetch: async (_url, init) => { calls++; const t = JSON.parse(init.body).messages[1].content.match(/<transcript>\n([\s\S]*)\n<\/transcript>/)[1]; return { ok: true, json: async () => ({ message: { content: t } }) }; }
  });
  const sentence = 'This sentence is part of a long dictation about the quarterly plan. ';
  const result = await f.cleanup(sentence.repeat(60));
  assert.ok(calls >= 3, `expected several parts, got ${calls}`);
  assert.equal(result.text.replace(/\s+/g, ' '), sentence.repeat(60).trim());
  for (const part of f.splitForPolish(sentence.repeat(60))) assert.match(part, /plan\.$/);
});

test('Claude cleanup uses current Haiku with thinking off and no sampling overrides', async () => {
  let request, options;
  const fakeSdk = class { constructor(o) { options = o; this.messages = { create: async (r) => { request = r; return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Send the invoice.' }] }; } }; } };
  const settings = { cleanupMode: 'polished', polishProvider: 'anthropic', polishAnthropicKey: 'sk-test', polishAnthropicModel: 'claude-haiku-5-5' };
  const context = { module: { exports: {} }, console: { error() {} }, AbortSignal,
    require(id) {
      if (id === '../shared/writing') return writing;
      if (id === '@anthropic-ai/sdk') return fakeSdk;
      return { settings: () => settings, dictionary: () => ({ data: [] }), snippets: () => ({ data: [] }) };
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/cleanup.js'), 'utf8'), context);
  const result = await context.module.exports.cleanup('um send the invoice');
  assert.equal(result.text, 'Send the invoice.');
  assert.equal(result.polished, true);
  assert.equal(options.apiKey, 'sk-test');
  assert.equal(request.model, 'claude-haiku-5-5');
  assert.deepEqual(JSON.parse(JSON.stringify(request.thinking)), { type: 'disabled' });
  assert.equal(request.output_config.effort, 'low');
  assert.equal(request.temperature, undefined);
});

test('a Claude refusal keeps the local text and labels the fallback', async () => {
  const fakeSdk = class { constructor() { this.messages = { create: async () => ({ stop_reason: 'refusal', content: [] }) }; } };
  const settings = { cleanupMode: 'polished', polishProvider: 'anthropic', polishAnthropicKey: 'sk-test' };
  const context = { module: { exports: {} }, console: { error() {} }, AbortSignal,
    require(id) {
      if (id === '../shared/writing') return writing;
      if (id === '@anthropic-ai/sdk') return fakeSdk;
      return { settings: () => settings, dictionary: () => ({ data: [] }), snippets: () => ({ data: [] }) };
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/cleanup.js'), 'utf8'), context);
  const result = await context.module.exports.cleanup('um send the invoice');
  assert.equal(result.text, 'Send the invoice');
  assert.equal(result.fallbackReason, 'provider-unavailable');
});

test('snippet tags fill in the date, day, time and clipboard when spoken', () => {
  const f = fixture({ cleanupMode: 'clean' }, { clipboard: 'https://cal.com/harsh', snippets: [{ trigger: 'meeting header', expansion: 'Notes for {day}, {date}\nLink: {clipboard}' }] });
  const out = f.applySnippets('meeting header');
  assert.match(out, /^Notes for \w+day, \w+ \d{1,2}, \d{4}\nLink: https:\/\/cal\.com\/harsh$/);
  const tags = require('../src/shared/snippet-tags');
  const now = new Date(2026, 9, 18, 21, 5);
  assert.equal(tags.expandTags('{date} {time} {day} {unknown}', { now }), 'October 18, 2026 9:05 PM Sunday {unknown}');
  assert.equal(tags.expandTags('{clipboard}', { clipboard: () => { throw new Error('no'); } }), '');
});

test('per-app rules beat the automatic guess and pass the note to Polished', () => {
  const f = fixture({ cleanupMode: 'clean' });
  const rules = [{ app: 'Slack', style: 'casual', note: 'No sign-off.' }, { app: 'Gmail', style: 'formal', note: 'Sign off with Best, Harsh' }];
  assert.equal(f.appStyle({ app: 'Slack' }, rules).category, 'messaging');
  assert.match(f.appStyle({ app: 'Slack' }, rules).hint, /Casual.*No sign-off\./);
  assert.equal(f.appStyle({ app: 'Google Chrome', title: 'Inbox - Gmail' }, rules).category, 'email');
  assert.equal(f.appStyle({ app: 'Slack' }, []).category, 'work-chat', 'no rule: automatic');
  assert.equal(f.appStyle({ app: 'Slack' }, [], false).category, 'other', 'automatic off and no rule');
  assert.equal(f.appStyle({ app: 'Slack' }, [{ app: 'Slack', style: 'bogus' }]).category, 'work-chat', 'unknown style ignored');
});
