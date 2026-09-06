# Desktop usability verification

The current source is v2.4.1. Tests use simulated permissions and data. The user's actual v2.4.0 app was left running without UI control or replacement.

- tests.tap: 47 passing automated checks.
- visual-check.json and PNG files: 20 offscreen Electron screens, no horizontal overflow, final practice action reachable, reduced motion preserved.
- package-check.json: all 29 source files and the native helper match the app archive, version and installer hash verified.
- dmg-check.txt: successful disk-image checksum validation.
- running-app-untouched.json: a resource snapshot of the existing installed v2.4.0 process tree, with limitations. No before/after performance benchmark was performed.

Native title-bar dragging, monitor-to-monitor moves, resize handles, and installed placement persistence still require a manual check once the user chooses to restart.

Implementation references: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [window options](https://github.com/electron/electron/blob/main/docs/api/structures/base-window-options.md), and [app activation policy](https://www.electronjs.org/docs/latest/api/app#appsetactivationpolicypolicy-macos). The visual fixture uses an accessory app with a hidden, non-focusable offscreen renderer and a reduced frame rate. It never shows or focuses its window. The production main window uses native chrome and default background throttling. Hidden audio capture keeps its existing timing behavior.
