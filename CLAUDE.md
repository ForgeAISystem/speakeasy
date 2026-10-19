# SpeakEasy: agent runbook

**Every user-facing feature ships with a walkthrough (Harsh, 2026-10-18).** Add or update its guide in src/shared/guides.js: what's new lines, lessons whose steps check real app events, and a timed challenge. Rules and the event list: [docs/GUIDES.md](docs/GUIDES.md). No guide, no release.

**Installing or updating SpeakEasy for someone? Follow [INSTALL.md](INSTALL.md) and stop there.** It works on any Mac. STATE.md, SESSION-HANDOFF.md, BUILD_LOG.md, and docs/verification/ track the maintainer's own build Mac; their "installed" and "do not reinstall" notes do not apply to the computer you are on.

**Developing SpeakEasy?** Read [STATE.md](STATE.md) first for the latest build and verification limits, then this file.

**What this is:** local voice dictation for Mac and Windows (a Wispr Flow replacement). Hold a key, speak, release; text pastes at the cursor. Speech recognition runs offline: Electron + sherpa-onnx (Parakeet / Moonshine / Whisper models). Built by The Forge.

## Set up and run from source

```bash
npm ci          # pulls Electron + prebuilt speech dependencies
npm start       # compiles the Mac Fn helper, then launches the app
```

- Running from inside Claude Code / an Electron-hosted shell? That environment exports `ELECTRON_RUN_AS_NODE`, which breaks `npm start`. Use: `env -u ELECTRON_RUN_AS_NODE npm start`.
- First launch walks through: welcome and an optional Applications install action, permissions, an English/multilingual voice download, a verified shortcut, and a real dictation test. No name or account is required. The Mac default is Fn; existing preferences are preserved.
- Models land in the user-data dir (`~/Library/Application Support/SpeakEasy/models` on mac). Settings/history/dictionary/snippets are JSON files next to it.

## Build installers

```bash
npm run dist:mac    # dist/SpeakEasy-<ver>-arm64.dmg (build on the target arch)
npm run dist:win    # dist/SpeakEasy Setup <ver>.exe (NSIS, desktop shortcut)
```

CI does this automatically: push a tag `vX.Y.Z` and `.github/workflows/build.yml` builds mac-arm64 + win-x64 (+ best-effort mac-intel) and attaches them to a GitHub Release.

Unsigned builds: macOS users right-click the app > Open on first launch (Gatekeeper); Windows SmartScreen needs "More info > Run anyway". Code signing is the open item if wide distribution is next.

## Architecture in one breath

`src/main/index.js` owns the dictation state machine (idle > recording > processing). Global hotkey via the bundled native Fn helper on Mac, or uiohook-napi for other keys (`hotkey.js`, hold / double-tap hands-free / Esc). Hidden renderer (`src/capture/`) streams 16 kHz PCM chunks with per-recording session ids. Transcription runs in a forked worker (`src/worker/transcribe-worker.js`) so the UI never blocks; `transcriber.js` sets the native-lib path env and correlates load/transcribe replies. Text lands via clipboard write + simulated paste + clipboard restore (`injector.js`). Cleanup pipeline (`cleanup.js`): Original bypasses transformations; Clean applies fillers/dictionary/snippets; Polished runs a configured provider before final snippet expansion. AI failures retain the complete local text and are labeled in History. Shared mode resolution is in src/shared/writing.js. Audio safety net (`audio-store.js`): every recording hits disk before transcription, deleted on success, surfaced as a retryable History row on failure, recovered on startup after a crash, pruned after 14 days. UI: `src/app/` (dashboard + onboarding), `src/overlay/` (the flow-bar pill).

## Gotchas that will bite you

- `settings.json` etc. live in userData; delete them to re-trigger onboarding.
- The transcribe worker needs the sherpa native libs on the loader path; `transcriber.js` handles it (DYLD_LIBRARY_PATH / PATH / LD_LIBRARY_PATH). Do not "simplify" that away.
- Whisper models decode ~30 s max per pass; the worker chunks longer audio at quiet points. The v2.2 worker also chunks Moonshine and Parakeet to keep long recordings within native memory limits.
- Regenerate the app icon with `npm run icon` (writes `build/icon.png` for installers AND `src/assets/icon.png` for in-app use; keep both).
- Headless verification: `SPEAKEASY_SHOT=/tmp/ui.png npm start` captures the main window to PNG after load. To e2e-test the engine without a mic: `say -o t.aiff "test"`, `afconvert -f WAVE -d LEI16@16000 -c 1 t.aiff t.wav`, then fork the worker as in `scripts/` history (see repo commits) or just run the app and use a Recovered-recording retry.
- Never launch two dev instances; a single-instance lock makes the second quit silently.

