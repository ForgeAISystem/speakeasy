# SpeakEasy v2.5.0

v2.5.0 is built and ready to install. It uses the more accurate Parakeet voice for English, cleans up verbal tics, understands "question mark", "new line", "new paragraph", and "scratch that", and finishes long dictations faster because it transcribes while you talk.

## New in v2.5

- **Better words.** English uses Parakeet. On first launch SpeakEasy switches to it if it is already downloaded.
- **Cleaner text.** Clean removes "you know", "like," and stutters, keeps your meaning, and spells your dictionary words the way you saved them, even when the voice joins or splits them.
- **Say your punctuation.** "Question mark", "exclamation point", "new line", "new paragraph", "scratch that".
- **Fast on long thoughts.** A five-minute dictation lands seconds after you let go.
- **Fits the app.** Chat apps get a single sentence without a final period. Polished mode writes emails, chats, and AI prompts in the right style. Turn it off with Settings > Match each app.
- **Coming from Wispr Flow?** Dictionary > Import brings over your words and snippets.
- **Mute audio while dictating.** Optional, in Settings.
- **Polished with Claude** uses Claude Haiku 5.5: faster and cheaper. Paste your Anthropic key under Settings > Voice models & optional AI cleanup.

For another installation, quit SpeakEasy before replacing it. Open `dist/SpeakEasy-2.5.0-arm64.dmg`, then drag the app onto the Applications shortcut. A new installation also offers **Install in Applications** when opened outside Applications. No developer tools are needed by the recipient.

## If dictation needs attention

On Home, expand **Check dictation** for permissions, shortcut, voice, microphone connection, and recording indicator status. Press and release Fn to update the detection time. **Test indicator** previews the bar without recording. **Repair connection** rechecks the listener and reconnects failed components; finish or cancel active dictation first.

The bar shows Opening microphone before Listening. Startup/stall failures display an error. If received audio can be recovered, it appears in History with Retry. The bar uses the display nearest the pointer.

## Window controls in v2.4.1

Drag the native title bar to move the app between screens. Drag an edge or corner to resize it, down to 560x480. The layout adapts to the available width, and longer pages scroll. Use the standard yellow/green controls to minimize or enter full screen. Size and position are remembered across restarts, with recovery onto an available screen when a monitor is unplugged. Opening from the Dock or menu bar restores a minimized window.

The warm artwork and subtle motion remain. Native desktop blur is removed, and setup does not poll for readiness while the window is hidden. No whole-system performance improvement has been benchmarked.

Follow the welcome flow:

1. Allow the microphone and Accessibility. SpeakEasy checks when you return.
2. Choose English or multiple languages, then prepare the local voice.
3. Press and release Fn. Use Right Option if your keyboard has no Fn key. If required, allow Input Monitoring. If Globe opens its own menu, the guide links to Keyboard settings; choose “Do Nothing” for the Globe action yourself.
4. Click the practice box, hold the shortcut, wait for the start sound, say a sentence, and release. Finish becomes available when the words land in the box.

Close the window to leave it in the menu bar. Double-tap the key for hands-free dictation; tap once to finish or press Escape to cancel. History, dictionary, snippets, and Settings stay available from the main window.

## New in v2.4

- Original glass-wave artwork and subtle depth. Turn off Subtle motion in Settings, or use the system’s reduced-motion preference.
- Choose Original, Clean, or Polished on Home. Polished needs an existing local Ollama model or an explicitly configured Anthropic key. API usage can incur charges.
- Cmd/Ctrl+F opens History. Search includes original text; Compare original reveals what cleanup changed. Copy original recovers it without replacing the saved final transcript.
- Dictionary and snippets support editing. Snippets accept paragraph breaks.
- Cmd+Q now exits correctly; closing the window keeps SpeakEasy available.

## Distribution status

The local review build is unsigned and not notarized. The repository remains private. No new GitHub release has been published. A private release link also requires repository access.

For the normal public Mac installation experience, supply a Developer ID Application certificate to electron-builder through `CSC_LINK`/`CSC_KEY_PASSWORD` or an installed signing identity. Supply notarization credentials using one of electron-builder's supported Apple API-key or Keychain-profile mechanisms. Then build with `npm run dist:mac -- --publish never`, verify signing and notarization on the final app, and test the downloaded installer on a clean Mac before publishing. Do not disable Gatekeeper.

Apple reference: [notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution). Electron reference: [code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).

## Developer pickup

Run `npm ci`, `npm test`, and `npm start`. Command Line Tools are required to compile Fn support in a source checkout. Use `SPEAKEASY_USER_DATA` with a temporary absolute path for isolated QA. The user’s real profile is under `~/Library/Application Support/SpeakEasy`.

Read STATE.md before continuing. Recognition accuracy, broader app/monitor acceptance, signing, notarization, and Windows validation remain separate checks. Physical Fn/indicator/paste worked on Harsh's test; permissions and completed onboarding are already present.
