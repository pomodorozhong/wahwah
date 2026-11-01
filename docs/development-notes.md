# Development notes

Lasting pitfalls and workflow facts learned while building the playgrounds.
The README covers features, decisions, verification and known limitations;
this file covers how to work on the code without repeating mistakes.

## Testing in the Claude desktop app's browser pane

- **Microphone access is blocked** in the pane. Live mode can only be checked
  there with the test sources: *Test signal*, *vowel sweep* (Pink Trombone)
  and *Demo voice*. The demo voice also answers the calibration prompts and
  clicks *I'm quiet*. Real-mic checks need a normal browser.
- **`requestAnimationFrame` pauses while the pane is not in front.** Polling
  page state with scripts alone can show a frozen face. Take a screenshot
  between polls to keep the pane active. The audio-thread analysis keeps
  running either way.
- **Hot reload leaves stale console errors** from half-edited modules, often
  naming an export that no longer exists. Confirm in a fresh tab before
  treating a console error as real.
- **The pane has its own dev server** on port 5180 (`.claude/launch.json`).
  The user's own `npm run dev` usually runs on 5173 or 5174.

## Measuring live-mode quality without a listener

- The objective score is per-control correlation between the live
  estimator's output and the face track the text pipeline makes for the same
  rendered sentence. Helpers: `tests/helpers/liveEval.ts` (feed audio frame by
  frame) and `tests/helpers/calibrate.ts` (run the real calibration on a
  synthetic speaker).
- **Align by window end.** A frame's time is the end of its analysis window.
  The uLipSync-style mode uses a 64 ms window; comparing it against the
  reference at the wrong offset once made it look about 40 ms laggier and
  much worse than it was.
- Jaw/loudness correlation is low on normal speech by design ("ee", "oo" and
  "m" are loud with a nearly closed jaw). Use `AA . AA . AA` when checking
  timing.
- Jerk (mean absolute second difference of jaw) measures jitter. Lag is the
  best cross-correlation offset. The two trade against each other through
  smoothing time.
- Neither klattsch nor Pink Trombone makes a nasal "m" quieter than its
  vowels, so closed-lip detection rules cannot be validated synthetically.

## Code structure gotchas

- `pink-trombone-mod` has no package entry point and uses extensionless
  relative imports. Import `pink-trombone-mod/Synthesizer.js`; Vitest needs
  `server.deps.inline: ['pink-trombone-mod']` (see `vite.config.ts`).
- `babble-engine` is installed from GitHub pinned to a reviewed commit. It is
  not on the npm registry.
- AudioWorklet modules are bundled with Vite's `?worker&url` imports
  (`analysisWorklet.ts`, `recorderWorklet.ts`). Everything they import must
  avoid DOM APIs; the estimator and its dependencies are pure.
- The live page computes the short-window spectrum itself
  (`magnitudeSpectrumDb`) rather than reading the AnalyserNode spectrum, so
  page, worklet, calibration and tests all see identical features.
- Three.js sets a `data-engine` attribute on its canvas. Don't use
  `[data-engine]` selectors for page controls; the babble page uses
  `data-for-engine`.
- Spreading large sample arrays into `Math.max(...)` overflows the call
  stack; loop instead.

## Face host gotchas

- **Cubism Core 6 moved render orders** from `model.drawables.renderOrders`
  to `model.renderOrders` (drawables, then offscreens). Reading the old field
  crashed the frame loop, and ordering by `drawOrders` alone draws Hiyori's
  eye whites over her irises because ties need the part hierarchy.
  `live2d.ts` reads the model field, then the old one, then falls back to
  sorting draw orders.
- **Live2D meshes are 2D**, so Three.js cannot compute bounding spheres for
  sorting. Each geometry gets an infinite sphere up front.
- **Clipping masks use one stencil value per masked drawable** (cycling
  1–255), so masks never need a stencil clear between draws. The shared
  renderer is created with `stencil: true`.
- **Model files are listed by a Vite plugin** (`virtual:local-models` in
  `vite.config.ts`) that scans the git-ignored `public/models/`. Adding files
  triggers a full reload in dev; a production build lists what was there at
  build time.
- **A host that throws inside `update()` stops the page's frame loop**, since
  the stage schedules the next frame after rendering. Hosts catch their own
  errors and report them through `status`.
- The Hiyori free sample has only a "Body" hit area, so faces are framed from
  drawables under parts named like Face/Eye/Mouth/Nose/Brow.

