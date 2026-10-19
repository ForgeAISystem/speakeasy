# SpeakEasy current state

> Maintainer's machine log (Harsh's build Mac). Installing SpeakEasy anywhere else? Follow [INSTALL.md](INSTALL.md); nothing below describes your computer.

Updated: 2026-10-18

Canonical remote: `git@github.com:ForgeAISystem/speakeasy.git`. Active branch: `main` (v2.5.0, tag `v2.5.0`; `codex/speakeasy-easy-start` is merged and identical). Private repository: collaborators get the code and the Releases page. Anyone's agent installs or updates from `main` through INSTALL.md. Release v2.5.0 (Latest) carries SpeakEasy-2.5.0-arm64.dmg, SpeakEasy-2.5.0.dmg (Intel), and SpeakEasy.Setup.2.5.0.exe; CI run 38338393553 passed tests and builds on macOS arm64, macOS Intel, and Windows.

## Where things stand

**v2.8.0 built, not installed (2026-10-18).** Branch `feat/guides` (on top of v2.7). Adds walkthroughs: What's new after each update, a Learn tab, a floating coach that checks each step as you really do it, and timed challenges with levels (Learner, Operator, Pro). Guides for Dictation basics, the Control Pad, and voice commands. Rule: every user-facing feature ships with a guide (docs/GUIDES.md). 107 tests, offscreen screens (29 plus coach states), package check pass. Installer `dist/SpeakEasy-2.8.0-arm64.dmg`, SHA-256 `a8d6392f833ce5b66281f8c43855281222e3e83dd048355f5e3ebbb1e8cc737f`. Install waits on Harsh's go.

