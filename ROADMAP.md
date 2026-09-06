# SpeakEasy Roadmap

Product reference: Wispr Flow and Glaido, researched September 6, 2026. Keep local speech, no account, and an offline default. See docs/COMPETITOR-RESEARCH-2026-09-06.md.

## Added in v2.4 (local review build)

- Original ImageGen glass artwork, shared warm palette, subtle pointer depth, and an explicit motion preference.
- Original / Clean / Polished cleanup modes with provider fallback and preserved spoken commands.
- Date-grouped history, search of original and final text, attention filters, compare/copy original, and Cmd/Ctrl+F.
- Editable dictionary and multiline snippets with duplicate prevention.
- Recording indicator with real stages and no idle animation loop.
- Native Quit fixed; window close continues to hide.

## Added in v2.3 (local review build)

- Welcome plus four guided steps: access, offline voice, shortcut, first dictation.
- Applications install action on packaged Mac builds; no source setup for end users.
- Native Fn / Globe support on Mac, with Right Option fallback and a real key check.
- Completion gated on an actual successful dictation and paste, checked in renderer and main process.
- Quiet home screen, advanced model/AI settings disclosure, semantic navigation, focus states, reduced motion.
- Microphone cancellation race fix and final partial audio chunk flushing.
- See STATE.md for current evidence and release blockers.

## Shipped in v2.0

- Hold-to-talk + double-tap hands-free + Esc cancel (Wispr's exact interaction model)
- Flow bar overlay: live waveform while listening, computing state, word-count done state, start/stop/done sounds
- Clipboard paste insertion with clipboard restore (same mechanism Wispr uses on Mac)
- Paste-last-transcript shortcut (Cmd+Ctrl+V / Shift+Alt+Z, Wispr's defaults)
- 100% local ASR: Moonshine Base, Parakeet 0.6B v2, Whisper Base/Small via sherpa-onnx
- In-app model download with progress, model switching, model deletion
- Filler-word removal (rule-based, instant, offline)
- Personal dictionary with misspelling corrections (Wispr: Dictionary + replacement rules)
- Snippets: voice-triggered text expansion (Wispr: Snippets)
- History with search, copy, delete, clear (local only)
- Stats: words today/week/all-time, speaking WPM, x-faster-than-typing, time saved, daily streak (Wispr: Insights)
- Optional AI polish pass via Ollama (local) or Claude API (text only): self-corrections ("2pm actually 3pm" = Backtrack), list formatting
- Onboarding: permissions walkthrough, model choice, live test box
- Menu bar / tray presence with recording state, launch at login

## Next (parity gaps worth closing)

- **Per-app tone matching** (Wispr "Styles"): detect frontmost app (already captured in history) and pass an app-category tone hint to the polish prompt. Casual in Slack/iMessage, formal in Mail/Gmail. Trailing-period removal in messaging apps.
- **Auto-learn dictionary**: when the user edits pasted text right after dictation, diff and propose a dictionary entry (Wispr's sparkle entries)
- **In-place correction undo**: original comparison/copy now exists; replacing text in an external app needs safe target tracking.
- **Streaming preview**: show words appearing in the flow bar while still speaking (sherpa-onnx streaming models or chunked decode)
- **VAD auto-stop** in hands-free mode (Silero VAD via sherpa-onnx, stop after N seconds of silence)
- **Custom hotkey capture UI** (record any key/combo including mouse buttons 4/5) (Fn-key support is now implemented on Mac)
- **Whisper mode tuning**: gain boost + model prompt for whispered speech
- **Command mode**: select text anywhere, hold a second hotkey, speak an instruction ("make this more concise"), replace selection via the polish LLM
- **Scratchpad**: tiny floating notepad window for capturing thoughts without a target app
- **Windows validation pass**: injection (SendKeys), tray, installer signing
- **App icons**: proper icns/ico, menu-bar template icon polish
- **Auto-updates**: electron-updater + GitHub Releases

## Explicitly not doing

- Accounts, login, cloud sync, telemetry, leaderboards
- Sending audio anywhere, ever
