'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/main/commands');
const P = require('../src/shared/pad');

const apps = ['Claude', 'Google Chrome', 'Notes', 'Visual Studio Code', 'Slack', 'Terminal', 'QuickTime Player'];
function ctx() {
  const pads = P.defaultPads();
  pads['1'] = { type: 'layout', label: 'Build day', windows: [] };
  pads.V = { type: 'text', label: 'Morning prompt', text: 'You are my chief of staff.' };
  pads['4'] = { type: 'shortcut', name: 'Focus' };
  return { pads, apps };
}
const plan = (t) => JSON.parse(JSON.stringify(C.planLocally(t, ctx())));

test('wake words turn a normal dictation into a command, nothing else does', () => {
  assert.equal(C.wakeCommand('Hey computer, put Chrome on the left.'), 'put Chrome on the left.');
  assert.equal(C.wakeCommand('Hey SpeakEasy open Notes'), 'open Notes');
  assert.equal(C.wakeCommand('Speak easy, start recording'), 'start recording');
  assert.equal(C.wakeCommand('The computer is slow today'), null);
  assert.equal(C.wakeCommand('Hey, can you send the file'), null);
});

test('everyday requests plan offline, including borrowed verbs and pad names', () => {
  assert.deepEqual(plan('Put Chrome on the left and Claude on the right.'), [
    { do: 'snap', app: 'Google Chrome', region: 'left' }, { do: 'snap', app: 'Claude', region: 'right' }]);
  assert.deepEqual(plan('move this to the top right corner'), [{ do: 'snap', app: 'front', region: 'top-right' }]);
  assert.deepEqual(plan('maximize vs code'), [{ do: 'snap', app: 'Visual Studio Code', region: 'full' }]);
  assert.deepEqual(plan('open Slack, then go to command dot forgeaisystem dot com'), [
    { do: 'open_app', app: 'Slack' }, { do: 'open_url', url: 'https://command.forgeaisystem.com' }]);
  assert.deepEqual(plan('load build day'), [{ do: 'pad', key: '1' }]);
  assert.deepEqual(plan('hit pad four'), [{ do: 'pad', key: '4' }]);
  assert.deepEqual(plan('paste my morning prompt'), [{ do: 'pad', key: 'V' }]);
  assert.deepEqual(plan('type thanks and talk soon'), [{ do: 'paste', text: 'thanks and talk soon' }]);
  assert.deepEqual(plan('start recording'), [{ do: 'record' }]);
  assert.deepEqual(plan('turn the camera off'), [{ do: 'camera', on: false }]);
  assert.deepEqual(plan('press command shift 4'), [{ do: 'keys', keys: 'cmd+shift+4' }]);
  assert.deepEqual(plan('run the focus mode shortcut'), [{ do: 'shortcut', name: 'focus mode' }]);
  assert.equal(C.planLocally('put Photoshop on the left', ctx()), null);
  assert.equal(C.planLocally('delete all my files', ctx()), null);
});

test('teaching a pad by voice maps speech onto a pad action', () => {
  assert.deepEqual(plan('make pad 3 open command.forgeaisystem.com'), [{ do: 'teach', key: '3', action: { type: 'url', url: 'https://command.forgeaisystem.com' } }]);
  assert.deepEqual(plan('set pad V to paste hello there'), [{ do: 'teach', key: 'V', action: { type: 'text', text: 'hello there' } }]);
  assert.deepEqual(plan('make pad two open notes'), [{ do: 'teach', key: '2', action: { type: 'app', app: 'Notes' } }]);
  assert.deepEqual(plan('make pad R empty'), [{ do: 'teach', key: 'R', action: { type: 'none' } }]);
});

test('validation drops anything the pad cannot safely run', () => {
  const out = C.validate([
    { do: 'shell', cmd: 'rm -rf ~' },
    { do: 'open_url', url: 'javascript:alert(1)' },
    { do: 'open_url', url: 'file:///etc/passwd' },
    { do: 'open_app', app: 'Photoshop' },
    { do: 'snap', app: 'Chrome', region: 'sideways' },
    { do: 'pad', key: 'P' },
    { do: 'keys', keys: 'cmd+banana' },
    { do: 'teach', key: '3', action: { type: 'url', url: 'x-apple.systempreferences:com.apple.preference.security' } },
    { do: 'teach', key: '3', action: { type: 'shell' } },
    { do: 'snap', app: 'chrome', region: 'left' },
    { do: 'open_url', url: 'claude.ai' }
  ], ctx());
  assert.deepEqual(JSON.parse(JSON.stringify(out)), [{ do: 'snap', app: 'Google Chrome', region: 'left' }, { do: 'open_url', url: 'https://claude.ai' }]);
  assert.equal(C.validate(Array.from({ length: 20 }, () => ({ do: 'record' })), ctx()).length, 8);
});

test('typing, pasting and Shortcuts wait for Return; moving windows does not', () => {
  const { pads } = ctx();
  assert.equal(C.needsConfirm({ do: 'snap', app: 'front', region: 'left' }, pads), false);
  assert.equal(C.needsConfirm({ do: 'open_app', app: 'Notes' }, pads), false);
  assert.equal(C.needsConfirm({ do: 'paste', text: 'x' }, pads), true);
  assert.equal(C.needsConfirm({ do: 'keys', keys: 'cmd+q' }, pads), true);
  assert.equal(C.needsConfirm({ do: 'pad', key: 'V' }, pads), true);
  assert.equal(C.needsConfirm({ do: 'pad', key: '4' }, pads), true);
  assert.equal(C.needsConfirm({ do: 'pad', key: 'Q' }, pads), false);
  assert.equal(C.describe({ do: 'snap', app: 'Google Chrome', region: 'left' }, pads), 'Google Chrome to left half');
  assert.equal(C.describe({ do: 'pad', key: 'V' }, pads), 'Pad V: Morning prompt');
});

