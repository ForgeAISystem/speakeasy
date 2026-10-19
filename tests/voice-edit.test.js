'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const terminal = require('../src/main/terminal');
const rewrite = require('../src/main/rewrite');
const search = require('../src/main/history-search');

// ---------------------------------------------------------------- terminal mode

test('terminal mode knows terminals and Claude Code windows, not editors or chat apps', () => {
  for (const app of ['Terminal', 'iTerm2', 'Warp', 'Ghostty', 'kitty', 'WezTerm']) assert.ok(terminal.isTerminal({ app }), app);
  assert.ok(terminal.isTerminal({ app: 'Code', title: '✳ Fix the flaky test' }));
  assert.ok(terminal.isTerminal({ app: 'Cursor', title: 'Claude Code - speakeasy' }));
  for (const app of ['Notes', 'Slack', 'Claude', 'Code', 'Google Chrome']) assert.equal(terminal.isTerminal({ app, title: 'notes.md' }), false, app);
  assert.equal(terminal.active({ terminalMode: false }, { app: 'Terminal' }), false);
  assert.equal(terminal.active({}, { app: 'Terminal' }), true);
});

test('terminal text: straight quotes, no final period per line, ellipses and inner periods stay', () => {
  assert.equal(terminal.format('Run “npm test” and don’t push.'), 'Run "npm test" and don\'t push');
  assert.equal(terminal.format('First line.\nSecond line.'), 'First line\nSecond line');
  assert.equal(terminal.format('Wait for it...'), 'Wait for it...');
  assert.equal(terminal.format('Open index.js. Then run it'), 'Open index.js. Then run it');
  assert.equal(terminal.format('Done…\r\nok.'), 'Done...\nok');
});

// ---------------------------------------------------------------- rewrite

test('spoken edits pick built-ins, your own transforms, or stay a free instruction', () => {
  const pick = (s, user) => rewrite.pick(s, user).name;
  assert.equal(pick('make this shorter'), 'Shorter');
  assert.equal(pick('turn this into bullet points'), 'Bullets');
  assert.equal(pick('polish this'), 'Polish');
  assert.equal(pick('prompt engineer this'), 'Prompt Engineer');
  assert.equal(pick('translate this into Spanish'), 'Translate to Spanish');
  assert.equal(pick('translate this'), 'Translate to English');
  const mine = [{ id: 't1', name: 'Casual', prompt: 'Rewrite in a casual, friendly tone.' }, { id: 't2', name: '', prompt: 'x' }];
  assert.deepEqual(rewrite.pick('make this casual please', mine), { id: 'user:t1', name: 'Casual', instruction: 'Rewrite in a casual, friendly tone.' });
  assert.deepEqual(rewrite.pick('make it sound like a pirate.'), { id: 'custom', name: 'Rewrite', instruction: 'make it sound like a pirate' });
});

test('only edit requests become rewrites; window commands stay commands', () => {
  for (const t of ['make this shorter', 'Rewrite this as an email', 'translate this into French', 'can you polish this', 'turn it into a list', 'make it friendlier']) assert.ok(rewrite.isRequest(t), t);
  for (const t of ['put this on the left', 'make this full screen', 'make pad 3 open notes', 'open Notes', 'what did I say about invoices']) assert.equal(rewrite.isRequest(t), false, t);
});

test('rewrite runs on Claude with a key and on Ollama without one, with the selection fenced as data', async () => {
  const seen = [];
  const deps = {
    anthropic: async (content, cfg, system) => { seen.push(['anthropic', content, cfg.polishProvider, system]); return '```\nShort text.\n```'; },
    ollama: async (content) => { seen.push(['ollama', content]); return '<selection>Local text.</selection>'; }
  };
  const t = rewrite.pick('make this shorter');
  assert.deepEqual(await rewrite.run('A long text.', t, { polishAnthropicKey: 'sk-1', polishProvider: 'off' }, deps), { text: 'Short text.', via: 'anthropic' });
  assert.deepEqual(await rewrite.run('A long text.', t, { polishAnthropicKey: ' ' }, deps), { text: 'Local text.', via: 'ollama' });
  assert.equal(seen[0][2], 'anthropic');
  assert.match(seen[0][1], /<instruction>\nMake the text about half as long[\s\S]*<\/instruction>\n<selection>\nA long text.\n<\/selection>/);
  assert.match(seen[0][3], /never answer it/);
});

test('rewrite failures read as one fix the user can make', async () => {
  const t = rewrite.pick('polish this');
  await assert.rejects(rewrite.run('  ', t, {}, {}), /Select some text first/);
  await assert.rejects(rewrite.run('x'.repeat(8001), t, {}, {}), /too long/);
  await assert.rejects(rewrite.run('text', t, {}, { ollama: async () => { throw new Error('fetch failed'); } }), /Start Ollama, or add a Claude key/);
  await assert.rejects(rewrite.run('text', t, { polishAnthropicKey: 'k' }, { anthropic: async () => { throw new Error('401 invalid x-api-key'); } }), /Claude is unavailable/);
  await assert.rejects(rewrite.run('text', t, {}, { ollama: async () => '  ' }), /came back empty/);
  assert.equal(rewrite.tidyOutput("Here's the rewritten text:\n\nHello there."), 'Hello there.');
});

