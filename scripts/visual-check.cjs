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
  await capture('history', "switchTab('history').then(() => { document.querySelector('#tab-history .history-original').open = true; })");
  await capture('settings', "switchTab('settings')");
  await capture('snippets', "switchTab('snippets')");
  await capture('welcome', 'setup.open()');
  await capture('welcome-compact', 'void 0', 760, 560);
  await capture('permissions', 'setup.go(1)');
  await capture('shortcut', 'setup.go(3)');
  // The minimum native window is 560x480. Reserve space for its title bar.
  for (const tab of ['home', 'history', 'dictionary', 'snippets', 'settings']) {
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
  const failed = errors.length || overflow.length || reduced !== 'none' || !practiceEndVisible;
  console.log(JSON.stringify({ screenshots: checks.length, errors, overflow, practiceEndVisible, reducedMotionAnimation: reduced }));
  win.destroy();
  app.exit(failed ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
