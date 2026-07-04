'use strict';

const { Tray, Menu, nativeImage } = require('electron');

class TrayController {
  constructor({ onOpen, onQuit }) {
    this.tray = null;
    this.icons = {}; // state -> nativeImage
    this.statusLabel = 'Starting...';
    this.onOpen = onOpen;
    this.onQuit = onQuit;
  }

  init(iconDataUrls) {
    for (const [k, dataUrl] of Object.entries(iconDataUrls)) {
      const img = nativeImage.createFromDataURL(dataUrl).resize({ width: 22, height: 22 });
      if (process.platform === 'darwin' && k === 'idle') img.setTemplateImage(true);
      this.icons[k] = img;
    }
    if (!this.tray) {
      this.tray = new Tray(this.icons.idle);
      this.tray.setToolTip('SpeakEasy');
      this._menu();
      this.tray.on('click', () => {
        if (process.platform !== 'darwin') this.onOpen();
      });
    }
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
