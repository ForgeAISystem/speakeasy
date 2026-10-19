'use strict';

// Walkthroughs. Every user-facing feature ships with a guide here: what's new
// in one line each, lessons whose steps finish only when the app sees the user
// do the thing, and a challenge that proves it stuck. See docs/GUIDES.md.
//
// A step's check matches one app event: { event, ...fields }. Plain fields must
// be equal. minWords / minSteps / minWindows are lower bounds. textHas searches
// the dictated text.
//
// A lesson may list `unlocks`: keys on a starter pad that open once every step
// in that lesson is done (src/main/pad-coach.js).
(function (root) {
  const GUIDES = [
    {
      id: 'pad-coach',
      version: '2.9.0',
      title: 'Learn the pad as you go',
      tagline: 'The pad shows you what each key does.',
      whatsNew: [
        'Hold the mic key to see every key, its name, and what to say for it.',
        'A new pad starts with four keys. Each lesson you finish unlocks more.',
        'Move a window by hand and SpeakEasy shows you the faster way.'
      ],
      needs: ['control-pad'],
      lessons: [
        { title: 'Peek at your pad', steps: [
          { id: 'pk-hold', do: 'Hold the mic key (F5) for one second.', hint: 'Every key shows its name and the words that run it. Let go to close. No mic key? Open the pad and press /.', check: { event: 'pad-peek' } }
        ] },
        { title: 'Pick your starter keys', steps: [
          { id: 'st-pick', do: 'Open the pad. Pick what you want it for.', hint: 'You start with four keys. The Control Pad lessons unlock the rest. Want all 16 now? Pick Show all 16.', check: { event: 'pad-starter' }, doneIf: 'starterPicked' }
        ] },
        { title: 'The faster way', steps: [
          { id: 'fp-drag', do: 'Drag a window to the left half of the screen with your mouse.', hint: 'A tip shows the key and the words that do it for you. Tips stop once you use the fast way three times.', check: { event: 'pad-tip' } },
          { id: 'fp-fast', do: 'Now the fast way. Tap the mic key, then press A.', hint: 'One tap and one key. No dragging.', check: { event: 'pad', key: 'A', ok: true } }
        ] }
      ],
      challenge: {
        title: 'No looking',
        intro: 'Three jobs. Peek if you need to.',
        levels: [[30, 'Pro'], [60, 'Operator']],
        tasks: [
          { id: 'px-peek', goal: 'Open the cheat sheet', check: { event: 'pad-peek' } },
          { id: 'px-right', goal: 'Snap a window to the right half', check: { event: 'pad', key: 'D', ok: true } },
          { id: 'px-full', goal: 'Fill the screen with one window', check: { event: 'pad', key: 'S', ok: true } }
        ]
      }
    },
    {
      id: 'say-it-your-way',
      version: '2.9.0',
      title: 'Say it your way',
      tagline: 'Close enough is good enough.',
      whatsNew: [
        'The pad shows lines you can say, made from your own apps and pads.',
        'Say it close and SpeakEasy asks “Did you mean...?”. Press Return to run it.',
        'Say “save this layout as Morning” to keep your screen just as it is.',
        'Plug a monitor back in and SpeakEasy offers to put your windows back.'
      ],
      needs: ['voice-commands'],
      lessons: [
        { title: 'Say what you see', steps: [
          { id: 'sy-strip', do: 'Open the pad. Hold fn and say one line from “You can say”.', hint: 'The lines come from your own apps and pads. They change every few seconds.', check: { event: 'plan', minSteps: 1 } }
        ] },
        { title: 'Close enough', steps: [
          { id: 'sy-miss', do: 'Open the pad. Hold fn and say only “Chrome left”.', hint: 'SpeakEasy asks “Did you mean...?” and shows the words that work next time.', check: { event: 'plan', via: 'suggest' } },
          { id: 'sy-run', do: 'Press Return to run it.', hint: 'A guess always waits for Return. Esc cancels.', check: { event: 'voice-step', do: 'snap', ok: true } }
        ] },
        { title: 'Save your screen', steps: [
          { id: 'sy-save', do: 'Set up your windows. Open the pad, hold fn and say “save this layout as Morning”.', hint: 'Morning lands on a free workflow pad, 1 to 4.', check: { event: 'voice-step', do: 'save_layout', ok: true } },
          { id: 'sy-back', do: 'Move a window. Open the pad, hold fn and say “put Morning back”.', hint: 'Unplug a monitor and plug it back in: SpeakEasy offers to put your windows back. Press Return.', check: { event: 'layout-restore', ok: true } }
        ] }
      ],
      challenge: {
        title: 'Your words',
        intro: 'Four jobs, voice only. Any order.',
        levels: [[60, 'Pro'], [120, 'Operator']],
        tasks: [
          { id: 'sx-save', goal: 'Save your screen as a layout by voice', check: { event: 'voice-step', do: 'save_layout', ok: true } },
          { id: 'sx-back', goal: 'Bring a saved layout back', check: { event: 'layout-restore', ok: true } },
          { id: 'sx-guess', goal: 'Get a “Did you mean...?”', check: { event: 'plan', via: 'suggest' } },
          { id: 'sx-two', goal: 'Move two apps with one sentence', check: { event: 'plan', minSteps: 2 } }
        ]
      }
    },
    {
      id: 'voice-commands',
      version: '2.7.0',
      title: 'Talk to your computer',
      tagline: 'Say it and the pad does it.',
      whatsNew: [
        'Hold fn with the pad open and say what you want.',
        'Start any dictation with “Hey computer” to give a command.',
        'Teach a pad by voice: “make pad 3 open claude.ai”.'
      ],
      needs: ['control-pad'],
      lessons: [
        { title: 'Your first command', steps: [
          { id: 'vc-first', do: 'Open the pad. Hold fn and say “put Chrome on the left”. Let go.', hint: 'The pad shows what it heard and the steps it will run.', check: { event: 'plan', minSteps: 1 } },
          { id: 'vc-two', do: 'Now two at once. Open the pad, hold fn: “put Chrome on the left and Notes on the right”.', hint: 'Join commands with “and” or “then”.', check: { event: 'plan', minSteps: 2 } }
        ] },
        { title: 'No pad needed', steps: [
          { id: 'vc-wake', do: 'Close the pad. Hold fn and say “Hey computer, open Notes”.', hint: 'Starting with “Hey computer” turns any dictation into a command.', check: { event: 'plan', wake: true, minSteps: 1 } }
        ] },
        { title: 'Safe by design', steps: [
          { id: 'vc-confirm', do: 'Open the pad, hold fn and say “paste my starter prompt”. Read the plan, then press Return.', hint: 'Typing and pasting always wait for Return. Esc cancels.', check: { event: 'voice-step', do: 'pad', ok: true } }
        ] },
        { title: 'Teach it', steps: [
          { id: 'vc-teach', do: 'Open the pad, hold fn and say “make pad 3 open claude.ai”.', hint: 'Pad 3 lights up with its new job.', check: { event: 'voice-step', do: 'teach', ok: true } }
        ] }
      ],
      challenge: {
        title: 'Hands off the mouse',
        intro: 'Four jobs, voice only. Go as fast as you can.',
        levels: [[90, 'Pro'], [180, 'Operator']],
        tasks: [
          { id: 'vx-layout', goal: 'Set up two apps side by side with one sentence', check: { event: 'plan', minSteps: 2 } },
          { id: 'vx-link', goal: 'Open a website by voice', check: { event: 'voice-step', do: 'open_url', ok: true } },
          { id: 'vx-teach', goal: 'Teach any pad a new job by voice', check: { event: 'voice-step', do: 'teach', ok: true } },
          { id: 'vx-rec', goal: 'Start a screen recording by voice', check: { event: 'voice-step', do: 'record', ok: true } }
        ]
      }
    },
    {
      id: 'control-pad',
      version: '2.6.0',
      title: 'The Control Pad',
      tagline: 'Your keyboard is a drum pad.',
      whatsNew: [
        'Tap the mic key, then a key, to snap any window into place.',
        'Save your whole setup to a pad and bring it back in one tap.',
        'Record your screen with a camera bubble from the pad.',
        'One click stops fn from opening the emoji picker.'
      ],
      lessons: [
        { title: 'Stop the emoji picker', steps: [
          { id: 'cp-globe', do: 'In Settings, click Fix it next to “Emoji picker on fn”.', hint: 'fn will only dictate. Undo sits right there if you want it back.', check: { event: 'globe', fixed: true }, action: { label: 'Open Settings', run: 'tab:settings' }, doneIf: 'globeFixed' }
        ] },
        { title: 'Snap windows', unlocks: ['Q', 'W', 'E', 'Z', 'X', 'C', '1'], steps: [
          { id: 'cp-open', do: 'Click into Chrome or any app. Then tap the mic key (F5) on the top row.', hint: 'No luck? Press Control+Option+P.', check: { event: 'pad-open' } },
          { id: 'cp-left', do: 'Press A.', hint: 'The window jumps to the left half. Keys match the screen: Q is top left, C is bottom right.', check: { event: 'pad', key: 'A', ok: true } },
          { id: 'cp-right', do: 'Open the pad again and press D.', hint: 'D is the right half.', check: { event: 'pad', key: 'D', ok: true } },
          { id: 'cp-full', do: 'Open the pad and press S.', hint: 'S fills the screen. Press a pad twice to jump to your other screen.', check: { event: 'pad', key: 'S', ok: true } }
        ] },
        { title: 'Save your setup', unlocks: ['2', '3', '4', 'R', 'F'], steps: [
          { id: 'cp-save', do: 'Put two apps side by side. Open the pad and press Shift+1.', hint: 'Pad 1 now remembers every window on screen.', check: { event: 'pad-save', key: '1', ok: true } },
          { id: 'cp-restore', do: 'Move a window somewhere else. Open the pad and press 1.', hint: 'Everything snaps back. Closed apps open first.', check: { event: 'pad', key: '1', ok: true } }
        ] },
        { title: 'Record', unlocks: ['V'], steps: [
          { id: 'cp-rec', do: 'Open the pad and press R.', hint: 'The recorder toolbar and a round camera appear. Pick Record, or press Esc to close the toolbar.', check: { event: 'pad', key: 'R', ok: true } },
          { id: 'cp-cam', do: 'Open the pad and press F to hide the camera.', hint: 'F shows or hides the camera any time.', check: { event: 'camera', on: false } }
        ] },
        { title: 'Make it yours', steps: [
          { id: 'cp-own', do: 'Open the Pad tab. Click pad V and paste a prompt you use every day.', hint: 'Any pad can open an app, a link, a Shortcut, or paste text.', check: { event: 'pad-set', key: 'V' }, action: { label: 'Open Pad tab', run: 'tab:pad' } }
        ] }
      ],
      challenge: {
        title: 'Build day in two minutes',
        intro: 'Four jobs, any order. The clock starts now.',
        levels: [[60, 'Pro'], [120, 'Operator']],
        tasks: [
          { id: 'cx-restore', goal: 'Bring back workflow 1', check: { event: 'pad', key: '1', ok: true } },
          { id: 'cx-corner', goal: 'Snap a window to the top right corner', check: { event: 'pad', key: 'E', ok: true } },
          { id: 'cx-prompt', goal: 'Paste your starter prompt into an app', check: { event: 'pad', key: 'V', ok: true } },
          { id: 'cx-cam', goal: 'Turn on the camera bubble', check: { event: 'camera', on: true } }
        ]
      }
    },
    {
      id: 'dictation',
      version: '2.5.0',
      title: 'Dictation basics',
      tagline: 'Hold fn. Talk. Let go.',
      whatsNew: ['Parakeet voice: fewer mistakes on your own words.', 'Long dictations land seconds after you let go.'],
      lessons: [
        { title: 'Talk instead of type', steps: [
          { id: 'd-hold', do: 'Click into Notes. Hold fn, say a full sentence, let go.', hint: 'Your words appear where the cursor is.', check: { event: 'dictation', phase: 'done', minWords: 4 } },
          { id: 'd-free', do: 'Double-tap fn. Talk with your hands free. Tap fn once to finish.', hint: 'Great for long thoughts.', check: { event: 'dictation', phase: 'done', handsFree: true } },
          { id: 'd-para', do: 'Hold fn and say “first line new paragraph second line”.', hint: 'Also works: “question mark”, “new line”, “scratch that”.', check: { event: 'dictation', phase: 'done', textHas: '\n' } },
          { id: 'd-cancel', do: 'Hold fn, start talking, then press Esc.', hint: 'Esc throws a dictation away.', check: { event: 'dictation', phase: 'cancelled' } }
        ] }
      ],
      challenge: {
        title: 'Inbox zero by voice',
        intro: 'Write like you talk. Three jobs.',
        levels: [[60, 'Pro'], [150, 'Operator']],
        tasks: [
          { id: 'dx-long', goal: 'Dictate a reply of 30 words or more', check: { event: 'dictation', phase: 'done', minWords: 30 } },
          { id: 'dx-free', goal: 'Write one message hands-free', check: { event: 'dictation', phase: 'done', handsFree: true } },
          { id: 'dx-para', goal: 'Use “new paragraph” in a dictation', check: { event: 'dictation', phase: 'done', textHas: '\n' } }
        ]
      }
    }
  ];

  function steps(guide) { return guide.lessons.flatMap((l) => l.steps.map((s) => ({ ...s, lesson: l.title }))); }

  function matches(check, ev) {
    if (!check || !ev || ev.type !== check.event) return false;
    for (const [k, v] of Object.entries(check)) {
      if (k === 'event') continue;
      if (k === 'minWords') { if (!(Number(ev.words) >= v)) return false; } else if (k === 'minSteps') { if (!(Number(ev.steps) >= v)) return false; } else if (k === 'minWindows') { if (!(Number(ev.windows) >= v)) return false; } else if (k === 'textHas') { if (!String(ev.text || '').includes(v)) return false; } else if (ev[k] !== v) return false;
    }
    return true;
  }

  // "2.10.0" > "2.9.1"
  function newer(a, b) {
    const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  }

  /** Guides released after `seen` and up to `current`, oldest first, so they read in order. */
  function whatsNew(seen, current) {
    return GUIDES.filter((g) => newer(g.version, seen) && !newer(g.version, current)).sort((a, b) => (newer(a.version, b.version) ? 1 : -1));
  }

  function level(challenge, seconds) {
    for (const [limit, name] of challenge.levels) if (seconds <= limit) return name;
    return 'Learner';
  }

  const api = { GUIDES, steps, matches, newer, whatsNew, level, byId: (id) => GUIDES.find((g) => g.id === id) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpeakEasyGuides = api;
})(globalThis);
