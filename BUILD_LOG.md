# Build log

## 2026-10-18: v2.9.0 edit by voice

- From docs/COMPETITORS-2026-10-18.md (public pages only; nothing decompiled): build #1 to #4, ranked by Harsh's day in Claude Code. Branch feat/voice-edit in its own worktree so the pad-teaching session keeps ~/speakeasy.
- Terminal mode (src/main/terminal.js): front app Terminal, iTerm2, Warp, Ghostty, kitty, Alacritty, WezTerm, Hyper, Tabby, or a window titled "Claude Code" / "✳". Straight quotes, no final period per line, and the injector pastes line by line with Shift+Return between lines, so a dictation never presses Return. Pad prompts, history pastes and paste-last follow the same rule. Settings switch, on by default.
- Rewrite what I selected (src/main/rewrite.js): fn+Shift (the Fn helper now reports Shift; the hotkey manager records it) or "Hey computer, make this shorter" (window commands like "make this full screen" stay commands). Waits for Shift up, copies with Cmd+C and restores the clipboard, picks a transform (yours first, then Translate, Prompt Engineer, Bullets, Shorter, Polish, else the words as the instruction), runs Claude with a key or Ollama without, shows "Shorter · 64 → 22 words" and a preview in the bar, pastes over the selection, saves a History row tagged with the transform.
- Undo AI edit: Control+Command+Z. Text fields: Cmd+Z, then the raw transcript (a rewrite just gets Cmd+Z). Terminals: Backspace for the pasted length, then the raw words. Refused in another app, after 10 minutes, or when the paste was word for word.
- History search (src/main/history-search.js): "what did I say about X", "search my history for X". Stemmed whole-word scoring, most topic words required, phrase bonus, recency. Results on the pad with Up/Down, Return or click pastes. Fully local.
- Walkthrough "Edit by voice" (v2.9.0): 7 steps that check real events (terminal dictation, terminal new line, rewrite by Shift and by voice, undo, search, paste) and a 4-task timed challenge. New guide events: rewrite, undo, history-search, history-paste, dictation.terminal.
- 128 tests pass (21 new). Offscreen: 31 screens, 8 indicator states (3 new rewrite states), pad plan and history results, 6 coach states. Package check: 57 source files, both helpers, version 2.9.0. DMG dist/SpeakEasy-2.9.0-arm64.dmg, SHA-256 47e2964c8398cf7c832b214206a99b4063f995f018cc1a46cc861c394baf83f4. Not installed.
- Not verified from the agent shell: a physical fn+Shift press, real Cmd+C / Cmd+Z / Shift+Return in other apps, a rewrite through Claude with a real key or a running Ollama, the search paste into a live app.

## 2026-10-18: v2.8.0 walkthroughs

- Harsh: "whenever we add a feature there's a complete walkthrough... then test my competency." Built the guide system and made it a release rule (docs/GUIDES.md, CLAUDE.md).
- Guides are data (src/shared/guides.js): what's new lines, lessons whose steps finish only on a matching app event, a timed challenge. GuideRunner (src/main/guide.js) gets every push() event; auto-completes steps that are already true (the fn fix); keeps progress and best times in guide.json.
- Coach panel (src/coach/): non-activating, always on top, top right. Waiting pulse, green check, Back/Skip, action buttons that open the right tab; challenge mode with live timer and checklist; result card with level and best time.
- Main window: Learn tab (progress, NEW chips, Keep going, best level), What's new dialog once per update, sidebar dot while a new guide is untouched.
- Hotkey now records whether the last dictation was hands-free; pad open, saves, voice steps, pad remaps and the fn fix emit events for checks.
- 107 tests pass (10 new). Offscreen: 29 screens, What's new, Learn, 4 coach states, pad, plan. Package check: 54 files. DMG dist/SpeakEasy-2.8.0-arm64.dmg. Not installed yet.
- Research (docs/RESEARCH-2026-10-18.md, HN-heavy since Reddit blocked fetches; onboarding numbers mostly from tool vendors): read-only tutorials give no gain, short launcher-started tours finish twice as often, about 40% of modals are closed on sight. Changed What's new from a dialog to a Home card that stays until answered. Remaining ranked ideas (hold-to-peek cheat sheet, starter pad, nudges at the moment of use, forgiving voice, monitor-change restore) are next.

## 2026-10-18: v2.7.0 voice commands

