# SpeakEasy current state

Updated: 2026-10-12

Canonical remote: `git@github.com:ForgeAISystem/speakeasy.git`. Active branch: `codex/speakeasy-easy-start`. Private repository; no public release.

## Where things stand

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