## v2.3 development and release notes

- The native helper is `native/fn-key.c`; `npm run native` builds a universal executable at `build/native/speakeasy-fn`. It is bundled under app resources. Compile on Mac with Command Line Tools. Do not require users to compile it.
- `npm test` covers onboarding, hotkey state, microphone cancellation/tail flush, and main-process completion gates.
- `SPEAKEASY_USER_DATA=/absolute/temp/path` uses an isolated QA profile. Never delete the real user profile to test onboarding.
- `SPEAKEASY_SHOT=/absolute/image.png` captures the actual main window at startup.
- Screens can be fully tested through the actual Electron app. A physical Fn press is required because the current computer-control tool cannot synthesize it.
- Source preferences are not proof of signing. Confirm a valid Developer ID, notarization, installer contents, and clean-machine launch before claiming consumer-ready distribution.

## v2.4 development notes

Original ImageGen artwork lives in src/app/assets/voice-glass.png; prompt and provenance in docs/IMAGEGEN.md. refinement.css and motion.js implement event-driven depth with reduced-motion support. Overlay animation runs only while an armed recording is visible. Native Quit is handled in before-quit; window close still hides.

Run npm test (39 checks), then env -u ELECTRON_RUN_AS_NODE npx electron scripts/visual-check.cjs for nine real-renderer screens with synthetic data. After the Mac build, node scripts/package-check.cjs verifies source, artwork, native helper, version, and installer hash. Visual fixtures do not prove OS permissions or live microphone/paste.

## v2.4.1 desktop usability notes

Read STATE.md before installing. Harsh reported disruption while working on the same computer. Keep tests hidden/non-focusable and avoid controlling, restarting, or replacing the running app until he chooses the restart moment. Run the offscreen visual script and installer build sequentially at lower priority using nice -n 10. Do not launch the full app for screenshots during concurrent work.

The main window now uses standard native chrome. Bounds live in window.json, separate from dictation preferences; window-bounds.js restores them on connected displays. Compact layouts support a 560x480 outer window. Hidden onboarding skips readiness reads; audio capture retains its existing timing settings. Current verification: 47 automated checks and 20 offscreen fixture screens. Evidence is under docs/verification/v2.4.1/. Fixtures are synthetic and do not prove native drag handles or actual microphone/paste.

## v2.4.2 stability notes

v2.4.2 is installed after Harsh's explicit one-restart approval. He confirmed the physical Fn indicator and pasted text, then reported Moonshine recognition errors. Do not repeat installation or onboarding; accuracy/model choice is the active follow-up.

64 automated tests, 22 hidden main-window fixtures, five indicator states, and real generated-speech recognition before/after worker restart pass. Main retains/replays overlay state and cancels stale hide timers. Capture errors carry sessions, stalled input is bounded, and received audio survives failure. Native Fn heartbeat/reset and worker identity/IPC/load-timeout guards handle disconnections. Home has Test indicator and idle-only Repair connection. Evidence: docs/verification/v2.4.2/. The agent changed no OS permissions.

## v2.5 notes (2026-10-12)

Read docs/WISPR-TEARDOWN-2026-10-12.md before changing recognition or cleanup. Cleanup rules are evidence-gated: a new rule must move Clean output closer to Wispr's final text on Harsh's local history without changing meaning. The scoring scripts live outside the repo because they read personal data; commit aggregate numbers only, never audio or transcript text.

Live decoding lives in src/main/index.js (maybeDecodeAhead, transcribeDictation) and shares src/shared/quiet-point.js with the worker. Claude cleanup uses @anthropic-ai/sdk, required lazily inside cleanup.js so tests can inject a fake. Settings upgrades run once through migrateSettings() keyed by settingsVersion. Run npm test (77 checks), then the offscreen visual script, then dist:mac and node scripts/package-check.cjs.

## v2.6 notes (2026-10-18)

Control Pad and the fn emoji fix. Pad model (keys, regions, action types, frame math) is src/shared/pad.js, shared by main and both renderers. src/main/control-pad.js runs actions; native/window.c (built to build/native/speakeasy-window, bundled next to speakeasy-fn) reads the front window, lists on-screen windows (CGWindowList, no titles), and places a window through Accessibility. The pad window is a non-activating panel so the app you were using stays the target; pad keys are temporary global shortcuts bound only while the pad is open. The mic key (keycode 176) is claimed by speakeasy-fn when started with --mic (setting padMicKey), so it only works while Fn is the dictation key. Pads live in pad.json in userData.

