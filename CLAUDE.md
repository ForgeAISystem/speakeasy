# SpeakEasy — agent runbook

Read this first. It contains everything an AI agent needs to set up, run, build, and ship this app without exploration.

**What this is:** local voice dictation for Mac and Windows (a Wispr Flow replacement). Hold a key, speak, release; text pastes at the cursor. 100% offline: Electron + sherpa-onnx (Moonshine / Parakeet / Whisper models). Built by The Forge.

## Set up and run from source

```bash
npm install     # pulls Electron + prebuilt native deps (no compilers needed)
npm start       # launches the app; onboarding handles permissions + model download
```

- Running from inside Claude Code / an Electron-hosted shell? That environment exports `ELECTRON_RUN_AS_NODE`, which breaks `npm start`. Use: `env -u ELECTRON_RUN_AS_NODE npm start`.
- First launch walks the user through: name, mic + Accessibility permissions (macOS also prompts Input Monitoring for the hotkey), model download (Moonshine 240 MB fast / Parakeet 460 MB accurate), live test box.
- Models land in the user-data dir (`~/Library/Application Support/SpeakEasy/models` on mac). Settings/history/dictionary/snippets are JSON files next to it.

## Build installers

```bash
npm run dist:mac    # dist/SpeakEasy-<ver>-arm64.dmg (build on the target arch)
npm run dist:win    # dist/SpeakEasy Setup <ver>.exe (NSIS, desktop shortcut)
```

CI does this automatically: push a tag `vX.Y.Z` and `.github/workflows/build.yml` builds mac-arm64 + win-x64 (+ best-effort mac-intel) and attaches them to a GitHub Release.

Unsigned builds: macOS users right-click the app > Open on first launch (Gatekeeper); Windows SmartScreen needs "More info > Run anyway". Code signing is the open item if wide distribution is next.

## Architecture in one breath

`src/main/index.js` owns the dictation state machine (idle > recording > processing). Global hotkey via uiohook-napi (`hotkey.js`, hold / double-tap hands-free / Esc). Hidden renderer (`src/capture/`) streams 16 kHz PCM chunks with per-recording session ids. Transcription runs in a forked worker (`src/worker/transcribe-worker.js`) so the UI never blocks; `transcriber.js` sets the native-lib path env and correlates load/transcribe replies. Text lands via clipboard write + simulated paste + clipboard restore (`injector.js`). Cleanup pipeline (`cleanup.js`): fillers > dictionary > snippets > optional Ollama/Claude polish. Audio safety net (`audio-store.js`): every recording hits disk before transcription, deleted on success, surfaced as a retryable History row on failure, recovered on startup after a crash, pruned after 14 days. UI: `src/app/` (dashboard + onboarding), `src/overlay/` (the flow-bar pill).

## Gotchas that will bite you

- `settings.json` etc. live in userData; delete them to re-trigger onboarding.
- The transcribe worker needs the sherpa native libs on the loader path; `transcriber.js` handles it (DYLD_LIBRARY_PATH / PATH / LD_LIBRARY_PATH). Do not "simplify" that away.
- Whisper models decode ~30 s max per pass; the worker chunks longer audio at quiet points. Moonshine/Parakeet do not need chunking.
- Regenerate the app icon with `npm run icon` (writes `build/icon.png` for installers AND `src/assets/icon.png` for in-app use; keep both).
- Headless verification: `SPEAKEASY_SHOT=/tmp/ui.png npm start` captures the main window to PNG after load. To e2e-test the engine without a mic: `say -o t.aiff "test"`, `afconvert -f WAVE -d LEI16@16000 -c 1 t.aiff t.wav`, then fork the worker as in `scripts/` history (see repo commits) or just run the app and use a Recovered-recording retry.
- Never launch two dev instances; a single-instance lock makes the second quit silently.