- Harsh: "just say, hey, do this on my computer" and teach the pad by voice. Built on v2.6 (branch feat/voice-commands from feat/window-pad-globe-fix).
- Two ways in: hold fn while the pad is open, or start any dictation with "Hey computer" / "Hey SpeakEasy". The transcript is never pasted; it becomes a plan shown on the pad.
- Offline planner first (window moves by app name with borrowed verbs, open apps and links, workflows and prompts by pad name, record, camera, key combos, Shortcuts, and "make pad 3 open ..." teaching). Claude plans the rest only with a key, through one forced tool; every step is re-checked locally. Typing, pasting and Shortcuts wait for Return; Esc drops the plan.
- Pad tab: Voice commands switch, how-to card with examples, and heard requests in the live log. Overlay pill: "Working it out", then the plan summary.
- 97 tests pass (11 new: wake words, offline plans, teaching, validation against unsafe steps, confirm rules, Claude request shape and step filtering, no-key and failure paths, plan runs and Return/Esc on the pad, Pad tab voice card). Offscreen: 26 screens, 5 indicator states, floating pad and plan view pass. Package check: 46 files, both helpers. DMG dist/SpeakEasy-2.7.0-arm64.dmg.
- Installed on Harsh's go ("I'm not dictating"): quit v2.5.0 normally, moved it and a profile JSON copy to dist/rollback-v250-20261018-214803/, copied v2.7.0 into Applications (app.asar matches), launched through LaunchServices. Log: hotkey listener active, engine ready on parakeet-v2; the Fn helper runs with --mic. History count unchanged. No OS setting changed: the Globe-key Fix it button waits for Harsh.
- Not verified: a spoken command end to end, the mic key, window moves, camera, Claude planning with a real key.

## 2026-10-18: v2.6.0 Control Pad and fn emoji fix

- Harsh asked for a tap pad to stop dragging windows around, then widened it: a MacBook-as-MIDI-controller surface, a live view to watch and remap it, and quick screen recording with the camera. Also: double-tapping fn opened the emoji picker.
- Root cause of the emoji bug: macOS handles "Press Globe key to: Show Emoji & Symbols" before the session event tap, so the Fn helper's swallow cannot stop it. On Harsh's Mac AppleFnUsageType is unset (behaves as Show Emoji). Added a one-click Fix it (Home banner and Settings row) that sets it to Do Nothing and asks apps to reload keyboard settings, with Undo. Not applied by the agent; Harsh presses it.
- Control Pad: a 4x4 grid laid out on the keyboard (1-4, QWER, ASDF, ZXCV). Snap pads match screen position; the same pad twice moves the window to the next screen. Workflow pads save and restore every visible app window (launching apps that are closed). Other actions: open app, open link or folder, run a Shortcut, press a key combo, paste a prompt, record screen (Screenshot toolbar plus camera bubble), camera bubble. Opens from the mic key, Control+Option+P, or the menu bar.
- Pad tab: live device view that flashes on every hit with a running log, plus an editor for every pad.
- New native helper native/window.c (front, list, move). Camera usage description and entitlement added.
- 87 tests pass (8 new: pad model, frame math, key parsing, Globe fix and Undo, ControlPad snap/next screen/save/restore/guards against a fake helper, Pad tab and Globe UI). Offscreen check: 26 screens, 5 indicator states and the floating pad pass. Package check: 45 source files, both helpers, version, DMG hash. DMG dist/SpeakEasy-2.6.0-arm64.dmg.
- Not verified yet: a physical mic-key press (keycode 176 is the expected code), live window moves in the installed app, the camera bubble and the recorder toolbar. The installed app is still v2.5.0; install waits on Harsh so his running dictation is not cut off.

## 2026-10-12: v2.5.0 Wispr Flow teardown build

- Studied Wispr Flow 1.6.957 on Harsh's Mac: bundle structure, entitlements, helper apps, migration names, and Harsh's own local data read-only. No Wispr code, prompts, or assets were extracted or copied. Write-up: docs/WISPR-TEARDOWN-2026-10-12.md.
- Built an answer key from six real recordings Wispr had kept (241.6 s): Parakeet v2 5.2% WER, Moonshine 6.7%, Apple SpeechAnalyzer 10.3%. Ruled out Chrome audio processing (fake-mic replay, no change) and Parakeet hotwords (no gain).
- Made Parakeet the English default (onboarding and a one-time switch when installed). Added measured disfluency rules, spoken punctuation, "scratch that", vocabulary variants, chat-app period rule, and app-aware AI style. Clean moved from 23.1% to 21.7% distance to Wispr's final text over 722 dictations; harmful candidate rules were dropped.
- Added live decoding: quiet-point segments transcribed during recording (Parakeet 30-40 s, others 20-28 s), joined with the tail on release. Shared the quiet-point search between main and worker.
- Moved Claude cleanup to the official Anthropic SDK on Haiku 5.5 (thinking off, low effort, no sampling overrides), parallel sentence-aligned parts for long text, refusal handling, and a word-count guard against answers. Added Wispr dictionary/snippet import, optional mute while dictating, and front window context (title used locally only).
- 77 tests pass. 24 offscreen screens and 5 indicator states pass. Package check: 32 source files and helper match. Packaged worker transcribed a real recording. DMG built at low priority.
- Installed on Harsh's go: quit v2.4.2 normally, moved it plus a profile JSON copy to dist/rollback-v242-20261012-221027/, copied v2.5.0 into Applications (archive hash matches), launched through LaunchServices. Log: hotkey listener active, engine ready on parakeet-v2. History, stats, and window files unchanged; settings changed only by the planned one-time upgrade. No OS setting, permission, or the user's Anthropic key was touched.
- Shared with collaborators on Harsh's request: added INSTALL.md for anyone's agent (check, clone, build, install/update with data kept, launch through LaunchServices, verify), pointed CLAUDE.md at it, marked STATE/SESSION-HANDOFF as maintainer-only, refreshed README. Fresh clone from GitHub: npm ci and 77 tests pass (the installer build inside the fresh clone was blocked by session permissions; the same code built in the main checkout). Fast-forwarded main to v2.5 and tagged v2.5.0. CI run 38338393553 passed npm ci, 77 tests, and installer builds on macOS arm64, macOS Intel, and Windows, and published release v2.5.0 as Latest with all three installers.
- Token/cost totals were not available from this runtime.

