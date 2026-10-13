# Wispr Flow teardown and the v2.5 build

Reviewed 2026-10-12 on Harsh's Mac, where Wispr Flow 1.6.957 is installed and holds 450,802 words of his dictation (about 52 hours at 161 words a minute). The goal: find out why Wispr feels more accurate than SpeakEasy, then close the gap without giving up local speech.

## How the review was done

- Read the installed bundle's structure: Info.plist, entitlements, helper apps, frameworks, and the names of its database migrations.
- Read Harsh's own local Wispr data, read-only: settings names, the dictionary, and history rows pairing raw recognizer text with final text. Six history rows still had audio.
- Measured SpeakEasy's engines on that audio, and SpeakEasy's cleanup on 722 text pairs.

Wispr's JavaScript, prompts, and assets were not extracted or copied. Everything below is behavior and structure that anyone can observe on their own Mac. No audio or transcript text from Harsh is committed.

## What Wispr is under the hood

| Part | What it does |
|---|---|
| Electron shell | The app window, flow bar, history, notes, settings. |
| Swift helper app | Native work Electron cannot do well. Ships MediaRemote (pauses or ducks media during dictation) and a floating permission guide. |
| Accessibility inspector | Reads the focused text field. History stores the text around the cursor (`textboxContents`, `axText`, `axHTML`), the app, and the URL. This is how it spells names already on screen. |
| Cloud recognition and cloud formatting | Raw recognizer text and final formatted text are stored side by side, with fallback recognizers and divergence scores. |
| Learning loop | After a paste it watches the field (`editedText`, `editDistanceToDictated`). Dictionary entries carry a source: 28 of Harsh's 37 were learned from his own edits. |
| Local SQLite | History, dictionary, snippets, notes, meetings, calendar, links, per-app stats. Recent migrations add a meeting notetaker and a "polish" rewrite command with named prompts and shortcut keys. |

## What actually makes Wispr feel accurate

Measured on Harsh's six recordings (581 words), against Wispr's own raw recognizer text:

| Engine | Word error rate |
|---|---|
| Moonshine Base (SpeakEasy default until now) | 6.7% |
| Parakeet 0.6B v2 (already in SpeakEasy) | 5.2% |
| Apple SpeechAnalyzer, macOS 26 | 10.3% |

1. The engine matters, but less than it seems. Parakeet makes 22% fewer errors than Moonshine on Harsh's voice and is now the English default.
2. Names are where every engine breaks ("Bella Vita" became "beloveda" and "velveta" on Moonshine).
3. Most of the felt difference is formatting. Wispr's final text differs from its own raw recognizer text by 23.3% of words. Beyond punctuation, it removes verbal tics: "like" 462 times and "you know" about 250 times across 400 dictations.

Tested and rejected, with numbers in `verification/v2.5.0/accuracy-check.json`:

- Turning off Chrome's noise suppression, echo cancellation, and auto gain: no change.
- Parakeet hotwords (beam-search biasing toward dictionary words): no gain on names, worse punctuation.
- Apple's on-device recognizer and its vocabulary hints: double the errors.

## Shipped in v2.5

| Wispr capability | SpeakEasy v2.5 |
|---|---|
| Accurate recognition | Parakeet is the English default and the onboarding choice. Existing installs with Parakeet downloaded switch once. |
| Formatter removes tics | Clean mode removes "you know", comma-set "like", "basically like", "so yeah", and stutters. Each rule was kept only if it moved output closer to Wispr's final text across 722 dictations without changing meaning: 23.3% to 21.7% distance. Rules that hurt were dropped. |
| Spoken punctuation | "question mark", "exclamation point", "new line", "new paragraph", and "scratch that" work locally. |
| Fast finish on long dictation | Speech is transcribed in quiet-point segments while the speaker keeps talking: 30 to 40 s for Parakeet (same accuracy as one pass), 20 to 28 s for Moonshine and Whisper. Release waits only for the tail. |
| Context-aware formatting | Polished mode tells the AI which app is receiving the text and its style (AI prompt, email, chat, code). The window title picks the style locally and is never sent. |
| Dictionary spellings | Dictionary words go to the AI as spelling hints. A saved "Bella Vita" also fixes "bellavita" and "bella-vita", and leaves domains like go.bellavita.dance alone. |
| Per-app style | Chat apps get a single sentence without a final period. |
| Mute media while dictating | Optional, off by default. Restores only what SpeakEasy muted. |
| Switching from Wispr | One-click import of the Wispr dictionary and snippets (Harsh: 33 words, 1 snippet). Wispr's own sample entries are skipped. |
| Cloud cleanup | Claude cleanup moves to Claude Haiku 5.5 through the official SDK: about a tenth of the old token price, thinking off for speed. Long dictations are cleaned in parallel parts. An AI reply that loses or adds many words (it answered instead of cleaning) is discarded for the local text. |

## Next, ranked by expected value

1. Text near the cursor as context (Accessibility). Wispr's biggest accuracy lever for names already on screen. Needs a privacy model: skip password and secure fields, keep it local unless Polished is on.
2. Learn from edits. Watch the field for a few seconds after a paste and propose dictionary words from corrections, like Wispr's `user_edits` source.
3. Command mode. Select text, hold a second shortcut, say "make this shorter", and replace the selection.
4. On-device AI cleanup through Apple Intelligence (FoundationModels). Builds on this Mac's SDK; Apple Intelligence is switched off here, so it was not tested. Its 4,096-token window limits it to short dictations.
5. Faster microphone start. SpeakEasy opens a new stream on each press; keeping the audio graph warm for a minute after dictation would protect the first word.
