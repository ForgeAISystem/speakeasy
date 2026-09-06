# Build log

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