**v2.7.0 INSTALLED (2026-10-18 21:48, on Harsh's go).** Quit v2.5.0 normally; it and a copy of the profile JSON are in `dist/rollback-v250-20261018-214803/`. Installed app.asar matches the build; launched through LaunchServices; log shows `[hotkey] listener active` and `[engine] ready: parakeet-v2`; `speakeasy-fn --mic` running; history unchanged. Rollback: quit, move that SpeakEasy.app back to Applications, restore its profile JSON. Was: Branch `feat/voice-commands` (on top of v2.6). Adds voice commands for the Control Pad: hold fn with the pad open, or start with "Hey computer". Offline planner plus Claude fallback (only with a key), plan shown on the pad, typing/pasting/Shortcuts wait for Return. 97 tests, offscreen screens, package check pass. Installer `dist/SpeakEasy-2.7.0-arm64.dmg`, SHA-256 `79eaa1ff2cdf943da2810fe39f42cb75e0d1e7d79374271e3083106049a45e66`. Includes v2.6. Physical checks still waiting on Harsh. After install, also try: mic key, hold fn, "put Chrome on the left and Claude on the right"; dictate "Hey computer, open Notes".

**v2.6.0 built, not installed (2026-10-18).** Branch `feat/window-pad-globe-fix`. Adds the Control Pad (4x4 keyboard drum pad: window snaps, workflow layouts, apps, links, Shortcuts, key combos, prompts, screen recording with a camera bubble; Pad tab with a live monitor and per-pad editor) and a one-click fix for fn opening the emoji picker (Globe key preference, with Undo). 87 tests, offscreen screens, and package check pass. Installer: `dist/SpeakEasy-2.6.0-arm64.dmg`, SHA-256 `dddc98b8dee1ebb6347fcc1f3598a6e24ac7db155dccb873eae500dd5c86b5bc`. Waiting on Harsh to say when to swap the running v2.5.0 (same install steps as v2.5: quit normally, keep a rollback copy, copy into Applications, launch through LaunchServices). Not yet merged to main, tagged, or released to collaborators.

After install, check by hand: Fix it in Settings, then double-tap fn (no picker); tap the mic key over Chrome and press A (left half), A again (next screen); Shift+1 then 1; R (recorder toolbar plus camera bubble, camera permission prompt expected). A new unsigned build may ask for Accessibility and Input Monitoring again.

### v2.5.0 (installed 2026-10-12)

v2.5.0 is installed and running at `/Applications/SpeakEasy.app` (Harsh said "yes install it now", 2026-10-12 22:10). v2.4.2 was quit normally and moved, with a copy of the profile JSON, to `dist/rollback-v242-20261012-221027/`. The installed app.asar matches the build. Launched through LaunchServices: startup log shows `[hotkey] listener active` and `[engine] ready: parakeet-v2`, and the Fn helper runs. The one-time upgrade switched model to parakeet-v2, the Claude model to claude-haiku-5-5, and added the two new switches; history, stats, and window placement are byte-identical.

v2.5 came from a Wispr Flow teardown on Harsh's own Mac (docs/WISPR-TEARDOWN-2026-10-12.md). Findings that drove the build:

- On six real recordings of Harsh, Parakeet v2 makes 5.2% word errors vs Moonshine 6.7% (22% fewer). Apple's macOS 26 recognizer: 10.3%. Chrome capture processing and Parakeet hotwords made no difference.
- Most of Wispr's felt accuracy is formatting: its final text differs from its own raw recognizer by 23.3% of words, mainly verbal tics.

Shipped in v2.5: Parakeet default, measured tic removal (Clean 23.3% to 21.7% distance from Wispr's final text over 722 dictations), spoken punctuation and "scratch that", live decoding of long dictations while recording, app-aware style (chat apps drop a lone final period; Polished gets the app's style), dictionary variants ("bellavita" to "Bella Vita", domains untouched), Wispr dictionary/snippet import (33 words and 1 snippet waiting on this Mac), optional mute while dictating, and Claude cleanup on Haiku 5.5 through the official SDK with parallel parts and an answer-instead-of-clean guard.

Polished mode is still off on this Mac (`polishProvider: off`). Turning it on needs Harsh to paste an Anthropic key in Settings; agents must not handle the key.

## Verified

- 77 automated tests pass (13 new: tic rules and precision cases, spoken commands, vocabulary variants, chat style, AI context without window title, answer guard, parallel parts, Haiku 5.5 request shape, refusal fallback, Wispr import mapping/dedupe, live segmentation and cancel).
- Real engines on Harsh's recordings: whole-recording and live-segment accuracy measured (Parakeet 30-40 s segments 5.2%, equal to one pass).
- Packaged app: all 32 source files and the native helper match; the packaged worker transcribed a real 114.7 s recording with Parakeet (341 words, 2.8 s).
- 24 offscreen screens and 5 indicator states pass with synthetic data, including the new Dictionary import card and Settings switches.

Not verified: a physical Fn dictation in the installed v2.5 (awaiting Harsh), a live Claude API call (no key used), mute on real audio, and the import button against the real profile (the reader was run read-only against Harsh's Wispr database; the write path is covered by tests and code review only).

Evidence: `docs/verification/v2.5.0/`.

Installer: `dist/SpeakEasy-2.5.0-arm64.dmg` (151674564 bytes).

SHA-256: `3a526623aeb6ba12db24bbd9535b24c316d6a256bfb68a83e771d4b99ae3f407`.

Unsigned and not notarized, like earlier builds. Previous installed version: v2.4.2 (`dist/SpeakEasy-2.4.2-arm64.dmg`).

## Next

1. Harsh dictates one long passage to confirm Fn, microphone, paste, and live decoding in the installed app, then presses Dictionary > Import. Rollback if needed: quit SpeakEasy, move `dist/rollback-v242-20261012-221027/SpeakEasy.app` back to Applications, and restore its `profile/settings.json`.
2. Optional: Harsh pastes an Anthropic key and picks Polished to get Wispr-grade formatting.
3. Text near the cursor as context, learn-from-edits, command mode (ranked in the teardown doc).
4. Developer ID signing/notarization and Windows/Intel validation before any distribution.
