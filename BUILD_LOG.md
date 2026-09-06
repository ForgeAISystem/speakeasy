# Build log

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
