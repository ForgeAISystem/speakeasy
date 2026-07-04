'use strict';

const { Tray, Menu, nativeImage } = require('electron');

// Embedded 22x22 waveform glyph so the tray exists even if the icon-drawing
// renderer never comes up. Without a tray, a hidden main window on Windows
// would leave the app running with no way to reopen or quit it.
const FALLBACK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAOElEQVR4nGO4siKcgRaYJoYOGoP/I+FRgykzGJcBdDcYq/iowaMG08ZgotMxLjxqMO0NJgnTzGAANXDVt7ltt8MAAAAASUVORK5CYII=';

class TrayController {
  constructor({ onOpen, onQuit }) {
    this.tray = null;
    this.icons = {}; // state -> nativeImage
    this.statusLabel = 'Starting...';
    this.onOpen = onOpen;
    this.onQuit = onQuit;
  }

  /** Create the tray immediately with the embedded icon. Call at startup. */
  ensureTray() {
    if (this.tray) return;
    const img = nativeImage.createFromDataURL(FALLBACK_ICON).resize({ width: 22, height: 22 });
    this.icons.idle = this.icons.idle || img;
    this.tray = new Tray(img);
    this.tray.setToolTip('SpeakEasy');
    this._menu();
    this.tray.on('click', () => {
      if (process.platform !== 'darwin') this.onOpen();
    });
  }

  init(iconDataUrls) {
    for (const [k, dataUrl] of Object.entries(iconDataUrls)) {
      const img = nativeImage.createFromDataURL(dataUrl).resize({ width: 22, height: 22 });
      if (process.platform === 'darwin' && k === 'idle') img.setTemplateImage(true);
      this.icons[k] = img;
    }
    this.ensureTray();
    if (this.icons.idle) this.tray.setImage(this.icons.idle);
  }

  _menu() {
    const menu = Menu.buildFromTemplate([
      { label: `Status: ${this.statusLabel}`, enabled: false, id: 'status' },
      { type: 'separator' },
      { label: 'Open SpeakEasy', click: () => this.onOpen() },
      { type: 'separator' },
      { label: 'Quit SpeakEasy', click: () => this.onQuit() }
    ]);
    this.tray.setContextMenu(menu);
  }

  setState(state, statusLabel) {
    if (!this.tray) return;
    this.statusLabel = statusLabel || state;
    const icon = this.icons[state] || this.icons.idle;
    if (icon) this.tray.setImage(icon);
    this._menu();
  }
}

module.exports = { TrayController };
