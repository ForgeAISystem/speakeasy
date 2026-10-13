# Install or update SpeakEasy

Written for an AI agent (Claude Code or similar) installing SpeakEasy for the person at this computer, and readable by that person too. It works on any Mac. Nothing in STATE.md, SESSION-HANDOFF.md, BUILD_LOG.md, or docs/verification/ applies to your computer: those files track the maintainer's own build Mac.

Latest version: **2.5.0** on the `main` branch.

**The one-line ask** a person can give their agent:

> Install the latest SpeakEasy on this Mac from github.com/ForgeAISystem/speakeasy. Follow INSTALL.md in that repo.

## Who does what

The agent builds, installs, launches, and checks. The person grants macOS permissions, answers system dialogs, and does the first dictation. An agent never changes System Settings, Gatekeeper, or privacy permissions itself, and never enters an API key on the person's behalf.

## 1. Check the computer

```bash
sw_vers -productVersion    # macOS 12 or newer
uname -m                   # arm64 = Apple Silicon, x86_64 = Intel
node -v                    # v22 or newer
xcode-select -p            # prints a path when Command Line Tools are installed
git --version
```

- No Node 22+: install it (for example `brew install node`), or ask the person.
- No Command Line Tools: run `xcode-select --install`. The person clicks Install in the dialog. They compile the small Fn-key helper.
- Free disk: about 2 GB for the build, plus 460 MB for the English voice the app downloads later.

## 2. Get the latest code

```bash
if [ -d ~/speakeasy/.git ]; then git -C ~/speakeasy checkout main && git -C ~/speakeasy pull --ff-only; \
else git clone https://github.com/ForgeAISystem/speakeasy.git ~/speakeasy; fi
```

The repository is private. If cloning fails, the person needs access from the maintainer and a GitHub login on this computer (`gh auth login` or an SSH key).

## 3. Build

Run from inside `~/speakeasy`. Claude Code shells export `ELECTRON_RUN_AS_NODE`, which breaks Electron, so clear it:

```bash
cd ~/speakeasy
env -u ELECTRON_RUN_AS_NODE npm ci
npm test
env -u ELECTRON_RUN_AS_NODE npm run dist:mac
```

All tests should pass. The app lands at `dist/mac-arm64/SpeakEasy.app` on Apple Silicon or `dist/mac/SpeakEasy.app` on Intel. A DMG is created next to it. "Skipped macOS application code signing" is expected: builds are unsigned.

## 4. Install or update

Updating keeps everything. Settings, history, dictionary, snippets, and voice packs live in `~/Library/Application Support/SpeakEasy/`, and replacing the app never touches them.

```bash
APP=~/speakeasy/dist/mac-arm64/SpeakEasy.app        # Intel: ~/speakeasy/dist/mac/SpeakEasy.app
osascript -e 'tell application "SpeakEasy" to quit' 2>/dev/null
for i in $(seq 1 20); do pgrep -x SpeakEasy >/dev/null || break; sleep 0.5; done
[ -d /Applications/SpeakEasy.app ] && mv /Applications/SpeakEasy.app ~/speakeasy/dist/SpeakEasy-previous.app
ditto "$APP" /Applications/SpeakEasy.app
open -a /Applications/SpeakEasy.app --stdout /tmp/speakeasy.log --stderr /tmp/speakeasy.log
```

Launch with `open`, never by running the binary from a shell. A shell launch makes macOS attach the microphone and Accessibility permissions to the terminal or agent instead of to SpeakEasy. The previous version stays in `dist/SpeakEasy-previous.app` for a rollback; delete it once the new one works.

## 5. Check it

```bash
sleep 8; grep -E "\[engine\]|\[hotkey\]" /tmp/speakeasy.log
```

| Log line | Meaning |
|---|---|
| `[engine] ready: parakeet-v2` (or another voice) | The voice is loaded. |
| `[hotkey] listener active` | The shortcut works and Accessibility is granted. |
| no `[engine]` line on a first install | Normal. The welcome guide downloads a voice first. |
| `[hotkey] not available yet` on a first install | Normal until the person allows Accessibility in the welcome guide. |

Then hand over to the person: click into any text field, hold Fn, say a sentence, release. The words should appear.

## 6. First run (the person)

A first install opens a short welcome guide:

1. Allow **Microphone** and **Accessibility**. If asked, also allow **Input Monitoring**.
2. Pick **English** (Parakeet, most accurate) or **Multiple languages** (Whisper Turbo). The voice downloads once, then works offline.
3. Press and release the dictation key: Fn / Globe, or Right Option. If Fn opens the emoji picker, set System Settings > Keyboard > "Press Globe key to" > Do Nothing.
4. Dictate one sentence into the practice box.

After that: hold Fn to talk, double-tap Fn for hands-free, Esc cancels. Closing the window keeps SpeakEasy in the menu bar.

## Good to know after updating

- **Voice:** 2.5 recommends Parakeet for English. An existing install that already downloaded Parakeet switches to it once. Otherwise: Settings > Voice models & optional AI cleanup > Parakeet 0.6B v2 > Download, then Use.
- **Coming from Wispr Flow:** Dictionary > Import brings over the words and snippets taught to Wispr.
- **Polished cleanup with Claude** is optional and off by default. The person pastes their own Anthropic API key under Settings > Voice models & optional AI cleanup, then picks Polished.

## Other ways in

- **Installer download:** `gh release download --repo ForgeAISystem/speakeasy --pattern '*arm64.dmg'` (Intel: `*x64.dmg` when present). Open the DMG and drag SpeakEasy to Applications. Downloaded builds are unsigned, so the first open is right-click > Open, done by the person. Do not disable Gatekeeper.
- **Windows:** `npm run dist:win` builds a one-click installer, or download the `.exe` from Releases. Windows has not been validated on real hardware.

## If something is off

| Symptom | Fix |
|---|---|
| `npm start` or the built app exits at once from a Claude Code shell | Prefix with `env -u ELECTRON_RUN_AS_NODE`. |
| Fn does nothing after an update | Home > Check dictation shows the failing piece. If Accessibility or Input Monitoring is the problem, the person turns SpeakEasy off and on in System Settings > Privacy & Security, then clicks Repair connection. |
| Fn opens the emoji picker | Keyboard setting above. Or choose Right Option in Settings > Dictation key. |
| Words go to the clipboard, not the app | The text field lost focus or the app blocks paste. Press Cmd+V. |
| Two copies running | Quit both from the menu bar, then open only `/Applications/SpeakEasy.app`. Never run `npm start` while the installed app runs: both would claim Fn. |