The emoji picker on fn comes from macOS ("Press Globe key to"), not from the event tap, so swallowing Fn cannot stop it. globe-key.js writes com.apple.HIToolbox AppleFnUsageType = 0 only when the user presses Fix it, stores the old value in settings.globePrevious, and Undo restores it. Agents must not run that write themselves.

Run npm test (87 checks), the offscreen visual script (26 screens, 5 indicator states, the floating pad), dist:mac, then node scripts/package-check.cjs (now also checks the window helper). Not provable from an agent shell: physical mic-key presses, real window moves (the shell lacks Accessibility), the camera bubble, and the Screenshot recorder.

## v2.7 notes (2026-10-18)

Voice commands. src/main/commands.js turns a spoken request into steps (snap, open_app, open_url, pad, shortcut, keys, paste, record, camera, teach). planLocally() handles everyday phrasing offline; plan() falls back to Claude (forced run_steps tool, Haiku 5.5, thinking off) only when polishAnthropicKey is set. validate() is the gate for both: unknown verbs, non-http links, apps that are not installed, bad regions or keys are dropped, max 8 steps. needsConfirm() holds keys, paste, Shortcuts and pads of those types until Return. A recording is a command when the pad was open at fn-down (commandMode in index.js) or when the transcript starts with a wake phrase (wakeCommand). Commands never paste their transcript and are not saved to History. ControlPad.showPlan/confirm/runSteps run it; native/window.c gained frame <pid> for snapping a named app.

Run npm test (97 checks), the offscreen visual script (adds control-pad-plan.png), dist:mac, package check. Not provable from an agent shell: a spoken command end to end, Claude planning with a real key, Return confirm on a real pad.

## v2.8 notes (2026-10-18)

Walkthroughs. src/shared/guides.js holds the guides (shared by main and the Learn tab). src/main/guide.js GuideRunner runs one at a time; push() in index.js feeds every app event through toGuideEvent() into it, so steps finish only on real actions. The coach (src/coach/) is a non-activating always-on-top panel in the top right; starting a guide hides the main window so practice happens in real apps. What's new shows once per update for guides newer than guide.json seenVersion (installs from before 2.8 count as 2.5.0). Progress and best challenge times live in guide.json. Research behind it: docs/RESEARCH-2026-10-18.md.

## v2.9 notes (2026-10-18)

Edit by voice, the top four from docs/COMPETITORS-2026-10-18.md. All four ship with the "Edit by voice" guide (src/shared/guides.js, events in docs/GUIDES.md).

- Terminal mode: src/main/terminal.js decides (front app Terminal, iTerm2, Warp, Ghostty, kitty, Alacritty, WezTerm, Hyper, Tabby, or a window title with "Claude Code" / "✳") and formats (straight quotes, no final period per line). injector.js `terminal: true` pastes line by line with Shift+Return between, so a newline never reaches a terminal as Return. smartInject() in index.js applies the same to pad prompts, history pastes and paste-last. Setting terminalMode (default on).
- Rewrite: hold fn+Shift (the Fn helper now emits shift-down/shift-up; HotkeyManager.withShift) or say "Hey computer, make this shorter" (rewrite.isRequest, which leaves window commands alone). runRewrite() waits for Shift up, copySelection() (Cmd+C, clipboard restored), rewrite.pick() (user transforms in settings.transforms, then Translate, Prompt Engineer, Bullets, Shorter, Polish, else the words as the instruction), rewrite.run() (Claude when polishAnthropicKey is set, else Ollama), overlay state 'rewrite' with a preview, paste over the selection, History row with transform.
- Undo AI edit: Command+Control+Z (Shift+Alt+U elsewhere). lastEdit holds the last paste; undoPaste() presses Cmd+Z (text fields) or Backspace x length (terminals) and pastes the raw transcript for dictations. Refused in another app, after 10 minutes, or when nothing changed. Any pad or paste-last paste clears it.
- History search: history-search.js parseQuery() ("what did I say about X", "search my history for X") and search() (stemmed whole-word hits, most topic words required, phrase bonus, recency; skips failures and rewrites). runHistorySearch() shows results on the pad (ControlPad.showResults: Up/Down, Return or click pastes through the pad's paste path).

Run npm test (128 checks), the offscreen visual script (31 screens, 8 indicator states including the rewrite states, pad plan and history results, coach), dist:mac, package check. Not provable from an agent shell: a physical fn+Shift press, a real Cmd+C/Cmd+Z in another app, a Claude rewrite with a real key, Shift+Return in a live Claude Code session.