## 2026-09-06: v2.4.2 dictation stability

- Reproduced and fixed four regressions: an old fade hiding a newer recording, indicator updates sent before renderer readiness, state lost after indicator recreation, and stale capture errors cancelling a newer recording.
- Added visible microphone-opening feedback, session-aware errors, a ten-second no-audio watchdog, recoverable received audio on capture failure, bounded renderer recovery, native Fn heartbeat/reset handling, and worker timeout/IPC/restart guards.
- Added Home connection checks, shortcut detection time, microphone-free indicator preview, explicit repair while idle, and accurate sidebar recording/processing/error states.
- 64 tests pass. Twenty-two hidden main-window fixtures and five indicator states pass. Generated speech through the real local Moonshine engine passed before and after worker restart. Package source/helper match and DMG checksum verified.
- Built at lower scheduling priority. After Harsh approved “Install and check it now,” quit v2.4.0 normally, preserved it, installed v2.4.2 once, and relaunched. Installed archive/helper match; personal settings/history/stats/dictionary/snippets were unchanged.
- Live app reports Ready to dictate and all six readiness checks Ready. Harsh confirmed “Indicator appeared and words pasted.” He then reported recognition errors with Moonshine; higher-accuracy model selection is the follow-up. No OS permission changed and no whole-computer performance improvement is claimed.
- This install includes the previously staged v2.4.1 window improvements. Evidence: docs/verification/v2.4.2/.
- Token/cost totals were not available from this runtime.

Accuracy follow-up: after confirming the indicator/paste path, Harsh reported recognition errors. Researched NVIDIA Parakeet v2/v3 and Whisper Turbo from primary sources, prepared the already-supported Parakeet v2 model, and checked real decoding before/after worker restart (81/80 ms for generated 3.675625-second speech, 1843 MiB worker RSS). No new app restart or active-model change. Language preference and real-voice comparison remain pending; see docs/MODEL-ACCURACY-2026-09-06.md.

## 2026-09-06: v2.4.1 desktop usability

- Responded to Harsh's report that app activity was disrupting other work. Kept the installed app untouched, stopped native UI automation, ran one hidden/non-focusable/offscreen visual check, and built at lower scheduling priority.
- Restored the standard native title bar and window controls, reduced the minimum size from 760x560 to 560x480, and added compact navigation, forms, settings, and onboarding layouts.
- Saved normal window bounds in a separate window.json, debounced move/resize writes, restored minimized windows on explicit reopen, and clamped saved placement to connected work areas.
- Removed native desktop blur and skipped hidden onboarding readiness polling. The dictation engine, microphone capture, and shortcut behavior remain unchanged.
- 47 tests pass; 20 offscreen screens pass overflow/artwork checks. All 29 packaged source files and the native helper match, and the DMG checksum is valid.
- v2.4.1 is staged. v2.4.0 remains running in Applications because Harsh is actively working. A single install/restart awaits his chosen moment. No physical new-build drag/resize or live speech performance claim is made.
- Token/cost totals were not available from this runtime.

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

## 2026-09-06: v2.4 visual and functional refinement

- Researched current official Wispr Flow and Glaido pages; saved decisions and primary links in docs/COMPETITOR-RESEARCH-2026-09-06.md.
- Generated original amber/sage glass artwork through built-in ImageGen and bundled the 1.4 MB PNG. Recorded the final prompt in docs/IMAGEGEN.md.
- Added shallow pointer depth, quiet transitions, and a motion preference with system reduced-motion priority.
- Added explicit cleanup modes and safe fallback retaining spoken organize requests when optional AI is unavailable. Preserved original transcript comparison/copy and improved search, date grouping, attention filtering, and keyboard access.
- Added dictionary/snippet editing, duplicate prevention, and multiline snippet text.
- Reworked the overlay to report real stages, wait for microphone arming, and stop animation when idle/hidden.
- Native UI testing exposed the existing Cmd+Q interception. Fixed before-quit and verified a normal exit in the installed build.
- 39 tests pass. Nine Electron fixture screenshots passed overflow and artwork checks. Real installed welcome inspected separately. All 28 packaged source files and native helper match; DMG checksum passes.
- v2.4.0 installed in Applications. The previous bundle is preserved under dist/rollback-v23-uo435ciu/SpeakEasy.app. Personal profile files were not altered by the upgrade.
- The old temporary engine fixture was no longer present for rerun; the prior v2.3 engine sample remains historical evidence. This pass does not claim a new physical microphone test or a speech accuracy benchmark.
- Token/cost totals were not available from this runtime.
