// Actual Electron rendering with synthetic state. No OS permissions or user data.
// Run: env -u ELECTRON_RUN_AS_NODE npx electron scripts/visual-check.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const out = path.join(root, 'docs/verification', `v${version}`);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.setPath('userData', path.join(app.getPath('temp'), `speakeasy-visual-${version}`));
app.on('window-all-closed', () => {}); // move between fixtures without quitting
app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.setActivationPolicy('accessory');
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width: 980, height: 680, show: false, focusable: false, skipTaskbar: true, frame: false, backgroundColor: '#f8f8f2',
    webPreferences: { preload: path.join(root, 'tests/visual-preload.cjs'), sandbox: false, offscreen: true } });
  win.webContents.setFrameRate(15);
  const errors = [];
  win.webContents.on('console-message', (_e, details) => { if (details.level === 'error') errors.push(details.message); });
  await win.loadFile(path.join(root, 'src/app/index.html'));
  const run = (code) => win.webContents.executeJavaScript(code);
  await run('document.fonts.ready');
  await run('Promise.all([...document.images].map(i => i.decode()))');
  const checks = [];
  async function capture(name, code, width = 980, height = 680) {
    win.setSize(width, height);
    await run(code);
    await delay(500);
    const check = await run(`({
      loadedArtwork: [...document.images].filter(i => i.closest('.active, .visible')).every(i => i.complete && i.naturalWidth > 0),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      contentOverflow: document.querySelector('#content').scrollWidth > document.querySelector('#content').clientWidth,
      setupOverflow: document.querySelector('#onboard').scrollWidth > document.querySelector('#onboard').clientWidth,
      width: innerWidth, height: innerHeight
    })`);
    checks.push({ screen: name, ...check });
    fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  await capture('home', 'void 0');
  await capture('home-compact', 'void 0', 760, 560);
  await capture('connection-check', "document.querySelector('#runtime-check').open = true");
  await capture('connection-check-small', 'void 0', 560, 450);
  await run("document.querySelector('#runtime-check').open = false; runtimeOpen = false");
  await capture('history', "switchTab('history').then(() => { document.querySelector('#tab-history .history-original').open = true; })");
  await capture('settings', "switchTab('settings')");
  await capture('settings-edit-by-voice', "switchTab('settings').then(() => document.querySelector('#edit-group').scrollIntoView())");
  await capture('settings-edit-by-voice-small', "switchTab('settings').then(() => document.querySelector('#edit-group').scrollIntoView())", 560, 450);
  await capture('learn', "switchTab('learn')", 980, 760);
  await capture('whats-new', "switchTab('home').then(() => window.speakeasy.guideSummary()).then((s) => window.SpeakEasyLearn.whatsNew({ ...s, fresh: ['pad-coach', 'say-it-your-way', 'voice-edit'] }))", 980, 760);
  await run("window.SpeakEasyLearn.whatsNew({ guides: [], fresh: [], version: '' })");
  await capture('pad', "switchTab('pad').then(() => document.querySelector('#pad-grid .pad-tile[data-key=\"1\"]').click())", 980, 760);
  await capture('pad-cheat-sheet', "document.querySelector('#cheat').scrollIntoView()", 980, 760);
  await capture('snippets', "switchTab('snippets')");
  await capture('dictionary', "switchTab('dictionary')");
  await capture('settings-advanced', "switchTab('settings').then(() => { document.querySelector('.advanced-settings').open = true; })");
  await capture('welcome', 'setup.open()');
  await capture('welcome-compact', 'void 0', 760, 560);
  await capture('permissions', 'setup.go(1)');
  await capture('shortcut', 'setup.go(3)');
  // The minimum native window is 560x480. Reserve space for its title bar.
  for (const tab of ['home', 'history', 'dictionary', 'snippets', 'pad', 'learn', 'settings']) {
    await capture(`${tab}-small`, `setup.close(); switchTab('${tab}')`, 560, 450);
  }
  await capture('settings-advanced-small', "document.querySelector('.advanced-settings').open = true", 560, 450);
  await capture('welcome-small', 'setup.open()', 560, 450);
  for (const [step, name] of [[1, 'permissions'], [2, 'voice'], [3, 'shortcut'], [4, 'practice']]) {
    await capture(`${name}-small`, `setup.go(${step})`, 560, 450);
  }
  // Verify taller scrolling views can reveal their final action at this size.
  await run("document.querySelector('#onboard').scrollTop = document.querySelector('#onboard').scrollHeight");
  const practiceEndVisible = await run("(() => { const r = document.querySelector('[data-setup=finish]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()");
  await run("window.SpeakEasyMotion.setEnabled(false)");
  const reduced = await run("getComputedStyle(document.querySelector('.setup-panel')).animationName");
  const overflow = checks.filter((c) => c.horizontalOverflow || c.contentOverflow || c.setupOverflow);
  fs.writeFileSync(path.join(out, 'visual-check.json'), JSON.stringify({ fixture: 'Offscreen Electron with synthetic state. No live app interaction, microphone, permission, or physical monitor test.', checks, practiceEndVisible, reducedMotionAnimation: reduced, errors }, null, 2) + '\n');
  let failed = errors.length || overflow.length || reduced !== 'none' || !practiceEndVisible;
  console.log(JSON.stringify({ screenshots: checks.length, errors, overflow, practiceEndVisible, reducedMotionAnimation: reduced }));
  win.destroy();
  const bar = new BrowserWindow({ width: 340, height: 110, show: false, frame: false, focusable: false, skipTaskbar: true,
    webPreferences: { preload: path.join(root, 'tests/overlay-visual-preload.cjs'), offscreen: true } });
  bar.webContents.setFrameRate(15);
  await bar.loadFile(path.join(root, 'src/overlay/overlay.html'));
  const overlays = [];
  for (const phase of ['listening', 'armed', 'processing', 'preview', 'error', 'rewrite-armed', 'rewriting', 'rewrite']) {
    await bar.webContents.executeJavaScript(`window.overlayFixture.show('${phase}')`);
    await delay(250);
    const check = await bar.webContents.executeJavaScript(`(() => { const r = document.querySelector('#pill').getBoundingClientRect(); return { label: document.querySelector('#label').textContent, visible: getComputedStyle(document.querySelector('#pill')).opacity === '1', fits: r.right <= innerWidth && r.left >= 0 && r.top >= 0 }; })()`);
    overlays.push({ phase, ...check });
    fs.writeFileSync(path.join(out, 'indicator-' + phase + '.png'), (await bar.webContents.capturePage()).toPNG());
  }
  fs.writeFileSync(path.join(out, 'indicator-check.json'), JSON.stringify(overlays, null, 2) + '\n');
  if (overlays.some((item) => !item.visible || !item.fits)) failed = true;
  console.log(JSON.stringify({ indicatorScreens: overlays.length, passed: !failed }));
  bar.destroy();
  // The floating Control Pad with several pad types on it, after a live hit.
  const pad = new BrowserWindow({ width: 452, height: 576, show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true,
    webPreferences: { preload: path.join(root, 'src/pad/preload.js'), offscreen: true } });
  pad.webContents.setFrameRate(15);
  await pad.loadFile(path.join(root, 'src/pad/pad.html'));
  const P = require('../src/shared/pad');
  const pads = P.defaultPads();
  pads['1'] = { type: 'layout', label: 'Build day', windows: [{ app: 'Claude' }, { app: 'Chrome' }] };
  pads['2'] = { type: 'app', app: 'Google Chrome' };
  pads.V = { type: 'text', label: 'Morning prompt', text: 'x' };
  const C = require('../src/main/commands');
  const examples = C.examples({ pads, apps: ['Claude', 'Google Chrome', 'Notes'], frontApp: 'Google Chrome' });
  pad.webContents.send('pad:show', { pads, target: 'Google Chrome', examples, locks: {} });
  await delay(300);
  pad.webContents.send('pad:result', { key: 'A', ok: true, message: 'Google Chrome > Left half' });
  await delay(150);
  const padCheck = await pad.webContents.executeJavaScript(`({ tiles: document.querySelectorAll('.pad-tile').length, fits: document.querySelector('#pad').scrollHeight <= document.querySelector('#pad').clientHeight + 1, status: document.querySelector('#status').textContent })`);
  fs.writeFileSync(path.join(out, 'control-pad.png'), (await pad.webContents.capturePage()).toPNG());
  pad.webContents.send('pad:plan', { heard: 'Put Chrome on the left, Claude on the right, then paste my morning prompt', via: 'local', reply: '', confirm: true,
    steps: [{ text: 'Google Chrome to left half', confirm: false }, { text: 'Claude to right half', confirm: false }, { text: 'Pad V: Morning prompt', confirm: true }] });
  await delay(200);
  padCheck.planFits = await pad.webContents.executeJavaScript(`(() => { const p = document.querySelector('#plan'); return !p.hidden && p.scrollHeight <= p.clientHeight + 1; })()`);
  fs.writeFileSync(path.join(out, 'control-pad-plan.png'), (await pad.webContents.capturePage()).toPNG());
  const padFits = () => pad.webContents.executeJavaScript(`(() => { const p = document.querySelector('#pad'); const tiles = [...document.querySelectorAll('.pad-tile')];
    return p.scrollHeight <= p.clientHeight + 1 && tiles.every((t) => t.scrollHeight <= t.clientHeight + 1); })()`);
  // Hold-to-peek: every key with its name and words.
  pad.webContents.send('pad:show', { pads, target: 'Google Chrome', examples, locks: {} });
  await delay(200);
  pad.webContents.send('pad:peek', { on: true });
  await delay(250);
  padCheck.peek = await pad.webContents.executeJavaScript(`({ words: [...document.querySelectorAll('.pad-say')].filter((e) => getComputedStyle(e).display !== 'none').length,
    sayHidden: getComputedStyle(document.querySelector('#say')).display === 'none' })`);
  padCheck.peekFits = await padFits();
  fs.writeFileSync(path.join(out, 'control-pad-peek.png'), (await pad.webContents.capturePage()).toPNG());
  // First open of a new pad: the question, then the four-key starter pad.
  const fresh = P.defaultPads();
  pad.webContents.send('pad:show', { pads: fresh, target: 'Google Chrome', examples: examples.slice(1), locks: {}, ask: true });
  await delay(300);
  padCheck.askFits = await pad.webContents.executeJavaScript(`(() => { const a = document.querySelector('#ask'); return !a.hidden && a.scrollHeight <= a.clientHeight + 1; })()`);
  fs.writeFileSync(path.join(out, 'control-pad-starter-ask.png'), (await pad.webContents.capturePage()).toPNG());
  const locks = require('../src/main/pad-coach').locks({ goal: 'windows' }, {});
  pad.webContents.send('pad:show', { pads: fresh, target: 'Google Chrome', examples: examples.slice(1), locks });
  await delay(300);
  padCheck.locked = await pad.webContents.executeJavaScript(`document.querySelectorAll('.pad-tile.locked').length`);
  padCheck.lockedFits = await padFits();
  padCheck.sayFits = await pad.webContents.executeJavaScript(`[...document.querySelectorAll('.say-line')].every((l) => l.getBoundingClientRect().bottom <= document.querySelector('#say').getBoundingClientRect().bottom + 0.5)`);
  fs.writeFileSync(path.join(out, 'control-pad-starter.png'), (await pad.webContents.capturePage()).toPNG());
  pad.webContents.send('pad:peek', { on: true });
  await delay(250);
  padCheck.lockedPeekFits = await padFits();
  fs.writeFileSync(path.join(out, 'control-pad-starter-peek.png'), (await pad.webContents.capturePage()).toPNG());
  // "Did you mean...?" and the monitor offer.
  const guess = await C.plan('Chrome left', { pads, apps: ['Claude', 'Google Chrome', 'Notes'] }, {});
  pad.webContents.send('pad:plan', { heard: guess.heard, via: guess.via, reply: guess.reply, confirm: true, steps: guess.steps.map((st) => ({ text: C.describe(st, pads), confirm: true })) });
  await delay(200);
  padCheck.guess = await pad.webContents.executeJavaScript(`({ eyebrow: document.querySelector('#plan-eyebrow').textContent, reply: document.querySelector('#plan-reply').textContent })`);
  fs.writeFileSync(path.join(out, 'control-pad-did-you-mean.png'), (await pad.webContents.capturePage()).toPNG());
  pad.webContents.send('pad:plan', { heard: '', title: 'Your screen is back. Put your windows back?', via: 'monitor', reply: '', confirm: true, steps: [{ text: 'Put 6 windows back where they were', confirm: true }] });
  await delay(200);
  padCheck.monitorHeard = await pad.webContents.executeJavaScript(`document.querySelector('#plan-heard').textContent`);
  fs.writeFileSync(path.join(out, 'control-pad-monitor-back.png'), (await pad.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({ controlPad: padCheck }));
  pad.webContents.send('pad:results', { query: 'the Legacy invoices', selected: 0, items: [
    { snippet: 'The Legacy invoice for October is still open. Bryan posts it Monday, then we chase the two DSD stores that are late.', app: 'Slack', ts: Date.now() - 3600000 },
    { snippet: 'Send Legacy their invoices before the Thursday call.', app: 'Mail', ts: Date.now() - 3 * 86400000 },
    { snippet: '...and the Legacy invoices need the new terms line before they go out...', app: 'Notes', ts: Date.now() - 12 * 86400000 }] });
  await delay(200);
  pad.webContents.send('pad:select', { selected: 1 });
  await delay(150);
  padCheck.resultsFit = await pad.webContents.executeJavaScript(`(() => { const p = document.querySelector('#results'); return !p.hidden && p.scrollHeight <= p.clientHeight + 1 && document.querySelectorAll('#result-list li.selected').length === 1; })()`);
  fs.writeFileSync(path.join(out, 'control-pad-history.png'), (await pad.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({ controlPadResults: padCheck.resultsFit }));
  if (padCheck.tiles !== 16 || !padCheck.fits || !padCheck.planFits || padCheck.peek.words !== 16 || !padCheck.peekFits || !padCheck.askFits ||
    padCheck.locked !== 12 || !padCheck.lockedFits || !padCheck.sayFits || !padCheck.lockedPeekFits || !/DID YOU MEAN/.test(padCheck.guess.eyebrow) || !/screen is back/.test(padCheck.monitorHeard) || !padCheck.resultsFit) failed = true;
  pad.destroy();
  // The faster-way tip.
  const tipWin = new BrowserWindow({ width: 560, height: 64, show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true,
    webPreferences: { preload: path.join(root, 'src/pad/preload.js'), offscreen: true } });
  tipWin.webContents.setFrameRate(15);
  await tipWin.loadFile(path.join(root, 'src/pad/tip.html'));
  const tip = require('../src/main/pad-coach').tipFor({ region: 'left', app: 'Google Chrome' }, { pads: P.defaultPads(), opener: 'tap the mic key' });
  tipWin.webContents.send('tip:show', tip);
  await delay(300);
  const tipCheck = await tipWin.webContents.executeJavaScript(`(() => { const t = document.querySelector('#tip'); return { text: t.textContent, fits: t.scrollHeight <= t.clientHeight + 1 && t.getBoundingClientRect().top >= 0 }; })()`);
  fs.writeFileSync(path.join(out, 'tip.png'), (await tipWin.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({ tip: tipCheck }));
  if (!tipCheck.fits) failed = true;
  tipWin.destroy();
  // The coach: waiting on a step, a step just done, a challenge, a challenge result.
  const coach = new BrowserWindow({ width: 380, height: 300, show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true,
    webPreferences: { preload: path.join(root, 'src/coach/preload.js'), offscreen: true } });
  coach.webContents.setFrameRate(15);
  await coach.loadFile(path.join(root, 'src/coach/coach.html'));
  const { GuideRunner } = require('../src/main/guide');
  let views = [];
  let clockNow = Date.now();
  const runner = new GuideRunner({ store: { guide: () => ({}), saveGuide() {} }, onState: (v) => views.push(v), now: () => clockNow, timers: { setTimeout: () => 0, clearTimeout() {} } });
  await runner.start('control-pad');
  runner.next();
  const coachShots = [['coach-step', runner.view()]];
  runner.onEvent({ type: 'pad-open' });
  coachShots.push(['coach-done', runner.view()]);
  await runner.start('control-pad', 'challenge');
  runner.onEvent({ type: 'pad', key: '1', ok: true });
  runner.onEvent({ type: 'camera', on: true });
  coachShots.push(['coach-challenge', runner.view()]);
  runner.onEvent({ type: 'pad', key: 'E', ok: true });
  clockNow += 84000;
  runner.onEvent({ type: 'pad', key: 'V', ok: true });
  coachShots.push(['coach-result', runner.view()]);
  await runner.start('voice-edit');
  runner.next(); runner.next();
  coachShots.push(['coach-voice-edit', runner.view()]);
  await runner.start('voice-edit', 'challenge');
  runner.onEvent({ type: 'dictation', phase: 'done', terminal: true });
  runner.onEvent({ type: 'rewrite', ok: true, via: 'shift' });
  coachShots.push(['coach-voice-edit-challenge', runner.view()]);
  const coachChecks = [];
  for (const [name, view] of coachShots) {
    coach.webContents.send('coach:state', view);
    await delay(250);
    coachChecks.push({ name, ...(await coach.webContents.executeJavaScript(`(() => { const c = document.querySelector('#card'); return { fits: c.scrollHeight <= c.clientHeight + 1, text: c.textContent.slice(0, 60) }; })()`)) });
    fs.writeFileSync(path.join(out, name + '.png'), (await coach.webContents.capturePage()).toPNG());
  }
  console.log(JSON.stringify({ coach: coachChecks }));
  if (coachChecks.some((c) => !c.fits)) failed = true;
  coach.destroy();
  app.exit(failed ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
