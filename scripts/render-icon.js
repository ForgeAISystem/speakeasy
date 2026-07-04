'use strict';

// Renders the SpeakEasy app icon to build/icon.png (1024x1024).
// Run: npx electron scripts/render-icon.js
// electron-builder auto-converts build/icon.png to icns/ico at dist time.

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1024px;height:1024px;background:transparent}
  /* macOS Big Sur-style squircle with breathing room */
  #tile{
    position:absolute;left:88px;top:88px;width:848px;height:848px;
    border-radius:190px;
    background:linear-gradient(165deg,#33322f 0%,#1a1a1a 52%,#0e0e0e 100%);
    box-shadow:inset 0 6px 14px rgba(255,255,255,0.16),
               inset 0 -10px 24px rgba(0,0,0,0.5);
  }
  .bar{position:absolute;border-radius:44px;left:0;right:0}
  /* three waveform bars: cream, amber, cream */
  #b1{left:250px;width:88px;top:400px;height:224px;background:#ffffeb;opacity:.94}
  #b2{left:468px;width:88px;top:294px;height:436px;background:linear-gradient(180deg,#ffc37a,#ffa946)}
  #b3{left:686px;width:88px;top:438px;height:148px;background:#ffffeb;opacity:.94}
  .bar::after{content:'';position:absolute;inset:0;border-radius:44px;
    box-shadow:inset 0 4px 8px rgba(255,255,255,0.35)}
</style></head><body>
  <div id="tile"></div>
  <div class="bar" id="b1"></div>
  <div class="bar" id="b2"></div>
  <div class="bar" id="b3"></div>
</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 1024, height: 1024,
    transparent: true, frame: false,
    webPreferences: { offscreen: true }
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const out = path.join(__dirname, '..', 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log('wrote', out, img.getSize());
  app.quit();
});
