# Walkthroughs: the rule and how to write one

Every user-facing feature ships with a walkthrough. No guide, no release. The owner and every customer should open an update, see what is new, practice it in their own apps, and prove they can do it.

## What a guide has

A guide lives in `src/shared/guides.js` and has four parts.

1. **whatsNew**: one line per new thing, in plain words. These lines show in the What's new screen after an update and on the Learn tab.
2. **lessons**: short groups of steps. Each step has:
   - `do`: one instruction, one action. "Open the pad and press D."
   - `hint`: why it matters or what to try if it fails.
   - `check`: the app event that proves the user did it. A step never finishes on a click of Next.
   - optional `action`: a button that takes the user where they need to be (`tab:settings`, `tab:pad`).
   - optional `doneIf`: a precheck that finishes the step on its own when it is already true.
3. **challenge**: three to five goals with no instructions, done in any order, timed. Levels come from `levels` (seconds to reach Pro, then Operator; slower is Learner). The best time is kept.
4. **version**: the release that first shipped the feature. The What's new screen shows every guide newer than the version the user last saw.

## Checks

A check is `{ event, ...fields }`. It matches one event from `toGuideEvent()` in `src/main/guide.js`.

| event | fields | comes from |
|---|---|---|
| `pad-open` | none | the Control Pad opened |
| `pad` | `key`, `ok`, `source` | a pad pressed by key or click |
| `pad-save` | `key`, `ok` | Shift+key saved a workflow |
| `pad-set` | `key` | a pad remapped in the Pad tab |
| `plan` | `steps` (use `minSteps`), `wake`, `via` | a voice command was planned |
| `voice-step` | `do`, `ok` | one step of a voice command ran |
| `camera` | `on` | camera bubble shown or hidden |
| `dictation` | `phase`, `words` (`minWords`), `text` (`textHas`), `handsFree`, `terminal` | a dictation finished or was cancelled; `terminal` is true when terminal mode formatted it |
| `rewrite` | `ok`, `via` (`shift` or `voice`), `transform` | a selection was rewritten (fn+Shift, or "Hey computer, make this shorter") |
| `undo` | `ok`, `kind` (`dictation` or `rewrite`) | Undo AI edit ran |
| `history-search` | `found`, `wake` | "what did I say about X" showed results on the pad |
| `history-paste` | `ok` | a history result was pasted from the pad |
| `globe` | `fixed` | the fn emoji fix was applied |

A new feature that has no event yet adds one: emit it through `push()` in `src/main/index.js` and map it in `toGuideEvent()`.

## Writing rules

- One action per step. If a step says "and", split it.
- Practice in real apps. The coach floats on top; the main window hides.
- Hormozi nine rules apply: simple words, present tense, active voice, short lines, no adverbs.
- Order lessons from first win to power move. The first step should succeed in under ten seconds.
- The challenge reuses the lesson skills with no hints. Pick limits a practiced user beats.

## Checklist for a release

- [ ] Guide added or updated in `src/shared/guides.js` with the new version.
- [ ] Every check has an event the app really emits (add one if not).
- [ ] `npm test` passes (`tests/guide.test.js` checks every guide is well formed).
- [ ] The offscreen visual script renders the coach and Learn tab without overflow.
- [ ] Walk the guide once yourself in the installed app.
