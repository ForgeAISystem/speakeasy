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
