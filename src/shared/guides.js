'use strict';

// Walkthroughs. Every user-facing feature ships with a guide here: what's new
// in one line each, lessons whose steps finish only when the app sees the user
// do the thing, and a challenge that proves it stuck. See docs/GUIDES.md.
//
// A step's check matches one app event: { event, ...fields }. Plain fields must
// be equal. minWords / minSteps / minWindows are lower bounds. textHas searches
// the dictated text.
(function (root) {
  const GUIDES = [
    {
      id: 'voice-edit',
      version: '2.9.0',
      title: 'Edit by voice',
      tagline: 'Fix, rewrite, and find your words without typing.',
      whatsNew: [
        'Talk to Claude Code: no stray period, and nothing sends until you press Return.',
        'Select text, hold fn and Shift, and say how to change it.',
        'Control+Command+Z puts back exactly what you said.',
        '“Hey computer, what did I say about...” finds it in your history.'
      ],
      lessons: [
        { title: 'Talk to the terminal', steps: [
          { id: 've-term', do: 'Click into Terminal or Claude Code. Hold fn and say “list the files in this folder”.', hint: 'No period at the end. Nothing runs until you press Return.', check: { event: 'dictation', phase: 'done', terminal: true } },
          { id: 've-term-line', do: 'In the same window, hold fn and say “first line new line second line”.', hint: '“New line” presses Shift+Return, so Claude Code adds a line instead of sending.', check: { event: 'dictation', phase: 'done', terminal: true, textHas: '\n' } }
        ] },
        { title: 'Rewrite what you select', steps: [
          { id: 've-rewrite', do: 'In Notes, select a paragraph. Hold fn and Shift. Say “make this shorter”.', hint: 'The new text replaces your selection. The bar shows the word count before and after.', check: { event: 'rewrite', ok: true } },
          { id: 've-rewrite-voice', do: 'Select a few lines. Hold fn and say “Hey computer, turn this into bullets”.', hint: 'Any edit works: “make it friendlier”, “translate this into Spanish”.', check: { event: 'rewrite', ok: true, via: 'voice' } }
        ] },
        { title: 'Undo the AI', steps: [
          { id: 've-undo', do: 'Hold fn and say “um so basically I think we ship it”. Then press Control+Command+Z.', hint: 'Cleanup goes away and your exact words come back. Works after a rewrite too.', check: { event: 'undo', ok: true } }
        ] },
        { title: 'Find what you said', steps: [
          { id: 've-search', do: 'Hold fn and say “Hey computer, what did I say about” and a topic you talked about.', hint: 'Matches show on the pad. It searches History on this Mac only.', check: { event: 'history-search', found: true } },
          { id: 've-search-paste', do: 'Press Return to paste the top match.', hint: 'Up and Down pick another one.', check: { event: 'history-paste', ok: true } }
        ] }
      ],
      challenge: {
        title: 'Edit at the speed of talk',
        intro: 'Four jobs, no typing. Go.',
        levels: [[75, 'Pro'], [180, 'Operator']],
        tasks: [
          { id: 'vex-term', goal: 'Dictate a prompt into Claude Code or a terminal', check: { event: 'dictation', phase: 'done', terminal: true } },
          { id: 'vex-rewrite', goal: 'Rewrite a selection by voice', check: { event: 'rewrite', ok: true } },
          { id: 'vex-undo', goal: 'Undo an AI edit', check: { event: 'undo', ok: true } },
          { id: 'vex-find', goal: 'Find an old dictation and paste it', check: { event: 'history-paste', ok: true } }
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
        { title: 'Snap windows', steps: [
          { id: 'cp-open', do: 'Click into Chrome or any app. Then tap the mic key (F5) on the top row.', hint: 'No luck? Press Control+Option+P.', check: { event: 'pad-open' } },
          { id: 'cp-left', do: 'Press A.', hint: 'The window jumps to the left half. Keys match the screen: Q is top left, C is bottom right.', check: { event: 'pad', key: 'A', ok: true } },
          { id: 'cp-right', do: 'Open the pad again and press D.', hint: 'D is the right half.', check: { event: 'pad', key: 'D', ok: true } },
          { id: 'cp-full', do: 'Open the pad and press S.', hint: 'S fills the screen. Press a pad twice to jump to your other screen.', check: { event: 'pad', key: 'S', ok: true } }
        ] },
        { title: 'Save your setup', steps: [
          { id: 'cp-save', do: 'Put two apps side by side. Open the pad and press Shift+1.', hint: 'Pad 1 now remembers every window on screen.', check: { event: 'pad-save', key: '1', ok: true } },
          { id: 'cp-restore', do: 'Move a window somewhere else. Open the pad and press 1.', hint: 'Everything snaps back. Closed apps open first.', check: { event: 'pad', key: '1', ok: true } }
        ] },
        { title: 'Record', steps: [
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
