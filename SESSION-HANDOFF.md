# SpeakEasy pickup

Read STATE.md for current artifacts and verification limits.

2026-10-12: v2.5.0 is built, tested, and packaged from a Wispr Flow teardown (docs/WISPR-TEARDOWN-2026-10-12.md). It is NOT installed: Applications still runs v2.4.2 with Moonshine. Install only on Harsh's go, since it replaces the running app. First launch switches the model to Parakeet v2 once (already downloaded).

77 tests pass. Packaged worker transcribed a real 114.7 s recording. Accuracy and cleanup numbers live in docs/verification/v2.5.0/ (aggregates only; never commit Harsh's audio or transcript text).

Do not handle Harsh's Anthropic key; he pastes it in Settings if he wants Polished. Do not launch a second SpeakEasy instance while his app runs: both would claim the Fn key.

Canonical remote: git@github.com:ForgeAISystem/speakeasy.git. Branch: codex/speakeasy-easy-start. The repository is private. Do not change visibility or publish a release without a separate request.
