# Security and privacy review

Date: 2026-09-06. Scope: changes for onboarding, installation, and Fn input.

- Speech recognition remains local. No account, telemetry, new cloud endpoint, or new runtime network dependency was added.
- Voice packs download from the existing sherpa-onnx GitHub model URLs. Download failure stays recoverable in setup.
- The native helper observes Fn transitions and Escape through a macOS event tap. It emits only `ready`, `down`, `up`, `cancel`, and permission failure messages. It does not emit ordinary keystrokes or typed text. It exits if its parent disappears.
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
