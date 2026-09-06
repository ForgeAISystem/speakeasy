# SpeakEasy pickup

Read STATE.md for current artifacts and verification limits.

2026-09-06: v2.4.2 is installed and running in Applications after Harsh explicitly approved one install/restart. It includes v2.4.1 window controls and indicator, capture, Fn listener, and worker recovery fixes. All six live readiness checks report Ready. Personal settings/history/stats/dictionary/snippets survived unchanged. Do not repeat installation or first-run setup.

Harsh confirmed “Indicator appeared and words pasted.” He then reported incorrect transcription and asked about a higher-accuracy model. Moonshine Base is currently selected. Parakeet v2 was downloaded and smoke-tested (81/80 ms decode, 1843 MiB worker RSS), but is not active yet. Primary-language preference was requested and remains pending. Native advanced-control activation was unreliable; do not overwrite cached settings behind the running app. Use the normal Settings > Voice models > Parakeet > Use action. See docs/MODEL-ACCURACY-2026-09-06.md. Multi-monitor drag/resize and broader app acceptance remain.

64 tests pass; 22 hidden main-window fixtures and five indicator fixtures pass. The real Moonshine engine passed a generated-speech check before and after worker restart. Package, installed archive/helper, and DMG checks pass. Evidence: docs/verification/v2.4.2/.

Avoid taking focus or repeated launches while Harsh works. Installer: dist/SpeakEasy-2.4.2-arm64.dmg. Previous app backup: dist/rollback-v240-_68t_mt7/SpeakEasy.app. No new OS permission or security setting was changed.

Canonical remote: git@github.com:ForgeAISystem/speakeasy.git. Branch: codex/speakeasy-easy-start. The repository is private. Do not change visibility or publish a release without a separate request.