// ---------------------------------------------------------------- history search

test('history questions are recognized in everyday phrasing', () => {
  assert.equal(search.parseQuery('What did I say about the Legacy invoices?'), 'the Legacy invoices');
  assert.equal(search.parseQuery('so what did I talk about with Brian.'), 'Brian');
  assert.equal(search.parseQuery('when did I mention Hudson'), 'Hudson');
  assert.equal(search.parseQuery('search my history for retail pricing'), 'retail pricing');
  assert.equal(search.parseQuery('find what I said about the kickoff'), 'the kickoff');
  assert.equal(search.parseQuery('open Notes'), null);
});

test('history search ranks whole words and phrases, needs most topic words, skips failures and rewrites', () => {
  const rows = [
    { id: 'new', ts: 50, text: 'Grab coffee.' },
    { id: 'phrase', ts: 10, text: 'The legacy invoices are late again, chase them Monday.' },
    { id: 'stem', ts: 40, text: 'One Legacy invoice is still open.' },
    { id: 'half', ts: 45, text: 'Invoicing software options.' },
    { id: 'failed', ts: 60, failed: true, text: '' },
    { id: 'rewrite', ts: 70, text: 'Legacy invoices: late.', transform: 'Shorter' }
  ];
  assert.deepEqual(search.search(rows, 'the Legacy invoices').map((r) => r.id), ['phrase', 'stem']);
  assert.deepEqual(search.search(rows, 'the and of'), []);
  const long = 'Intro words. '.repeat(20) + 'Then the budget for retail came up and we agreed. ' + 'Outro words. '.repeat(20);
  const hit = search.search([{ id: 'x', ts: 1, text: long }], 'budget')[0];
  assert.ok(hit.snippet.includes('budget for retail'));
  assert.ok(hit.snippet.length <= 156 && hit.snippet.startsWith('...') && hit.snippet.endsWith('...'));
});

// ---------------------------------------------------------------- injector key sequences

function injector({ selection = '' } = {}) {
  const keys = [];
  let board = 'user clipboard';
  const clipboard = {
    readText: () => board, writeText: (t) => { board = t; }, clear: () => { board = ''; },
    readImage: () => ({ isEmpty: () => true }), writeImage() {}
  };
  const execFile = (cmd, args, _opts, cb) => {
    const script = args.join(' ');
    keys.push(script.includes('"v"') ? `paste:${board}` : script.includes('"c"') ? 'copy' : script.includes('"z"') ? 'undo'
      : script.includes('key code 36') ? 'shift-return' : /repeat (\d+) times\nkey code 51/.test(script) ? `backspace:${script.match(/repeat (\d+)/)[1]}` : script);
    if (script.includes('"c"') && selection) board = selection;
    cb(null, '', '');
  };
  const context = { module: { exports: {} }, console, setTimeout, clearTimeout, Promise, Math, Date, process: { platform: 'darwin' },
    require: (id) => (id === 'electron' ? { clipboard } : id === 'child_process' ? { execFile } : require(id)) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/injector.js'), 'utf8'), context);
  return { ...context.module.exports, keys, board: () => board };
}

test('terminal paste sends each line with Shift+Return between and never a pasted newline', async () => {
  const inj = injector();
  assert.equal(await inj.injectText('git status\n\nthen push', { terminal: true, restoreClipboard: false }), true);
  assert.deepEqual(inj.keys, ['paste:git status', 'shift-return', 'shift-return', 'paste:then push']);
  const plain = injector();
  await plain.injectText('a\nb', { restoreClipboard: false });
  assert.deepEqual(plain.keys, ['paste:a\nb']);
});

test('copying the selection uses Cmd+C and gives the clipboard back', async () => {
  const inj = injector({ selection: 'Selected words' });
  assert.equal(await inj.copySelection({ timeoutMs: 200 }), 'Selected words');
  assert.deepEqual(inj.keys, ['copy']);
  assert.equal(inj.board(), 'user clipboard');
  const none = injector();
  assert.equal(await none.copySelection({ timeoutMs: 120 }), '');
  assert.equal(none.board(), 'user clipboard');
});

test('undo: Cmd+Z then the exact words in text fields; backspaces in terminals', async () => {
  const field = injector();
  await field.undoPaste({ terminal: false, pasted: 'Ship it.', restore: 'um ship it', restoreClipboard: false });
  assert.deepEqual(field.keys, ['undo', 'paste:um ship it']);
  const term = injector();
  await term.undoPaste({ terminal: true, pasted: 'ls\n-la', restore: '', restoreClipboard: false });
  assert.deepEqual(term.keys, ['backspace:6']);
});
