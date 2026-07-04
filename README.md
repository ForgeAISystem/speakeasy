# SpeakEasy

**Local voice dictation for Mac and Windows.** Hold a key, speak, release. Clean text lands wherever your cursor is, in any app.

Everything runs on your machine. No cloud. No account. No subscription. Your audio never leaves your computer.

## What it does

- **Hold-to-talk dictation** into any app: hold your dictation key (Right Option on Mac, Right Ctrl on Windows by default), speak, release. Text is pasted at your cursor.
- **Hands-free mode**: double-tap the dictation key to keep recording without holding. Tap again to stop. Esc cancels.
- **Flow bar**: a floating pill at the bottom of your screen shows a live waveform while listening, a "Computing" state while transcribing, and a word count when done. With start/stop sounds (toggleable).
- **Local AI models**: NVIDIA Parakeet (best accuracy), Moonshine (fastest), or Whisper (99 languages), all running offline via sherpa-onnx. Downloaded once, inside the app.
- **Cleanup**: filler words (um, uh) removed automatically.
- **Dictionary**: teach it your names, clients, and jargon, with optional "it hears X, write Y" corrections.
- **Snippets**: say "my calendar link", get the full URL. Voice-triggered text expansion.
- **History and stats**: every dictation stored locally; words today/week/all-time, speaking pace, time saved vs typing, daily streak.
- **Optional AI polish**: a second cleanup pass through a local LLM (Ollama) or the Claude API. Off by default. Rule-based cleanup needs no LLM at all.
- **Paste last transcript**: Cmd+Ctrl+V (Mac) / Shift+Alt+Z (Windows) re-pastes your most recent dictation.

## Install (from source)

Requires [Node.js 20+](https://nodejs.org).

```bash
git clone <this-repo>
cd speakeasy
npm install
npm start
```

First launch walks you through permissions and downloads a model (240 MB fast start or 460 MB best accuracy). Then you're dictating.

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
npm run dist:mac   # .dmg (Apple Silicon + Intel)
npm run dist:win   # .exe installer
```

Output lands in `dist/`.

## Architecture

```
src/
├── main/            Electron main process
│   ├── index.js     App lifecycle, windows, dictation state machine, IPC
│   ├── hotkey.js    Global hold/double-tap key handling (uiohook-napi)
│   ├── injector.js  Clipboard write -> simulated paste -> clipboard restore
│   ├── transcriber.js  Manages the transcription worker process
│   ├── models.js    Model catalog, download, extract
│   ├── cleanup.js   Fillers, dictionary, snippets, optional LLM polish
│   ├── store.js     Settings / history / stats / dictionary (local JSON)
│   └── tray.js      Menu bar / system tray icon and states
├── worker/          Forked process running sherpa-onnx (keeps the UI smooth)
├── capture/         Hidden window: 16 kHz mono mic capture via AudioWorklet
├── overlay/         The floating flow bar (waveform, computing, done)
└── app/             Dashboard UI: Home, History, Dictionary, Snippets, Settings
```

Speech models: [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) running Whisper, [Moonshine](https://github.com/moonshine-ai/moonshine), and [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2). Models are stored in the app's user-data folder after a one-time download.

## Privacy

- Audio is processed in memory and never written to disk or sent anywhere.
- Transcripts, settings, and stats live in local JSON files under your user-data directory.
- The only optional network calls: model downloads (GitHub), and AI polish if you explicitly enable Ollama (localhost) or the Claude API (text only, never audio).

## License

MIT
