# Glaido and Wispr Flow: what they shipped, what SpeakEasy should build

Oct 18, 2026. "Glido" is Glaido (glaido.com), a dictation app launched May 2026 as a Wispr Flow rival.

**Method.** Public pages only: product sites, Wispr Flow's monthly "What's new" roundups, and reviews. No app was decompiled. Copying their code would infringe their copyright and break their terms, and it would put SpeakEasy at risk once it is shared. We learn what they do, then build our own.

## What they shipped

### Wispr Flow (Mar to Oct 2026, from [wisprflow.ai/whats-new](https://wisprflow.ai/whats-new))

| Area | Feature |
|---|---|
| Accuracy | Canto, their own speech model (Sep 17). One formatting model for everyone, A/B tested (Jun). |
| Cleanup | Auto Cleanup with four levels (None, Light, Medium, High) and **Undo AI edit** (Apr). |
| Rewrite | **Transforms**: select text, rewrite it with AI. Built-in Polish and Prompt Engineer, plus your own (May). |
| Capture | **Scratchpad**: floating notepad on Option+S, syncs to iPhone (May). |
| Coders | **Terminal-friendly dictation** for Claude Code and Codex (May). |
| Input | **Mouse Flow**: dictate and send with a mouse button (Mar). Rebindable cancel and Enter keys. Optional hands-free shortcut (Aug). |
| Mics | Automatic mic ranking with fallback, clamshell switches to the external mic (Jun). Virtual mics like Krisp (Aug). **No sound detected** warning (Oct). |
| History | **Audio playback** for the last 14 days (Aug). Inline retry. Recovery after quitting. |
| Motivation | **Insights**: usage, "your voice", leaderboard, shareable cards (Apr). Team leaderboard (Jul). |
| Snippets | Rich text snippets (Jul). Dictionary starring and usage ranking (Mar). |
| Privacy | Local storage options: keep, delete after 24 hours, never store (Apr). |
| Beyond dictation | Notetaker for meetings on Mac (Aug) and Windows (Sep), with MCP connections. |
| Sessions | Dictations up to 20 minutes, language picker in the bar (Mar). |

### Glaido ([glaido.com](https://glaido.com/), [FAQ](https://glaido.com/faq), [Spokenly review](https://spokenly.app/blog/glaido-review), a competitor's review)

| Area | Feature |
|---|---|
| Commands | **Command mode, free**: select text, hold a command key, say an instruction. Or start a dictation with "Glaido". |
| Built-in commands (beta) | Web search, read the page, summarize a YouTube video, deep research, math and dates, open files and apps, **search your own history**, search docs. |
| Tools | **Custom MCP tools** (beta) that your coding agent builds and you import. |
| Style | Per-app and per-site rules, a custom prompt up to 500 characters, styles (Standard, Casual, Lowercase, Raw). |
| Snippets | Tags like clipboard and date inside snippets. Imports the Wispr dictionary. |
| Motivation | Dashboard with time saved, words per minute, day streak. |
| Keys | Fn to hold, Fn+Space for hands-free, separate command key. |
| Weak spots | Cloud only, no offline. $20 a month. 10-minute cap. 100-item history. No phone apps. |

## Where SpeakEasy already wins

- **Offline and free.** Parakeet runs on the Mac. Neither rival works without the cloud.
- **The Control Pad.** Neither rival moves windows, restores workflows, or records the screen.
- **Voice commands that act on the Mac,** with the plan shown first and Return to confirm.
- **Walkthroughs with real-action checks.** Wispr has tours; nobody checks that you did it.
- **15-minute dictations** with live decoding, and audio that survives a crash.

## Ranked: what to build next

Ranked by Harsh's daily use first (Claude Code all day, many apps, voice-first), then by effort. S = an afternoon, M = a day or two, L = a week.

| # | Build | Learned from | Why it matters for Harsh | Effort |
|---|---|---|---|---|
| 1 | **Terminal mode.** In Terminal, iTerm, Warp and Claude Code: no trailing period, straight quotes, "new line" as Shift+Return, never auto-send. | Wispr (May) | He talks to Claude Code more than to people. Wrong quotes and stray periods break commands. | S |
| 2 | **Rewrite what I selected.** Select text, hold fn+Shift (or say "Hey computer, make this shorter"), speak the edit. Built-ins: Polish, Shorter, Bullets, Prompt Engineer, Translate. Your own ones in Settings. Uses Claude when a key is set, Ollama otherwise. | Wispr Transforms, Glaido command mode | Edits by voice without retyping. Both rivals sell this as a headline feature. | M |
| 3 | **Undo AI edit.** One key puts back the exact words you said in place of the cleaned version. | Wispr (Apr) | Cleanup will sometimes guess wrong. One key fixes it, so he trusts Clean and Polished. | S |
| 4 | **Search my history by voice.** "Hey computer, what did I say about the Legacy invoices?" Answers from local History, shows the matching dictations, pastes one on Return. | Glaido | His spoken thinking becomes searchable memory, fully offline. | S to M |
| 5 | **Web and page commands.** "Search the web for...", "summarize this page", "summarize this YouTube video". Search opens the browser locally. Summaries use Claude only with a key. | Glaido | Turns the pad and voice layer into a research assistant. | M |
| 6 | **Scratchpad.** Option+S opens a floating note. Dictate thoughts there, then send the note to any app with one key. | Wispr | A parking spot for half-formed ideas while he works. | M |
| 7 | **Mic you can trust.** Rank mics, fall back automatically, switch to the external mic in clamshell, warn after 2 seconds of silence. | Wispr (Jun, Oct) | The top dictation failure is a silent wrong mic. SpeakEasy waits 10 seconds today. | S |
| 8 | **Insights and streak.** Words per minute, day streak, time saved this week, a shareable card. Feeds the Learn tab levels. | Wispr, Glaido | Progress you can see keeps the habit. It ties into the walkthrough challenges. | S |
| 9 | **Per-app rules you control.** A list of apps with a style and a short custom prompt for each, plus site rules for Chrome tabs. | Glaido | Today style is automatic. He can make Slack casual and client email formal. | S to M |
| 10 | **Smart snippet tags.** {clipboard}, {date}, {time}, {selection} inside snippets. Rich text snippets. | Glaido, Wispr | Templates like "Meeting notes for {date}" in one phrase. | S |
| 11 | **Keep audio for 14 days (opt in).** Play any dictation back from History. | Wispr (Aug) | Check what he really said when a transcript looks off. Off by default for privacy. | S |
| 12 | **Mouse Flow.** Hold a side mouse button to dictate; click to send. | Wispr (Mar) | Dictate without reaching for the keyboard. | S |
| 13 | **MCP tools for voice commands.** Let the voice planner call local MCP tools (the Forge Command Center, Hudson and Legacy hubs). "Hey computer, what are today's open loops?" | Glaido (beta) | The bridge from SpeakEasy to the Company Answer System. Big, and the most Forge-specific. | L |

Not recommended now: a meeting notetaker (Circleback already covers Harsh's calls), phone apps, team leaderboards, and our own speech model (Parakeet already wins on his voice).

## Already queued in another session

Hold-to-peek cheat sheet, starter pad, faster-path hints, forgiving voice commands, restore after a monitor reconnects. Those come from docs/RESEARCH-2026-10-18.md and do not overlap the list above.

## Every item ships with a walkthrough

Per docs/GUIDES.md: each build above adds its lesson and a challenge task. Example for #2: "Select a paragraph in Notes. Hold fn and Shift. Say: make this shorter." The check fires on a successful rewrite.
