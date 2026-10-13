# Build log

## 2026-10-12: v2.5.0 Wispr Flow teardown build

- Studied Wispr Flow 1.6.957 on Harsh's Mac: bundle structure, entitlements, helper apps, migration names, and Harsh's own local data read-only. No Wispr code, prompts, or assets were extracted or copied. Write-up: docs/WISPR-TEARDOWN-2026-10-12.md.
- Built an answer key from six real recordings Wispr had kept (241.6 s): Parakeet v2 5.2% WER, Moonshine 6.7%, Apple SpeechAnalyzer 10.3%. Ruled out Chrome audio processing (fake-mic replay, no change) and Parakeet hotwords (no gain).
- Made Parakeet the English default (onboarding and a one-time switch when installed). Added measured disfluency rules, spoken punctuation, "scratch that", vocabulary variants, chat-app period rule, and app-aware AI style. Clean moved from 23.1% to 21.7% distance to Wispr's final text over 722 dictations; harmful candidate rules were dropped.
- Added live decoding: quiet-point segments transcribed during recording (Parakeet 30-40 s, others 20-28 s), joined with the tail on release. Shared the quiet-point search between main and worker.
- Moved Claude cleanup to the official Anthropic SDK on Haiku 5.5 (thinking off, low effort, no sampling overrides), parallel sentence-aligned parts for long text, refusal handling, and a word-count guard against answers. Added Wispr dictionary/snippet import, optional mute while dictating, and front window context (title used locally only).
- 77 tests pass. 24 offscreen screens and 5 indicator states pass. Package check: 32 source files and helper match. Packaged worker transcribed a real recording. DMG built at low priority.
- Installed on Harsh's go: quit v2.4.2 normally, moved it plus a profile JSON copy to dist/rollback-v242-20261012-221027/, copied v2.5.0 into Applications (archive hash matches), launched through LaunchServices. Log: hotkey listener active, engine ready on parakeet-v2. History, stats, and window files unchanged; settings changed only by the planned one-time upgrade. No OS setting, permission, or the user's Anthropic key was touched.
- Token/cost totals were not available from this runtime.

## 2026-09-06: v2.4.2 dictation stability

- Reproduced and fixed four regressions: an old fade hiding a newer recording, indicator updates sent before renderer readiness, state lost after indicator recreation, and stale capture errors cancelling a newer recording.
- Added visible microphone-opening feedback, session-aware errors, a ten-second no-audio watchdog, recoverable received audio on capture failure, bounded renderer recovery, native Fn heartbeat/reset handling, and worker timeout/IPC/restart guards.
- Added Home connection checks, shortcut detection time, microphone-free indicator preview, explicit repair while idle, and accurate sidebar recording/processing/error states.
- 64 tests pass. Twenty-two hidden main-window fixtures and five indicator states pass. Generated speech through the real local Moonshine engine passed before and after worker restart. Package source/helper match and DMG checksum verified.
- Built at lower scheduling priority. After Harsh approved “Install and check it now,” quit v2.4.0 normally, preserved it, installed v2.4.2 once, and relaunched. Installed archive/helper match; personal settings/history/stats/dictionary/snippets were unchanged.
- Live app reports Ready to dictate and all six readiness checks Ready. Harsh confirmed “Indicator appeared and words pasted.” He then reported recognition errors with Moonshine; higher-accuracy model selection is the follow-up. No OS permission changed and no whole-computer performance improvement is claimed.
- This install includes the previously staged v2.4.1 window improvements. Evidence: docs/verification/v2.4.2/.
- Token/cost totals were not available from this runtime.

Accuracy follow-up: after confirming the indicator/paste path, Harsh reported recognition errors. Researched NVIDIA Parakeet v2/v3 and Whisper Turbo from primary sources, prepared the already-supported Parakeet v2 model, and checked real decoding before/after worker restart (81/80 ms for generated 3.675625-second speech, 1843 MiB worker RSS). No new app restart or active-model change. Language preference and real-voice comparison remain pending; see docs/MODEL-ACCURACY-2026-09-06.md.

