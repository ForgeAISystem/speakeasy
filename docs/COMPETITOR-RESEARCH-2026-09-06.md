# Dictation research and v2.4 decisions

Reviewed 2026-09-06. “Gladio” was interpreted as **Glaido**, whose official website features the creators mentioned in the conversation's description. This review uses current official product pages and release notes, not a hands-on benchmark of competitor apps.

## What is useful here

| Observed product pattern | SpeakEasy decision |
| --- | --- |
| Wispr Flow exposes dictionary, snippets, adaptive writing styles, filler removal, and spoken corrections. | Keep the existing local vocabulary and shortcuts. Add in-place editing, duplicate checks, and multiline snippet authoring. [Features](https://wisprflow.ai/features) |
| Flow now offers cleanup intensity choices and access to the raw version in History. | Ship explicit Original, Clean, and Polished modes, plus comparison and copying of the original. Clean is deterministic and local. Polished requires a user-configured provider. [Release notes](https://wisprflow.ai/whats-new) |
| Glaido's July release adds date-grouped history search and emphasizes one key for hold and hands-free use. | Retain Fn behavior; improve existing search to include original text, group dates, add attention filters and Cmd/Ctrl+F. Make the recording indicator quieter and its states truthful. [July release](https://glaido.com/blog/july-2026-update-tools-beta-search-and-a-cleaner-app) |
| Glaido emphasizes permission/microphone setup, migration, and recovering interrupted dictations. | Retain v2.3's guided setup and existing audio recovery. Surface failed paste and cleanup fallback in History. Migration is a next candidate, not implemented here. [June release](https://glaido.com/blog/glaido-0-1-0-hotkeys-onboarding-and-rock-solid-reliability) |
| Both products promote formatting based on the app and surrounding text. | Defer automatic screen/context reading. It requires a deliberate privacy model, field exclusions, and target-app validation. Current SpeakEasy records the active app name but does not read surrounding text. [Flow context](https://docs.wisprflow.ai/articles/4678293671-Context-Awareness), [Glaido introduction](https://glaido.com/blog/introducing-glaido) |

## What makes this version distinct

Local speech recognition, no account, and an offline default. The artwork and visual identity are original. No competitor logos, screenshots, assets, or source code were copied.

The new Home puts the shortcut, cleanup choice, and latest transcript within easy reach. History owns the longer list. A small original glass-wave illustration adds depth; motion stops when unused or reduced motion is requested. The recording bar reports microphone opening, listening, transcription, optional AI polish, and completion without cycling through invented progress.

## Next useful upgrades

1. Signed and notarized installation plus an update channel, followed by clean-machine testing.
2. Import preview for dictionary/snippet exports, after verifying the actual file formats.
3. App-specific writing preferences with a local-first context strategy.
4. Only then consider selected-text transformations or Glaido-style agent actions. Those are broader product features than dictation.

## Limits

Original preserves the recognizer's text, not a guarantee of perfect verbatim speech recognition. Clean removes common English filler tokens and applies saved vocabulary/snippets; it does not infer self-corrections or reorganize prose. Polished can use Ollama locally or explicitly configured Anthropic text processing. Provider success and output quality still depend on the configured service/model.

Direct speech accuracy, dictation latency, CPU/RAM use, battery life, and clean-machine installation were not benchmarked against the competitors.
