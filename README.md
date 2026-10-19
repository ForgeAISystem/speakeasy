# SpeakEasy

**Local voice dictation for Mac and Windows.** Hold a key, speak, release. Clean text lands wherever your cursor is, in any app.

Speech recognition runs on your machine. No account or subscription is required. Audio stays local. Optional cloud text cleanup is off by default.

## What it does

- **Hold-to-talk dictation** into any app: hold your dictation key (Fn / Globe on Mac, Right Ctrl on Windows by default), speak, release. Text is pasted at your cursor.
- **Hands-free mode**: double-tap the dictation key to keep recording without holding. Tap again to stop. Esc cancels.
- **Flow bar**: a floating pill at the bottom of your screen shows a live waveform while listening, real transcription and optional polish states, and a word count when done. With start/stop sounds (toggleable).
- **Local AI models**: NVIDIA Parakeet (recommended for English), Moonshine (lightest), or Whisper (99 languages), all running offline via sherpa-onnx. Downloaded once, inside the app.
- **Fast on long thoughts**: long dictations are transcribed while you keep talking, so text lands seconds after you let go.
- **Cleanup choices**: Original keeps recognized text unchanged. Clean removes fillers and verbal tics ("um", "you know", stutters), applies dictionary/snippets, and understands spoken "question mark", "exclamation point", "new line", "new paragraph", and "scratch that", all locally. Polished adds a configured AI provider that also gets the receiving app's style.
- **Fits the app**: chat apps get a lone sentence without a final period; Polished writes emails, chats, AI prompts, and code differently.
- **Dictionary**: add or edit names, clients, and jargon, with optional "it hears X, write Y" corrections and duplicate checks. A saved "Bella Vita" also fixes "bellavita". Coming from Wispr Flow? Import its words and snippets in one click.
- **Snippets**: say "my calendar link", get the full URL. Create and edit multiline signatures or reusable text.
- **History**: local search across final and original text, date groups, attention filters, original comparison, and copy. Cmd/Ctrl+F finds your words. Home shows today’s words, estimated time saved, and total dictations.
- **Optional AI polish**: a second cleanup pass through a local LLM (Ollama) or the Claude API (Claude Haiku 5.5). Off by default. Rule-based cleanup needs no LLM at all.
- **Mute while dictating**: optional; silences music and video while you speak.
- **Paste last transcript**: Cmd+Ctrl+V (Mac) / Shift+Alt+Z (Windows) re-pastes your most recent dictation.
- **A flexible desktop window**: native dragging, minimize/full-screen controls, compact layouts down to 560x480, and remembered size/screen position. Reopening restores a minimized window; disconnected screens recover onto an available display.
- **Control Pad (Mac)**: your keyboard becomes a drum pad. Tap the microphone key (F5 on newer MacBooks) or Control+Option+P, then hit a key. Q/W/E, A/S/D, Z/X/C snap the window you were using to the matching part of the screen (hit it twice to jump screens). 1-4 bring back whole workflow layouts (Shift+key saves your current windows). R opens the screen recorder with a round camera bubble, F toggles the camera, V pastes a starter prompt. Every pad can be remapped in the Pad tab to open an app, a link, a Shortcut, a key combo, or saved text, and the tab lights up live as you hit pads.
- **Voice commands**: open the pad and hold fn, or start any dictation with "Hey computer", then say it: "put Chrome on the left and Claude on the right", "load build day", "paste my morning prompt", "start recording", "make pad 3 open claude.ai". Everyday requests are understood on your Mac; bigger ones go to Claude as text when you have added a key. The plan shows on the pad first, and typing, pasting and Shortcuts wait for Return.
- **No emoji picker on fn**: one click sets macOS "Press Globe key to" to Do Nothing so tapping fn only dictates. Undo restores your old setting.
- **Dictation checks and recovery**: Home's Check dictation shows permissions, shortcut detection, voice, microphone connection, and indicator readiness. Test indicator previews the bar without recording; Repair connection rechecks failed components while idle. Received audio from an interrupted recording stays recoverable in History.

The interface uses original ImageGen glass artwork with subtle pointer depth. System reduced motion and the Subtle motion setting disable these effects. [Wispr Flow teardown and v2.5 measurements](docs/WISPR-TEARDOWN-2026-10-12.md) · [Earlier research](docs/COMPETITOR-RESEARCH-2026-09-06.md) · [Artwork and prompt](docs/IMAGEGEN.md)

## Install

**With Claude (or any coding agent):** give it this one line.

> Install the latest SpeakEasy on this Mac from github.com/ForgeAISystem/speakeasy. Follow INSTALL.md in that repo.

[INSTALL.md](INSTALL.md) walks the agent through checking the computer, building from `main`, installing or updating without losing your data, and what you click yourself. Updating is the same command.

