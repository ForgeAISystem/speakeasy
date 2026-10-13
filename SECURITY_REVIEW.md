# Security and privacy review

Date: 2026-09-06. Scope: changes for onboarding, installation, and Fn input.

- Speech recognition remains local. No account, telemetry, new cloud endpoint, or new runtime network dependency was added.
- Voice packs download from the existing sherpa-onnx GitHub model URLs. Download failure stays recoverable in setup.
- The native helper observes Fn transitions and Escape through a macOS event tap. It emits readiness, Fn down/up, cancellation, permission failure, heartbeat, and listener reset messages. It does not emit ordinary keystrokes or typed text. It exits if its parent disappears.
- Microphone and Accessibility changes remain explicit user actions. No OS permissions or Gatekeeper settings were silently changed by the implementation.
- Installation uses Electron's built-in Applications relocation. It is only exposed for packaged Mac apps outside Applications.
- Practice completion requires current permissions, a working engine and shortcut, and a successful practice dictation. The renderer additionally checks that the recognized words landed in the field.
- Audio safety copies exist on disk before transcription. They are deleted on success; failures are recoverable and old files are pruned after 14 days. The README now says this accurately.
- Optional Anthropic cleanup sends transcript text to Anthropic when enabled. It remains off by default. Existing API-key storage in local settings remains unchanged and is not a claim of encrypted storage.

Remaining distribution gate: no Developer ID identity was present, so the local installer is neither signed nor notarized. This review does not certify the entire pre-existing app or its dependencies.

## v2.4 additions

- Original/Clean cannot invoke a configured AI provider. Polished requires explicit selection or a previously configured provider. No provider is enabled automatically for new users.
- Original and cleaned transcripts share existing local history storage. Comparison/copy is non-destructive. Clear all now requires a second in-app click.
- Generated artwork is a bundled local image; the app makes no ImageGen requests at runtime. UI fixtures are outside the packaged file list and contain synthetic data only.
- Motion listens only to renderer pointer events. It adds no system input monitoring. OS permissions, privacy controls, and Gatekeeper were not changed.

## v2.4.2 additions

- Connection diagnostics expose readiness, dictation phase, an error message, and the last shortcut-event timestamp. The new status cache is in memory and contains no transcript or ordinary keyboard text. No network service, telemetry, or new OS permission was added.
- Preview records no audio. Repair refuses to run during active dictation and reconnects components under their existing permissions.
- On capture failure, received audio long enough for a recovery attempt is saved under the existing local WAV/history policy. Audio never received by the app cannot be recovered. Success cleanup and age-based pruning remain.
- Bounded renderer restarts and native-helper heartbeats do not expand the set of input events exported from the helper.
- The authorized bundle replacement preserved personal settings/history/stats/dictionary/snippets. No permission, Gatekeeper, or signing setting was changed.

## v2.5 additions (2026-10-12)

- Wispr import reads `~/Library/Application Support/Wispr Flow/flow.sqlite` with the system sqlite3 in immutable read-only mode, only when the user opens the Dictionary tab or presses Import. It reads the Dictionary table only and never writes to Wispr's files.
- Front window context: the app name and window title are read through System Events under the existing Accessibility permission. The title only picks a style category on the computer; it is never stored or sent. The app name is stored in History as before.
- Polished with Claude now sends, per request: the transcript, the app name with a style hint, and up to 100 dictionary words. Audio never leaves the computer. Calls use the official Anthropic SDK with a 20 s timeout and one retry. Polished stays opt-in and off by default.
- An AI reply that drops or adds many words is discarded for the local text, so a prompt-like dictation is not replaced by an answer.
- Mute while dictating is off by default, uses osascript volume commands, and only restores a mute it set itself, including on quit.
- New dependency: `@anthropic-ai/sdk` 0.133.0 (loaded only when Claude cleanup runs).
