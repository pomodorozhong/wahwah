# Development notes

## Run the checks

After installing dependencies, run these from the repository root:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
npm run typecheck
npm test
npm run build
```

The npm commands, including `npm run dev`, first run `npm run build:wasm`. It
writes the generated package to `src/wasm/`, which is ignored by Git. Keep the
`wasm-bindgen-cli` version equal to the `wasm-bindgen` crate version.

The tests exercise synthesis, mouth tracks, host mappings, and live analysis
in Node. To inspect the production build in a browser, run
`npm run preview`. For microphone checks, follow the
[calibration and playback guide](playground.md#calibrate-a-microphone).

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
- If a fresh tab still receives an old source module after an edit, restart
  the project's Vite server before checking the behavior again. This occurred
  while changing the default sound engine; reloading the page alone still
  served the previous engine menu.
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
- Neither the Rust formant voice nor Pink Trombone makes a nasal "m" quieter
  than its vowels, so closed-lip detection rules cannot be validated synthetically.

## Code structure gotchas

- The default tofu model is shipped as `public/tofu/corner-cut.vrm`. After
  changing its geometry or pigments in `scripts/tofu/`, run
  `npm run build:tofu` and include the regenerated asset. Its VRM expressions
  include standard vowels plus body, gaze, and brow controls; the playground
  replaces the lower lip's fallback morph with a real jaw rotation.
- To recreate the README images, start `npm run dev` and open
  `/scripts/docs/tofu-images.html` for the 1100 × 200 mouth row, or add `?hero`
  for the 720 × 720 portrait. Capture the top-left area at those dimensions.
  The row uses the neutral pose and `VISEMES` entries for AA, IY, UW, and M,
  with the independent body motion held still.
- The current tofu M/B/P target is a small open smile rather than a sealed
  mouth. The README pose row shows the actual output, including this limit.
  A future closure correction should keep the AA, IY, and UW silhouettes
  distinct and preserve the hinged lower lip.
- `pink-trombone-mod` has no package entry point and uses extensionless
  relative imports. Import `pink-trombone-mod/Synthesizer.js`; Vitest needs
  `server.deps.inline: ['pink-trombone-mod']` (see `vite.config.ts`).
- AudioWorklet modules are bundled with Vite's `?worker&url` imports
  (`analysisWorklet.ts`, `recorderWorklet.ts`). Everything they import must
  avoid DOM APIs; the estimator and its dependencies are pure.
- The live page computes the short-window spectrum itself
  (`magnitudeSpectrumDb`) rather than reading the AnalyserNode spectrum, so
  page, worklet, calibration and tests all see identical features.
- Three.js sets a `data-engine` attribute on its canvas. Don't use
  `[data-engine]` selectors for page controls; the Mumble page uses
  `data-for-engine`.
- Spreading large sample arrays into `Math.max(...)` overflows the call
  stack; loop instead.

## Rust voices

- `crates/wahwah-core` has no browser dependency. `crates/wahwah-wasm` is the
  stateless boundary, and `src/voice/rustVoice.ts` requests a complete
  `RenderedUtterance`: typed audio, timeline, warnings and optional mouth track.
- All six text-mode voices render in Rust. Text to mumble and Phoneme script
  use Rust for Mumble generation, synthesis and mouth tracks. Live mode's
  Mumble test sentence, Demo voice and calibration responses use the same WASM
  renderer with mouth generation disabled: the TypeScript estimator must infer
  their movement from the audio, just as it does for microphone input.
- The klattsch and babble-engine npm packages and their old synthesis adapters
  are removed. Their upstream notices remain in THIRD_PARTY_NOTICES.md.
- Live formant matching uses the ten Klatt (1980) F1/F2 reference pairs copied
  from klattsch in `src/live/vowels.ts`, including UW's rounded glide endpoint.
  These reference values and the mouth poses load synchronously without WASM.
- `data/mouth-poses.json` supplies Rust's mouth generator and trombone plunger
  and TypeScript's live analysis. `data/mumble-presets.json` supplies Rust's
  sound inventories and moods and TypeScript's UI options. Rust embeds these
  files at compile time; TypeScript imports them synchronously, so the live
  audio worklet has no WASM dependency.
- The Rust version is the new standard, so it is not compared with klattsch's
  output. Its script language keeps phonemes, stress and pitch marks, pauses,
  syllable groups, comments and pitch, rate, scale, vibrato, tremolo, aspiration,
  tilt and effort directives. It drops klattsch's bank, engine and voice
  sections, extended uppercase directives and homoglyph normalization.
- A `p` pause directive is a pause segment on the timeline. Core source offsets
  are UTF-8 byte ranges. The WASM boundary converts timeline and Mumble word
  offsets to UTF-16 positions, including after emoji and smart punctuation.
- Vitest's setup file initializes the actual WASM binary before tests import
  generation or synthesis. Voice, mouth-track and live-analysis fixtures all
  exercise Rust audio and tracks. Pink Trombone remains the independent
  synthesizer used to check calibration and live analysis on another voice.
- Talking Instruments live in `crates/wahwah-core/src/instruments/`: `score.rs`
  produces explicit notes and `synth.rs` renders them. The score drives the
  note mouth track directly, so multi-note words articulate at each onset.
  Their original-text source ranges are converted to UTF-16 in WASM just like
  Mumble word ranges. `data/instrument-presets.json` supplies the four default
  control sets to Rust and TypeScript. Choir pitches are quantized relative
  to the selected base pitch; the other three instruments retain pitch glides.

## Unified playground lifecycle and design

- `src/apps/studio.ts` creates one shell and one `PuppetView` for the visit.
  The input selector mounts mumble, klattsch or live into that shell with an
  `AbortSignal`. Keep the selected model, renderer and camera on the shared
  view so switching inputs preserves the scene.
- Each input owns its listeners, animation loops and audio resources. Abort
  must also handle asynchronous work that finishes after the user switches
  away: pending microphone permission, AudioWorklet setup and recording.
  Stop returned microphone tracks and close unused audio contexts even when
  setup did not finish. The browser tests cover these races with fake input;
  physical microphone and touchscreen checks are still outstanding.
- Input drafts and settings survive switching within a visit through
  module-local state; this does not promise persistence across reloads.
  Root URLs use `?mode=mumble|klattsch|live`, with `engine` for Mumble's
  selected engine. Legacy playground paths resolve to the same shell;
  `/babble/` and `?mode=babble` still select Mumble.
- The approved design uses the Mustard Block colors and Writing Spread
  layout: visible script, grouped settings, a persistent rounded square
  puppet and a persistent playback monitor. The preview title and Reset
  view sit inside the square's bottom edge. The product title is Voice
  playground.
- `src/ui/monitorTheme.ts` defines the shared plot palette and line styles:
  cream solid jaw, teal dashed width, gold dotted rounding and a translucent
  gold level envelope. Keep canvas plots, legends and CSS meters consistent.
  These plots show audio level and face controls; live levels use dBFS.
  Recorded playback draws the retained take against the mouth clock and
  applies the selected delay to its audio envelope.
- The merged UI deliberately excludes the later shader-style and mouth-mode
  experiments. Their source and local model archives are on
  `codex/backup-puppet-experiments-2026-11-02` at a5bbc48. Extract source onto
  current main for each feature; do not merge the backup wholesale or publish
  the local model archives.

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

