# Verification

Date: 2026-09-06

## v2.4.2 checks

- 64 automated checks pass. Coverage includes old fade cancellation, readiness/state replay, stale capture errors, microphone timeout/saved-audio recovery, bounded renderer restarts, idle-only repair, lost key release, native heartbeat, and worker timeout/IPC/restart races.
- Twenty-two hidden/offscreen main-window fixtures and five indicator states pass visibility/artwork/overflow checks using synthetic state.
- A generated 3.675625-second sentence was recognized correctly through the real local Moonshine engine before and after worker restart, in 42 ms and 37 ms. This is a smoke check, not an accuracy benchmark.
- All 29 packaged source files and native helper match; DMG checksum passes. v2.4.2 installed after explicit approval. Installed archive/helper match; personal profile files were unchanged by installation.
- Native title bar, Home controls, Ready to dictate, and six Ready connection checks observed. Harsh separately confirmed physical Fn activation, a visible indicator, and pasted text. He reports recognition errors; accuracy evaluation remains open.
- Microphone/Accessibility grants, installed voice, and completed onboarding are already present. Earlier permission/setup notes below are historical.
- Evidence: docs/verification/v2.4.2/.

## v2.4.1 checks

- 47 automated checks pass. New coverage verifies window restoration on negative-coordinate monitors, disconnected/changed displays, invalid saved placement, resize limits, native window controls, debounced placement writes, close-time flush, minimized-window restoration, and hidden setup polling.
- Twenty offscreen Electron fixtures pass without horizontal overflow. All app tabs and onboarding steps render at a 560x450 content viewport, below the new 560x480 native outer size. The final practice action remains reachable by scrolling. Reduced motion remains effective.
- The renderer is hidden, non-focusable, offscreen, and separate from the personal profile. Screenshots of compact Home, Settings, and welcome were inspected from disk.
- All 29 packaged source files and native Fn helper match. The final DMG checksum passes. Installer: dist/SpeakEasy-2.4.1-arm64.dmg. Evidence: docs/verification/v2.4.1/.
- Existing v2.4.0 remains installed/running. No actual app window was controlled or restarted during this pass. Physical title-bar dragging, cross-monitor placement, and native resizing of v2.4.1 await a convenient install/restart.
- Current idle CPU was low. Summed RSS is approximately 636 MiB and may count shared pages more than once. This snapshot neither diagnoses the earlier slowdown nor establishes a before/after improvement. Audio and transcription code were not changed.

## v2.4 checks

- 39 automated checks pass, including Original preserving text, local-only Clean behavior, missing/failing AI recovery, multiline snippets, original-history search/copy, filters, duplicate prevention, keyboard access, recording animation lifecycle, and native Quit.
- Nine real Electron rendering fixtures cover normal and compact welcome/Home, permissions, shortcut, settings, history, and snippets. No horizontal overflow; artwork loaded; motion-off animation was none. Fixtures use synthetic state, not real permission grants.
- Actual installed v2.4 welcome verified separately. Native Cmd+Q exited with code 0, then normal relaunch was verified.
- All 28 packaged source files and native helper match the checkout. Installed and built app.asar SHA-256 hashes match. DMG checksum passed. See docs/verification/v2.4/package-check.json and dmg-check.txt.
- The transcription worker was unchanged. The earlier temporary engine fixture was unavailable for rerun; the sample below is prior v2.3 evidence.

## Prior v2.3 checks

- 22 Node tests: real setup controller guards, download failure/retry, existing voice reuse, supported platform key choices, hotkey hold/double-tap/reset behavior, microphone lifecycle and final chunk flushing, and main-process setup completion gates.
- 20 application/build JavaScript files passed syntax checks; `git diff --check` clean.
- Native Fn helper compiled for Apple Silicon and Intel; helper is present in packaged Mac resources.
- Live Electron welcome, permission status, voice selection, model download, and ready state inspected through native UI automation.
- Live shortcut screen changed to “Got it. Your key is connected.”
- Moonshine transcribed a generated 5.003625-second test recording correctly in 56 ms on this Mac. This is one synthesized sample, not an accuracy benchmark or a microphone test. Evidence: `docs/verification/engine-check.json`.
- Mac DMG build succeeded. `hdiutil verify` passed. All 24 packaged source files matched that checkout, and the packaged manifest's runtime fields match. The install button relocated the app to `/Applications/SpeakEasy.app`; the app relaunched and displayed the correct first-time permission requirements. The generated installer is a review build without Developer ID signing or notarization.

## Still required

- Broader user acceptance: repeat dictation in Notes, Mail, and normal browser fields; compare the actual words spoken against recognition, including names and longer sentences. One physical Fn/indicator/paste test is already confirmed.
- Native resizing, moving across screens, and visibility in full-screen Spaces. Do not reset the completed setup or existing permissions to perform these checks.
- Clean-machine Gatekeeper test after signing and notarization.
- Windows runtime/installer validation and Intel Mac runtime validation.

The UI fixture tests exercise the actual controller with a simulated preload bridge. They do not establish physical microphone, OS paste, or permission behavior.
