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
| `dictation` | `phase`, `words` (`minWords`), `text` (`textHas`), `handsFree` | a dictation finished or was cancelled |
| `globe` | `fixed` | the fn emoji fix was applied |
| `pad-peek` | none | the cheat sheet opened (mic key held, or / on the pad) |
| `pad-starter` | `goal` | the owner answered "What do you want the pad for?" |
| `pad-tip` | `region` | a faster-way tip showed after a window was moved by hand |
| `layout-restore` | `ok`, `source` (`pad`, `voice`, `monitor`) | a saved layout or screen snapshot was put back |

`plan` also carries `via`: `local`, `claude`, `suggest` (a "Did you mean...?" guess) or `none`. `voice-step` carries `do` values `save_layout` and `restore_windows` too.

## Unlocks

A lesson may list `unlocks: ['Q', ...]`. On a starter pad those keys open once every step of the lesson is done (`src/main/pad-coach.js`). A lesson must only ask for keys that are open by the time it runs: the starter keys (A, D, S plus the goal key) or keys an earlier lesson unlocks. `tests/pad-coach.test.js` checks that all 16 keys are covered.

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