function fakeSdk(reply, seen) {
  return () => class {
    constructor(opts) { seen.opts = opts; this.messages = { create: async (req) => { seen.req = req; if (reply instanceof Error) throw reply; return reply; } }; }
  };
}

test('hard requests go to Claude as text with a forced tool, and its steps are checked', async () => {
  const seen = {};
  const reply = { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'run_steps', input: {
    reply: 'Chrome left, Claude right, notes on top.',
    steps: [{ do: 'snap', app: 'Google Chrome', region: 'left-two-thirds' }, { do: 'shell', cmd: 'curl evil' }, { do: 'snap', app: 'Claude', region: 'right-third' }] } }] };
  const cfg = { polishAnthropicKey: 'sk-test', polishAnthropicModel: 'claude-haiku-5-5' };
  const res = await C.plan('give me a writing setup with the browser big and Claude skinny on the side', ctx(), cfg, fakeSdk(reply, seen));
  assert.equal(res.via, 'claude');
  assert.deepEqual(res.steps.map((s) => s.region), ['left-two-thirds', 'right-third']);
  assert.equal(seen.opts.apiKey, 'sk-test');
  assert.deepEqual(seen.req.tool_choice, { type: 'tool', name: 'run_steps' });
  assert.deepEqual(seen.req.thinking, { type: 'disabled' });
  assert.equal(seen.req.model, 'claude-haiku-5-5');
  const sent = JSON.parse(seen.req.messages[0].content);
  assert.match(sent.request, /writing setup/);
  assert.equal(sent.pads.length, 16);
  assert.ok(!JSON.stringify(sent).includes('chief of staff'), 'prompt text stays on the Mac');
});

test('without a key, or when Claude fails, nothing runs and the reply says why', async () => {
  const none = await C.plan('give me a writing setup', ctx(), {});
  assert.equal(none.via, 'none');
  assert.equal(none.steps.length, 0);
  assert.match(none.reply, /put Chrome on the left/);
  const failed = await C.plan('give me a writing setup', ctx(), { polishAnthropicKey: 'sk' }, fakeSdk(new Error('timeout'), {}));
  assert.equal(failed.via, 'error');
  assert.equal(failed.steps.length, 0);
  const local = await C.plan('open notes', ctx(), { polishAnthropicKey: 'sk' }, () => { throw new Error('must not call Claude'); });
  assert.equal(local.via, 'local');
});

test('near misses come back as "Did you mean...?" with the words that work', async () => {
  const c = ctx();
  assert.deepEqual(C.suggest('Chrome left', c), { step: { do: 'snap', app: 'Google Chrome', region: 'left' }, say: 'put Chrome on the left' });
  assert.deepEqual(C.suggest('put crome on the right', c).step, { do: 'snap', app: 'Google Chrome', region: 'right' });
  assert.deepEqual(C.suggest('open slak', c).step, { do: 'open_app', app: 'Slack' });
  assert.deepEqual(C.suggest('lefty', c).step, { do: 'snap', app: 'front', region: 'left' });
  assert.equal(C.suggest('build day please', c).step.key, '1');
  assert.equal(C.suggest('what is the weather', c), null);
  assert.equal(C.suggest('email bob', c), null);
  // The suggested words plan offline.
  assert.ok(C.planLocally(C.suggest('Chrome left', c).say, c));
  const res = await C.plan('Chrome left', c, {});
  assert.equal(res.via, 'suggest');
  assert.equal(res.say, 'put Chrome on the left');
  assert.match(res.reply, /Next time say/);
  // Claude finds nothing: still offer the guess.
  const empty = { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'run_steps', input: { steps: [], reply: 'Not sure.' } }] };
  assert.equal((await C.plan('Chrome left', c, { polishAnthropicKey: 'sk' }, fakeSdk(empty, {}))).via, 'suggest');
});

test('"You can say" lines come from the owner\'s own pads and apps, and every one plans', () => {
  const c = ctx();
  c.pads['1'].windows = [{ app: 'Claude' }];
  c.pads['2'] = { type: 'app', app: 'Slack', label: 'Team chat' };
  const lines = C.examples({ ...c, frontApp: 'Notes' });
  assert.equal(lines[0], 'load Build day');
  assert.ok(lines.includes('put Notes on the left and Chrome on the right'));
  assert.ok(lines.includes('open Team chat'));
  assert.ok(lines.includes('paste Morning prompt'));
  for (const line of lines) assert.ok(C.planLocally(line, c), line);
  assert.ok(C.examples(c, 2).length === 2);
});

test('saving and restoring the screen by voice', () => {
  assert.deepEqual(plan('save this layout as morning'), [{ do: 'save_layout', name: 'Morning' }]);
  assert.deepEqual(plan('remember my setup as "Build day"'), [{ do: 'save_layout', name: 'Build day' }]);
  assert.deepEqual(plan('put my windows back'), [{ do: 'restore_windows' }]);
  assert.deepEqual(plan('restore everything'), [{ do: 'restore_windows' }]);
  assert.deepEqual(plan('put build day back'), [{ do: 'pad', key: '1' }]);
  assert.deepEqual(C.validate([{ do: 'save_layout', name: '' }, { do: 'save_layout', name: 'Evening' }, { do: 'restore_windows' }], ctx()),
    [{ do: 'save_layout', name: 'Evening' }, { do: 'restore_windows' }]);
  assert.equal(C.needsConfirm({ do: 'save_layout', name: 'x' }, ctx().pads), false);
  assert.equal(C.describe({ do: 'save_layout', name: 'Morning' }, ctx().pads), 'Save what is on screen as “Morning”');
});
