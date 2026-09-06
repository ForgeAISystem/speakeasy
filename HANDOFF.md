# SpeakEasy v2.4

The app is now installed at `/Applications/SpeakEasy.app`. Its new welcome screen has been verified. Complete the setup guide and physical dictation test; those remain user acceptance steps.

Open `dist/SpeakEasy-2.4.0-arm64.dmg`, then open SpeakEasy. Choose **Install in Applications**, or drag the app onto the Applications shortcut. No developer tools are needed by the recipient.

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

Read STATE.md before continuing. Physical microphone/paste acceptance, packaged permission onboarding, signing, notarization, and Windows validation are separate from the passing automated checks.
