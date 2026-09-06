# v2.4.2 stability verification

Date: 2026-09-06. Built on Apple Silicon; installed after explicit user approval.

- `tests.tap`: 64 passing tests. Main-process regression fixtures first reproduced the prior fade, renderer-load, recreation, and stale-capture-error failures. Additional coverage checks watchdog recovery, preserved partial audio, bounded restart attempts, active-session repair guards, lost key release, native helper health, worker timeout/restart, IPC failures, and the new UI controls.
- `visual-check.json` and main-window PNGs: 22 real Electron renders using an isolated synthetic profile, hidden/offscreen and non-focusable. Artwork and overflow checks pass.
- `indicator-check.json` and indicator PNGs: five renderer states, including Opening microphone, Listening, Transcribing, preview, and error. These verify renderer output, not visibility over every native application or Space.
- `engine-check.json`: generated speech through the real TranscriberManager and local Moonshine worker before and after worker restart. Existing model files were read without modifying the personal profile. This is a smoke check, not an accuracy benchmark.
- `engine-parakeet-v2-check.json`: the same generated sentence through the downloaded Parakeet v2 pack, with decode time and post-decode worker RSS. Both initial and restarted workers passed. Active-model selection and personal-voice accuracy are separate checks.
- `package-check.json`: 29 packaged source files and native helper match, artwork present, installer hash recorded.
- `dmg-check.txt`: hdiutil checksum verification passed.
- `installed-check.json`: installed version 2.4.2, archive hash, native helper match, prior bundle backup, and unchanged personal profile files.

The installed app was relaunched once. Native UI inspection found the standard title bar, Ready to dictate, and all six readiness checks Ready. Native automation alone did not establish visible indicator activation because foreground/control interaction was inconsistent. Harsh separately confirmed the physical test: “Indicator appeared and words pasted.” He then reported recognition errors, so accuracy remains open. No personal transcript screenshot was committed.

Build command: `nice -n 10 npm run dist:mac -- --publish never`.

Test command: `npm test`.

Real engine smoke: `node scripts/engine-smoke.cjs <absolute-installed-moonshine-base-model-directory>`.

Signing/notarization, clean-machine installation, Windows, Intel runtime, broader application acceptance, and real multi-monitor behavior remain separate checks.
