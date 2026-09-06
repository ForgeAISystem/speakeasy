# SpeakEasy current state

Updated: 2026-09-06

## Where things stand

v2.3.0 is installed at `/Applications/SpeakEasy.app` and is a local review build on `codex/speakeasy-easy-start`. The user's existing v2.2 work was preserved separately in `d1ab868`. Last published/tagged state observed at session start was v2.1.1 on main, `aa45aae`.

This pass adds guided onboarding, an Applications install action, native Fn on Mac, a verified shortcut step, gated practice dictation, quieter Home, advanced settings disclosure, and microphone lifecycle fixes. Existing user preferences and personal data were not deleted or migrated.

## Verified

22 automated tests, JavaScript syntax checks, a real English voice download and engine load, native Fn listener startup, live Fn connected state, correct offline recognition of a generated speech sample, successful Mac installer build, valid DMG checksum, source/package matching, and one-button relocation into Applications with a normal relaunch. Welcome screenshot and engine evidence are in `docs/verification/`.

## Next

1. Complete physical microphone-to-paste acceptance in the practice box and common target apps.
2. The installed packaged app is open on its permission step. Microphone and Accessibility are not yet granted for this installation; the user completes them through the displayed buttons. No OS permission was granted by the agent.
3. Sign/notarize with the owner's Apple Developer credentials before claiming effortless consumer distribution. No valid signing identity was available on this Mac.
4. Validate Windows and Intel runtime behavior before distributing those installers.

No public release or new payment/download site was launched. Read TEST_PLAN.md and HANDOFF.md for the exact verification boundaries.
