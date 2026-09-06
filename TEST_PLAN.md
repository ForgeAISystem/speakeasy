# Verification

Date: 2026-09-06

## Passed

- 22 Node tests: real setup controller guards, download failure/retry, existing voice reuse, supported platform key choices, hotkey hold/double-tap/reset behavior, microphone lifecycle and final chunk flushing, and main-process setup completion gates.
- 20 application/build JavaScript files passed syntax checks; `git diff --check` clean.
- Native Fn helper compiled for Apple Silicon and Intel; helper is present in packaged Mac resources.
- Live Electron welcome, permission status, voice selection, model download, and ready state inspected through native UI automation.
- Live shortcut screen changed to “Got it. Your key is connected.”
- Moonshine transcribed a generated 5.003625-second test recording correctly in 56 ms on this Mac. This is one synthesized sample, not an accuracy benchmark or a microphone test. Evidence: `docs/verification/engine-check.json`.
- Mac DMG build succeeded. `hdiutil verify` passed. All 24 packaged source files match the current checkout, and the packaged manifest's runtime fields match. The install button relocated the app to `/Applications/SpeakEasy.app`; the app relaunched and displayed the correct first-time permission requirements. The generated installer is a review build without Developer ID signing or notarization.

## Still required

- User acceptance: hold Fn, dictate a sentence, release, and see it in the practice box. Then repeat in Notes, Mail, and the user's normal browser fields.
- Complete installed-app microphone and Accessibility grants and the practice dictation. The installed app is currently on that permission step. Development permissions do not establish packaged-app permissions.
- Clean-machine Gatekeeper test after signing and notarization.
- Windows runtime/installer validation and Intel Mac runtime validation.

The UI fixture tests exercise the actual controller with a simulated preload bridge. They do not establish physical microphone, OS paste, or permission behavior.
