// Actual Electron rendering with synthetic state. No OS permissions or user data.
// Run: env -u ELECTRON_RUN_AS_NODE npx electron scripts/visual-check.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/verification/v2.4');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.setPath('userData', path.join(app.getPath('temp'), 'speakeasy-visual-v24'));
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width: 980, height: 680, show: false, frame: false, backgroundColor: '#f8f8f2',
    webPreferences: { preload: path.join(root, 'tests/visual-preload.cjs'), sandbox: false } });
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
  await run("window.SpeakEasyMotion.setEnabled(false)");
  const reduced = await run("getComputedStyle(document.querySelector('.setup-panel')).animationName");
  fs.writeFileSync(path.join(out, 'visual-check.json'), JSON.stringify({ fixture: 'Synthetic state rendered through the real Electron UI. Not live microphone or permissions evidence.', checks, reducedMotionAnimation: reduced, errors }, null, 2) + '\n');
  if (errors.length || checks.some((c) => !c.loadedArtwork || c.horizontalOverflow || c.contentOverflow) || reduced !== 'none') process.exitCode = 1;
  console.log(JSON.stringify({ screenshots: checks.length, errors, overflow: checks.filter((c) => c.horizontalOverflow || c.contentOverflow), reducedMotionAnimation: reduced }));
  win.destroy();
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
