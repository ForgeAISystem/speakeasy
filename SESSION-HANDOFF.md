# SpeakEasy pickup

> Maintainer's machine log (Harsh's build Mac). Installing SpeakEasy anywhere else? Follow [INSTALL.md](INSTALL.md); nothing below describes your computer.

Read STATE.md for current artifacts and verification limits.

2026-10-12: v2.5.0 is built, tested, and packaged from a Wispr Flow teardown (docs/WISPR-TEARDOWN-2026-10-12.md). Installed 2026-10-12 22:10 on Harsh's go; engine ready on Parakeet v2 and Fn listener active. Rollback bundle and profile copy: dist/rollback-v242-20261012-221027/. Do not reinstall or rerun setup. A physical dictation check by Harsh is the remaining step.

77 tests pass. Packaged worker transcribed a real 114.7 s recording. Accuracy and cleanup numbers live in docs/verification/v2.5.0/ (aggregates only; never commit Harsh's audio or transcript text).

Do not handle Harsh's Anthropic key; he pastes it in Settings if he wants Polished. Do not launch a second SpeakEasy instance while his app runs: both would claim the Fn key.

Canonical remote: git@github.com:ForgeAISystem/speakeasy.git. Branch: main (v2.5.0 tagged and released to collaborators on Harsh's request, 2026-10-12). The repository is private. Harsh shares it with people who point their own agent at INSTALL.md. Do not change visibility without a separate request.
