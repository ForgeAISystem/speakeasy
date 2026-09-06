# SpeakEasy current state

Updated: 2026-09-06

Canonical remote: `git@github.com:ForgeAISystem/speakeasy.git`. Active branch: `codex/speakeasy-easy-start`. Private repository; no new public release.

## Where things stand

v2.4.2 is installed and running at `/Applications/SpeakEasy.app`. Harsh explicitly approved “Install and check it now.” The previous v2.4.0 app was quit normally, preserved, and replaced once. Installed archive and native helper match the build. Settings, history, stats, dictionary, and snippets were unchanged by installation.

Harsh then confirmed: “Indicator appeared and words pasted.” This establishes the physical Fn, microphone, native indicator, and paste path on his test. He subsequently reported inaccurate recognition. The current model is Moonshine Base. Parakeet v2 is now downloaded and passed a real engine smoke check, but has not been selected. See docs/MODEL-ACCURACY-2026-09-06.md for research, measurements, and the pending language/selection decision.

The installed Home reports Ready to dictate. Live readiness reports microphone and Accessibility permission, shortcut, local voice, capture connection, and indicator connection ready. Onboarding is complete and a local Moonshine English voice is prepared. Do not repeat first-run setup unless a live check fails.

This update fixes indicator hide/load/recreation races, guards late microphone errors by recording session, adds microphone startup/stall recovery with recoverable received audio, and supervises the native Fn helper and speech worker. Home now has Check dictation, Test indicator, Repair connection, and a last-detected shortcut time. Opening the microphone has a visible spinner; the sidebar distinguishes recording, processing, and failures.

v2.4.1 window improvements are included: standard native title bar, movement and resizing down to 560x480, compact layouts, saved normal placement, disconnected-display recovery, and restoring a minimized window. v2.4 artwork, subtle motion, cleanup modes, original transcript comparison, history search, dictionary, and multiline snippets remain.

Harsh is using the computer for other work. Avoid repeated app launches, foreground automation, or heavy concurrent builds. The one authorized restart is complete. No OS permission or security setting was changed by the agent.

## Verified

- 64 automated tests pass. Regression tests reproduced four failures before fixes: a previous completion fade hiding a new recording, overlay state sent before its renderer loaded, missing state replay after overlay recreation, and a stale microphone error cancelling a newer recording.
- Twenty-two hidden, non-focusable Electron main-window fixtures and five indicator states pass artwork, bounds, and visibility checks. These use synthetic state and an isolated profile.
- The real local Moonshine engine transcribed a generated 3.675625-second sentence correctly before and after a worker restart, in 42 ms and 37 ms. This is a smoke check, not a general accuracy benchmark.
- The same generated sentence passed with Parakeet v2 in 81 ms and 80 ms before/after worker restart. Worker RSS was 1843 MiB after each decode, on a 48 GiB Mac. This is not peak memory or a personal accuracy measurement.
- All 29 packaged source files and native helper match. DMG checksum passes. Installed version/archive/helper and preserved profile were checked.
- Installed native title bar, new Home controls, Ready to dictate, and all six readiness checks were observed. Harsh separately confirmed the real Fn indicator and pasted text; recognition accuracy remains an issue.
- One idle process snapshot after relaunch showed 0.0% CPU for each SpeakEasy process. This does not diagnose the reported computer slowdown or prove an improvement.

Evidence: `docs/verification/v2.4.2/`. Earlier version directories retain historical checks.

Installer: `dist/SpeakEasy-2.4.2-arm64.dmg` (149737282 bytes).

SHA-256: `580ccd030f546cc0fc8ababb8933cd658ebacdde02b2010b135259e3d951be9b`.

Installed app.asar SHA-256: `94cc3fbb524f2f0596b8625d7a5f89cc7340ca796c1b0da54d5412caf4560f4c`.

Previous v2.4.0 bundle: `dist/rollback-v240-_68t_mt7/SpeakEasy.app`.

## Next

1. Improve transcription accuracy. Research current supported models and choose for Harsh's languages. Compare his actual speech; generated samples cannot prove his accent, vocabulary, or microphone accuracy.
2. Confirm movement/resizing and cross-screen behavior during normal use. Automated fixtures do not prove these OS interactions.
3. Developer ID signing/notarization and clean-machine installation before broad distribution. No signing identity was available; the current DMG is unsigned and not notarized.
4. Windows and Intel runtime validation before distribution.
5. Future feature decisions: `docs/COMPETITOR-RESEARCH-2026-09-06.md`. Original artwork and prompt: `docs/IMAGEGEN.md`.

No new cloud service or account is required. Optional Polished mode depends on the user's configured local Ollama or Anthropic provider. The user's earlier v2.2 work is preserved separately in `d1ab868`; the last observed main release was v2.1.1 at `aa45aae`.