**By hand:** you do not need Node.js, a terminal, or an AI agent to use the app. Download the installer from [Releases](https://github.com/ForgeAISystem/speakeasy/releases).

When updating an existing installation, quit SpeakEasy before replacing the app, then reopen it once.

- **Mac:** open the DMG, then open SpeakEasy. Choose **Install in Applications**, or drag the app into the Applications shortcut. macOS permissions are requested after installation.
- **Windows:** run the setup EXE. The existing one-click installer creates the shortcut and launches SpeakEasy.

The first-run guide walks through four steps:

1. Allow microphone and Accessibility access, with live status checks.
2. Prepare an English or multilingual offline voice pack.
3. Press and release your shortcut. Mac users can choose Fn / Globe or Right Option.
4. Dictate a real sentence into the practice box. Setup finishes only after the words land there.

Close the window to keep SpeakEasy running in the menu bar or tray. Quit from its menu when you want to stop it entirely.

**Version:** 2.5.0 on `main`, with installers under [Releases](https://github.com/ForgeAISystem/speakeasy/releases). The repository is private: access comes from the maintainer.

**Signing:** the current local installer is unsigned and not notarized. macOS may block a downloaded copy. A normal warning-free distribution requires a Developer ID Application certificate and Apple notarization. See [HANDOFF.md](HANDOFF.md). Do not disable Gatekeeper to install it.

### Run from source (development only)

```bash
npm ci
npm start
```

On macOS, `npm start` compiles the small native Fn listener with Xcode Command Line Tools. End users receive that listener inside the installer and need no developer tools. In an Electron-hosted shell, use `env -u ELECTRON_RUN_AS_NODE npm start`.

### macOS permissions

macOS will ask for:
1. **Microphone**, to hear you.
2. **Accessibility**, to paste text into other apps (System Settings → Privacy & Security → Accessibility).
3. **Input Monitoring**, for the global hotkey (System Settings → Privacy & Security → Input Monitoring).

In dev mode (`npm start`) grant these to your terminal or to Electron. In the packaged app, grant them to SpeakEasy.

### Windows

Microphone permission is requested on first recording. No other permissions needed.

## Build installers

```bash
npm test
npm run dist:mac   # .dmg for the current architecture
npm run dist:win   # one-click .exe installer with desktop shortcut
```

Output lands in `dist/`. Tag-triggered GitHub Actions runs the tests, builds the native helper, and creates Mac and Windows installers. Intel Mac builds remain best effort. Publishing a tag creates a release; local builds use `--publish never` for review.

## Architecture

```
src/
├── main/            Electron main process
│   ├── index.js     App lifecycle, windows, dictation state machine, IPC
│   ├── hotkey.js    Fn native helper on Mac; uiohook for other keys
│   ├── injector.js  Clipboard write -> simulated paste -> clipboard restore
│   ├── transcriber.js  Manages the transcription worker process
│   ├── models.js    Model catalog, download, extract
│   ├── cleanup.js   Tics, spoken commands, dictionary, snippets, app style, optional LLM polish
│   ├── wispr-import.js  Read-only import of a local Wispr Flow dictionary
│   ├── system-audio.js  Optional mute while dictating
│   ├── store.js     Settings / history / stats / dictionary (local JSON)
│   └── tray.js      Menu bar / system tray icon and states
├── worker/          Forked process running sherpa-onnx (keeps the UI smooth)
├── shared/          Constants, cleanup modes, quiet-point search for segmenting speech
├── capture/         Hidden window: 16 kHz mono mic capture via AudioWorklet
├── overlay/         The floating flow bar (waveform, computing, done)
├── pad/             The floating Control Pad and the camera bubble
└── app/             Dashboard UI: Home, History, Dictionary, Snippets, Pad, Settings
native/              fn-key.c (Fn, Esc, mic key listener) and window.c (read and place app windows)
```

Speech models: [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) running Whisper, [Moonshine](https://github.com/moonshine-ai/moonshine), and [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2). Models are stored in the app's user-data folder after a one-time download.

## Privacy

- Before transcription, a local WAV safety copy is saved. Successful dictations delete it. Failed or interrupted dictations can be retried from History; leftover audio is pruned after 14 days.
- Transcripts, settings, and stats live in local JSON files under your user-data directory.
- The only optional network calls: model downloads (GitHub), and AI polish if you explicitly enable Ollama (localhost) or the Claude API. Claude receives the transcript text, the receiving app's name, and your dictionary words. Never audio, and never the window title (it picks a style on your computer only).
- Voice commands are planned on your Mac. Only when a request is beyond the built-in rules and you have added a Claude key, SpeakEasy sends Claude the request text, your pad names and types, and your app names. Never audio, prompt text, or window titles.
- Wispr Flow import reads Wispr's local database read-only, only when you open the Dictionary tab or press Import.

## License

MIT