## 2026-09-06: v2.4.1 desktop usability

- Responded to Harsh's report that app activity was disrupting other work. Kept the installed app untouched, stopped native UI automation, ran one hidden/non-focusable/offscreen visual check, and built at lower scheduling priority.
- Restored the standard native title bar and window controls, reduced the minimum size from 760x560 to 560x480, and added compact navigation, forms, settings, and onboarding layouts.
- Saved normal window bounds in a separate window.json, debounced move/resize writes, restored minimized windows on explicit reopen, and clamped saved placement to connected work areas.
- Removed native desktop blur and skipped hidden onboarding readiness polling. The dictation engine, microphone capture, and shortcut behavior remain unchanged.
- 47 tests pass; 20 offscreen screens pass overflow/artwork checks. All 29 packaged source files and the native helper match, and the DMG checksum is valid.
- v2.4.1 is staged. v2.4.0 remains running in Applications because Harsh is actively working. A single install/restart awaits his chosen moment. No physical new-build drag/resize or live speech performance claim is made.
- Token/cost totals were not available from this runtime.

## 2026-09-06

- Preserved the ten pre-existing v2.2 changed files in commit `d1ab868`, separate from this implementation. Recovery patch: `/private/tmp/speakeasy-2026-09-06-baseline/preexisting-v2.2.patch`.
- Rebuilt onboarding around access, local voice, shortcut verification, and a real practice dictation. Added main-process completion checks and an Applications install action.
- Added a small universal macOS Fn listener using Core Graphics. Existing alternate-key handling and preferences remain supported.
- Simplified Home and placed technical voice/AI settings behind a disclosure. Added keyboard navigation buttons, labeled settings controls, focus indicators, and reduced motion.
- Fixed cancellation while microphone startup is pending; flushed the final partial audio buffer on stop.
- Added tests and CI native-helper compilation. Updated README privacy and install instructions to match actual behavior.
- Generated and inspected the actual welcome screen. The real local voice download/load succeeded. The live shortcut screen reported a connected Fn key. Physical microphone-to-paste acceptance and a fresh signed installer remain distinct checks.
- Local Mac installer built successfully. No Apple signing identity was available. No release tag was published.

- Final package verified against source, DMG checksum passed, and the app installed itself into Applications through its button. Installed app relaunch verified. It remains on the permission step for the user to grant microphone and Accessibility.

## 2026-09-06: v2.4 visual and functional refinement

- Researched current official Wispr Flow and Glaido pages; saved decisions and primary links in docs/COMPETITOR-RESEARCH-2026-09-06.md.
- Generated original amber/sage glass artwork through built-in ImageGen and bundled the 1.4 MB PNG. Recorded the final prompt in docs/IMAGEGEN.md.
- Added shallow pointer depth, quiet transitions, and a motion preference with system reduced-motion priority.
- Added explicit cleanup modes and safe fallback retaining spoken organize requests when optional AI is unavailable. Preserved original transcript comparison/copy and improved search, date grouping, attention filtering, and keyboard access.
- Added dictionary/snippet editing, duplicate prevention, and multiline snippet text.
- Reworked the overlay to report real stages, wait for microphone arming, and stop animation when idle/hidden.
- Native UI testing exposed the existing Cmd+Q interception. Fixed before-quit and verified a normal exit in the installed build.
- 39 tests pass. Nine Electron fixture screenshots passed overflow and artwork checks. Real installed welcome inspected separately. All 28 packaged source files and native helper match; DMG checksum passes.
- v2.4.0 installed in Applications. The previous bundle is preserved under dist/rollback-v23-uo435ciu/SpeakEasy.app. Personal profile files were not altered by the upgrade.
- The old temporary engine fixture was no longer present for rerun; the prior v2.3 engine sample remains historical evidence. This pass does not claim a new physical microphone test or a speech accuracy benchmark.
- Token/cost totals were not available from this runtime.
