# SpeakEasy voice glass

Created 2026-09-06 with the built-in ImageGen tool. This is the original generated image, copied into the application with no raster editing. The runtime needs no image service.

App asset: `src/app/assets/voice-glass.png`.

Uses: welcome scene and Home. The image sits in layered HTML with small CSS perspective transforms driven by pointer events. No WebGL dependency, video, background generation, or continuous animation loop. The existing vector app icon remains intact.

Motion: maximum 3 degrees of horizontal tilt, 2 degrees of vertical tilt, and 12 pixels of foreground travel. Leaving a surface recenters it. Window blur and visibility changes cancel pending frames. System reduced motion or the app's Subtle motion switch disables depth and transitions.

## Final generation prompt

Use case: stylized-concept
Asset type: original 3D artwork for the welcome and home screens of SpeakEasy, a minimal local voice dictation desktop app.
Primary request: a single elegant sculptural sound wave, like one flowing continuous thick ribbon of polished translucent amber glass, gently folding through three rising and falling rounded waves. This should feel like a collectible Murano glass object photographed for an exceptional contemporary design magazine.
Scene/backdrop: clean solid warm ivory (#f8f8f2) studio background, seamless with the floor, with a very soft contact shadow below the floating object. No frame.
Subject: the warm amber glass ribbon, floating slightly, with one subtle frosted pale-sage glass echo behind it to give depth. The silhouette should be simple, bold and legible at 250px wide.
Style/medium: exceptionally polished photorealistic 3D studio product render. Convincing thick glass refraction and exquisite reflected softbox highlights, restrained optical caustics, no sparkles.
Composition/framing: square canvas, object centered with generous clean margin on all sides; three-quarter view, slightly elevated camera, sculptural waves flowing left to right with no sharp edges.
Lighting/mood: quiet, tactile, sophisticated, optimistic. Soft daylight from upper left.
Color palette: honey amber, champagne, muted sage green, warm ivory. Compatible with deep forest-green interface elements.
Constraints: artwork only, no interface, no keyboard, no text, no logo, no letters, no watermark, no people, no neon, no purple or blue, no busy decorations.
