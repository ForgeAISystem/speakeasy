# SpeakEasy current state

Updated: 2026-09-06

Canonical remote: `git@github.com:ForgeAISystem/speakeasy.git`. Active branch: `codex/speakeasy-easy-start`.

## Where things stand

v2.4.1 is built and staged, with a standard native title bar, movable/resizable window down to 560x480, compact layouts, saved window placement, offscreen recovery when a monitor is disconnected, and restoration when reopening a minimized window. Native desktop blur was removed; hidden onboarding skips readiness polling. Personal dictation settings and the audio/shortcut pipeline are unchanged.

The installed and running app remains v2.4.0. Harsh is actively working and reported interference from app/deployment activity. No native UI automation, foreground activation, quit, or installed-bundle replacement was performed during this fix. One install/restart is pending a convenient moment selected by Harsh. Do not force a restart or overwrite the running bundle.

v2.4.0 is built and installed at `/Applications/SpeakEasy.app`. It adds original ImageGen glass artwork, subtle pointer depth, reduced-motion controls, explicit Original/Clean/Polished modes, original transcript comparison/copy, better history search and filters, editable multiline snippets/dictionary, and a calmer overlay. Standard native Quit now exits; closing the window still hides it.

The v2.3 onboarding, install action, native Fn, voice preparation, and practice gate remain. The user's earlier v2.2 work was preserved separately in `d1ab868`. Main's last published/tagged state observed was v2.1.1, `aa45aae`; no new public release was created in this session.

## Verified

v2.4.1: 47 automated checks pass. Twenty offscreen Electron screens pass artwork/overflow checks, covering all five tabs and all onboarding steps at a 560x450 content viewport. Practice's final action is reachable by scrolling. The fixture cannot take keyboard focus and uses an isolated profile with synthetic data. All 29 packaged source files and the native helper match. DMG checksum passes. See docs/verification/v2.4.1/. A single snapshot of the existing app reported 0.0% aggregate CPU and approximately 636 MiB summed RSS; this does not establish the cause of whole-computer lag or a measured improvement. Physical dragging, monitor movement, and resizing of the new installed build remain to be checked after restart.

Staged installer: `dist/SpeakEasy-2.4.1-arm64.dmg` (149735170 bytes). SHA-256: `f089ee4374dfb95c4b687c4eadd50eb03c74fd958a38800e2cd3d0c38b0160e5`.

Earlier v2.4.0 verification:

39 tests pass. Nine real Electron fixture screens pass overflow/artwork checks, including 760x560 and 980x680 layouts. Fixtures use synthetic state and are not evidence of live permissions. The actual installed welcome was inspected separately. Native Cmd+Q exited with code 0 and relaunch was verified. All 28 packaged source files and the native helper match; installed and built archives have identical hashes; DMG checksum passes.

The earlier synthesized English engine sample is recorded under docs/verification/engine-check.json. Its temporary model fixture was unavailable for a fresh run. The transcription worker is unchanged in v2.4. Full physical microphone-to-paste acceptance remains outstanding.

Installer: `dist/SpeakEasy-2.4.0-arm64.dmg` (149735631 bytes). SHA-256: `0a90ab6658ba3102e0bb85bb9b3ad90f12d55298807ec28ab5517dc69875ac92`.

Rollback copy of the previous app: `dist/rollback-v23-uo435ciu/SpeakEasy.app`. Personal profile files were not altered by the upgrade.

## Next

0. When Harsh is ready, quit SpeakEasy normally, preserve the current bundle, install the staged v2.4.1 app, and verify the installed archive matches the build. Reopen once. Check native title-bar dragging, smaller sizing, and another screen without taking over his workspace. Until then, v2.4.0 remains installed.
1. Complete remaining onboarding permissions, voice download, and physical Fn-to-paste test in the practice field, Notes, Mail, and normal browser fields.
2. Developer ID signing/notarization and a clean-machine install test. No signing identity was available; the current DMG is unsigned and not notarized.
3. Windows and Intel runtime validation before distribution.
4. See docs/COMPETITOR-RESEARCH-2026-09-06.md for import, app-specific style, and future context/agent decisions. See docs/IMAGEGEN.md for the generated asset and exact prompt.

No new cloud service or account is required. Optional Polished mode depends on the user's configured local Ollama or Anthropic provider. No OS permission was granted by the agent.
