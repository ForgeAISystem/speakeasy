# SpeakEasy: effortless local dictation

Date: 2026-09-06

The user wants a minimal, capable desktop replacement for a dictation subscription. People should install an app, follow a short welcome flow, and use Fn to speak into their usual applications. They should not need to send source files to an AI agent.

Scope: a Mac-first installer entry point, a guided first run, local voice preparation, a native Fn key, visible permission and shortcut status, a real practice dictation, accessible controls, and a quieter home. Preserve the existing dictionary, snippets, history, models, optional cleanup providers, and Windows installer.

Acceptance: packaged Mac app opens; onboarding explains permissions; failed downloads can be retried; the chosen shortcut is detected; a real transcript lands in the practice field before completion; closing the main window leaves dictation available; personal files survive upgrades. Signing, notarization, and Windows device validation must be reported separately from a local build.

Outside this pass: account systems, cloud sync, payment flows, public release publication, Apple enrollment, automatic updates, full per-app style matching, and a new transcription engine.

Design references inspected through Mobbin:

- [Fireflies onboarding](https://mobbin.com/flows/169d9ba8-3d24-48ad-9a85-b96db83dc5ec): split layout, progressive steps, one main action.
- [Klaviyo setup checklist](https://mobbin.com/screens/de46e885-efb7-4cd3-a574-b16c3dd5e1e6): clear current step and checked completion.
- [Circle getting started](https://mobbin.com/screens/12a4e9b2-b275-41ea-8d95-522094a2ccab): visible setup progress.

SpeakEasy retains its independent warm, minimal desktop identity. It is not a Forge marketing page.

## v2.4 refinement pass

The user requested ImageGen artwork, minimal UI, subtle parallax, and functional improvements informed by Wispr Flow and Glaido. Delivered scope: original glass-wave artwork, event-driven shallow depth, reduced-motion controls, explicit cleanup modes, original transcript recovery, better search, editable multiline snippets/dictionary, truthful overlay stages, and native Quit. No new service, screen-reading feature, or account requirement was added.

## v2.4.1 desktop usability

Harsh needs to continue other work while SpeakEasy is developed and used. Scope: standard native window chrome, a 560x480 minimum with usable compact layouts, saved position/size, disconnected-display recovery, minimized-window restoration, and less hidden setup activity. Verification must run without taking focus or controlling the installed app. Stage one tested update and coordinate its single restart. Native drag/resize acceptance follows installation. Do not claim a whole-system speedup from an idle CPU snapshot.

## v2.4.2 reliability

Harsh reported that pressing Fn did not show the bottom indicator and asked for smoother, robust dictation. Scope: reproduce indicator timing/state failures, make microphone startup visible, prevent stale sessions from affecting newer ones, recover from stalled capture and failed renderers/listeners/workers, preserve received audio after interruptions, and provide small diagnosis/repair controls. Keep existing local models and settings. Verify failures/recovery with deterministic tests and a real engine smoke check, then install once at the user's approved moment. Physical Fn, microphone, native indicator, and paste require actual device acceptance.
