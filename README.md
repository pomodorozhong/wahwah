# Mumble voice playgrounds

Prototypes for invented, stylized speech with an optional 3D puppet. Text or
phonemes go in, [klattsch](https://github.com/tgies/klattsch) speaks them, and
a procedural Three.js face moves its jaw and lips on the same timeline. The
goal is fictional voices, never realistic speech.

- **Babble playground** (`/babble/`): type English and hear invented gibberish
  that keeps its rhythm, stress, pauses and intonation, in the spirit of
  [Babble Engine](https://github.com/wrongfloor-dev/babble-engine).
- **klattsch playground** (`/klattsch/`): type ARPABET phonemes straight into
  klattsch.

![Face mid-utterance](docs/face.jpg)

![Mouth poses for neutral, AA, IY, UW and M](docs/poses.jpg)

The brief for this prototype is
[`08-mumble-voice-generator-handoff.md`](08-mumble-voice-generator-handoff.md)
(source: [rabbit-holes](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/08-mumble-voice-generator-handoff.md)).

## Run it

Requires Node.js 20+ and npm.

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL (default `http://localhost:5173`) and pick a playground:

- **Babble playground** (`/babble/`): English text in, babble out.
- **klattsch playground** (`/klattsch/`): ARPABET phonemes straight into klattsch.

Press **Play** or Space. Browsers start audio only after a click or key press.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and sync tests (Node, no browser) |
| `npm run build` | Type check, then production build to `dist/` |
| `npm run preview` | Serve the production build |

## Babble playground

- **English text** (up to 500 characters) or one of the samples. Under the box,
  each English word is shown with its babble, e.g. `Hello → AL-bun`, and
  capitals mark the stressed syllable. The word being spoken is highlighted
  during playback.
- **Language style**: an invented sound inventory. *Bubbly* is soft and round
  (B, M, L; AA, OW, UW), *Chirpy* is bright and clicky (T, K, S; IY, EY), and
  *Grumbly* is low and chewy (G, M, R; AH, UH, AO, with more closed syllables).
- **Mood**: Neutral, Happy, Sad, Angry or Surprised. Each sets pitch and speed,
  melody liveliness, stress emphasis, question/exclamation/statement glides,
  and voice quality (breathiness, effort, brightness, vibrato).
- **Seed**: picks a different babble "vocabulary". **New seed** rolls a random
  one.
- **Pitch / speaking rate / voice size** set the base voice, and the mood
  adjusts it.
- **Generated klattsch phonemes** shows the exact string sent to klattsch.

How English becomes babble (`src/babble/`):

1. Split the text into words and punctuation.
2. Count each word's syllables and guess its stressed syllable with English
   rules of thumb. Function words such as *the* and *you* stay unstressed.
3. Invent one syllable per English syllable (onset + vowel + optional coda)
   from the style's weighted inventory. The random choice is seeded by
   `seed + style + word`, so **the same word always babbles the same way**.
4. Add melody: a small per-syllable pitch wobble (seeded by position, so
   repeated words don't sound copied) plus a glide on stressed syllables.
5. Punctuation shapes the phrase. `,` `;` `:` become short pauses. `.` `!` `?`
   and newlines become long pauses. `...` and dashes become hesitations. A
   question rises on its last syllable, an exclamation lifts its stressed
   syllable, and a statement falls at the end.

## klattsch playground

- **Preset**: a phrase plus the voice settings written for it. *Lip workout* is
  a slow diagnostic phrase for checking mouth shapes.
- **Phonemes**: ARPABET with klattsch syntax: `,` `;` `.` are pauses, `AA(+40)`
  bends pitch on one sound, `b140` / `r90` set pitch and rate inline. Unknown
  tokens are listed as warnings under the text box.
- **Pitch**, **speaking rate** (ms per phoneme) and **voice size** (formant
  scale). Inline directives in the text override the sliders.
- **Puppet output** off: the puppet instruction generator does not run at all.
  Audio plays, and the face stays neutral.
- **Idle blink & sway**: cosmetic motion that isn't driven by speech.
- Readout: playback time, active sound, the three face controls, and the live
  output level.
- Timeline: phoneme boundaries, the audio loudness envelope (blue) and the face
  track (orange jaw, green width, purple rounding), with a playhead.
- **Sync diagnostics**: numbers from an offline render of the current
  utterance (see [Verification](#verification)).

Space plays or replays from the start, and Esc stops. Any edit (preset, text,
slider, puppet toggle) stops playback and relaxes the face. The next play uses
the new settings.

## Module boundaries

```text
English text + seed/style/mood
        │
        ▼
src/babble/generate.ts     textToBabble()  ──► BabbleScript (klattsch phonemes + word map)
        │                  moodVoice()     ──► VoiceSettings
        ▼
phoneme text + VoiceSettings   (the klattsch playground starts here)
        │
        ▼
src/voice/performance.ts   compilePerformance()  ──► SpeechPerformance
        │                                              (segments with phoneme + timing,
        │                                               klattsch schedule)
        ├──► renderPerformance() ──► Float32Array audio ──► src/playback.ts (Web Audio)
        │
        └──► src/puppet/generate.ts  generateFaceTrack()  ──► FaceControlTrack
                    (only when puppet output is on)               │
                                                                  ▼
                                    src/host/adapter.ts  FaceHostAdapter ──► src/host/face.ts (Three.js)
```

- **Babble** (`src/babble/`) turns English into a klattsch phoneme string and
  maps each phoneme back to the English word that produced it. It is pure and
  deterministic, with no audio, DOM or Three.js.
- **Voice** (`src/voice/`) depends only on klattsch. It runs in Node, which is
  how the tests use it.
- **Puppet instruction generator** (`src/puppet/`) is pure TypeScript with no
  Three.js or DOM imports. A test asserts it runs without `document`.
- **Host** (`src/host/`) is the only code that knows about Three.js.
  `controlsToMouth()` in `adapter.ts` is the rig mapping. Another character
  would replace this adapter and keep the control format.
- **Playback** (`src/playback.ts`) owns the single clock.
- **Stage** (`src/ui/stage.ts`) is the shared page shell: face, timeline,
  readouts, playback and diagnostics. Each playground in `src/apps/` adds its
  own inputs and a `compile()` callback that returns a `SpeechPerformance`.
- `src/analysis.ts` holds the objective checks (RMS envelope, correlation,
  sync report) shared by the tests and the diagnostics panel.

## Face-control format

```ts
interface FaceControlSample {
  timeSeconds: number;   // relative to the utterance's playback start
  jawOpen: number;       // 0 closed (lips touching) .. 1 fully open
  lipWidth: number;      // 0 relaxed .. 1 wide/spread ("ee")
  lipRound: number;      // 0 unrounded .. 1 rounded/protruded ("oo")
  phoneme: string | null; // active ARPABET sound, informational
}
interface FaceControlTrack { sampleRateHz: number; durationSeconds: number; samples: FaceControlSample[] }
```

- All three controls are in **[0, 1]**, and neutral is all zeros (a relaxed,
  closed mouth). They are animation values, not physical measurements.
- Width and rounding pull against each other, so the generator guarantees
  **`lipWidth + lipRound ≤ 1`**. If both are requested, rounding wins.
- Tracks are sampled at 100 Hz and always start and end at neutral.
  `sampleFaceTrack(track, t)` interpolates and returns neutral outside the
  track, so a host can't get stuck on an active pose.

## Decisions and assumptions

These were delegated to the implementer. Each is a choice, not a requirement.

| Area | Decision | Why |
| --- | --- | --- |
| Voice engine | klattsch 0.8.0 from npm (MIT) | The brief's working prototype starts from klattsch. Babble Engine + klattsch set the feature direction, not the final stack. It is published on npm and needs no vendoring. Its `phrases` output gives per-phoneme start/end times, which is the timing source the face needs. |
| Audio path | Render the whole utterance with `renderToBuffer`, then play it with an `AudioBufferSourceNode` | The start time on the `AudioContext` clock is then exact, so audio and face share one timeline. Rendering is fast (≈40 ms for a 1 s phrase in Node). klattsch's AudioWorklet would suit streaming, which is out of scope. |
| Clock | Face time = audible context time − start, using `getOutputTimestamp()` (falls back to `currentTime − outputLatency`) | Keeps the face in step with what reaches the speakers, not with what is being computed. |
| Timing source | klattsch `phrases` (per-phoneme `tStartMs`/`tEndMs`) | klattsch gives synthesis targets, not visemes. Phrases keep phoneme identity and timing, as the brief asked. |
| Viseme mapping | Hand-tuned table in `src/puppet/visemes.ts`. Diphthongs (AY, OW, …) glide between two poses. | Simple and easy to inspect. Values were chosen by eye, not measured. |
| Coarticulation | Each sound has a *dominance*. Vowels, M/B/P and W hit their pose, while tongue consonants (T, K, …) mostly borrow the neighbouring vowel shape. | Without this, the mouth flaps shut on every consonant. |
| Smoothing | Smoothstep between keyframes. 20 ms anticipation (the mouth moves slightly before the sound). Pauses relax to neutral. | Gives continuous motion and a natural lead. |
| Stop/end | The host eases to neutral with an 80 ms time constant | Stop, natural end and puppet-off never leave an open mouth. |
| Puppet off | The generator is skipped entirely. `__mumble.state().generatorRuns` counts its runs. | Proves voice works without the puppet module. |
| Presets | A phrase plus pitch, rate and voice size | So phrases are compared as written. |
| Edits during playback | Stop and relax, then use the new settings on the next play | Prevents the text on screen from mismatching what is heard. |
| Face | Procedural: a sphere head, eyes, brows and ears. The lips are a tube rebuilt each frame around an outline driven by the controls, with a dark mouth interior and upper teeth. | The brief makes the face optional to embellish. One rebuilt tube shows width, opening and pucker without a modelled rig. |
| Expressive extras | Idle blink and head sway (toggle). Brows lift slightly with the jaw. | Optional per the brief. Kept cosmetic and outside the control format. |
| Babble: text analysis | Heuristic syllable counting and stress rules, no pronouncing dictionary | Babble only needs the rhythm of the text, not its pronunciation. The CMU dictionary (via `klattsch/pronounce`) would add 4.7 MB to the page. |
| Babble: sounds | One invented syllable per English syllable, from per-style weighted inventories. The PRNG is seeded by seed + style + word. | Keeps the text's rhythm and gives a consistent made-up vocabulary, as Babble Engine does. |
| Babble: melody | Per-position pitch wobble, stress glides, and phrase-final rise/lift/fall via klattsch transient pitch marks (`AA(+40)`) | Transient marks don't accumulate, so pitch can't drift over a long text. |
| Babble: moods | Five moods scale pitch and rate, and set the klattsch voice-quality options (`aspiration`, `effort`, `tilt`, `vibratoDepth`) | Uses klattsch features directly, with no extra DSP. |
| Babble: sound source | klattsch, through the same voice → puppet pipeline as the klattsch playground | Your choice, so the text behaviour and the face can be evaluated together. |
| Layout | The stage stays pinned to the viewport height, and the camera distance fits the head to both width and height | The babble panel is taller, which had stretched and cropped the face. |
| Package versions | three 0.187, vite 8.3, typescript 7.0, vitest 5.0 | Latest at the time of writing. |

## Verification

Environment: macOS 26.6.2, Node 26.12.0, npm 11.20.0, and the Claude desktop
app's built-in browser (Chromium) at an `AudioContext` sample rate of 48 kHz,
`baseLatency` 5.3 ms and `outputLatency` 32 ms.

**Automated** (`npm test`, 57 tests, all passing). Babble (39 tests):

- Syllable counts for 12 sample words (*jumped* 1, *table* 2, *banana* 3,
  *information* 4, *2026* 2, …), stress placement, and punctuation
  classification.
- The same input gives the same output, a different seed gives different
  output, and the same word gets the same sounds wherever it appears.
- One babble syllable per English syllable. Punctuation runs collapse into a
  single pause. Questions end rising and statements end falling, by exactly
  the mood's values.
- Every spoken phoneme maps back to its English word.
- All 15 style × mood combinations compile with no klattsch warnings.
- Happy is higher and faster than Sad. The rendered babble is audible, and its
  face track moves (jaw range > 0.5).
- Empty or punctuation-only text gives empty output without errors.

Voice, puppet and sync (18 tests):

- Every preset compiles with no warnings and renders audible audio (peak RMS
  > 0.1, more than 50% of 10 ms windows above 0.01).
- Face controls stay in range with `lipWidth + lipRound ≤ 1`. AA opens the jaw
  above 0.7, IY widens above 0.7, UW rounds above 0.8, and M closes below 0.1.
- Tracks start and end at neutral, return neutral outside the track, and never
  jump more than 0.15 in 10 ms.
- **Sync**: on `AA . AA . AA` at 80, 110 and 200 ms/phoneme, the jaw track and
  the audio loudness envelope correlate above 0.8 (measured 0.84–0.93), with
  the best alignment within 40 ms (measured: jaw leads by 10 ms). A *negative
  control* shifts the track 250 ms and checks that the correlation drops
  sharply, which shows the test detects real timing errors.
- The generator runs without a DOM or Three.js scene.

**Build**: `npm run typecheck` and `npm run build` pass. The ~600 kB bundle is
mostly Three.js, and the warning limit is raised to 800 kB. `npm run dev`
serves the app (HTTP 200).

**In the browser, babble playground** (checked with page scripts and
screenshots, not by listening):

- Play: the output level was 0.37 and the jaw reached 0.50. The highlighted
  English word moved from *Hello* (`AL-bun`) to *there* (`pa`). Sync
  diagnostics: jaw↔loudness r = 0.67, with the jaw leading by 20 ms.
- Changing the mood kept the sounds and changed the melody and length (neutral
  2.51 s, sad 3.03 s, happy 2.30 s). Changing the style changed the sounds.
  Setting the same seed again reproduced the same babble exactly.
  "Banana? Banana!" gave `OO-boo-ru OO-boo-ru` with different pitch glides.
- Puppet off: audio played (level 0.37), the face stayed neutral, and the
  generator didn't run.
- No console errors. At 375 px wide there is no horizontal scroll.

**In the browser, klattsch playground**:

- Play: the output analyser read RMS 0.2–0.42 during speech and 0 after the
  end, so audio is reaching the output graph.
- The face follows the timeline. The readout showed AA at jaw 0.87–0.89, IY at
  lipWidth 0.81, and UW at lipRound 0.98. The pose sheet above was rendered
  through the same adapter.
- Stop mid-sound (jaw 0.40) returned to exactly neutral, with the level at 0.
- Puppet off: audio played (RMS 0.42) and the face stayed neutral. The
  generator run count didn't change, and the timeline showed only the audio
  envelope.
- Editing the rate or switching presets during playback stopped playback and
  loaded the new settings. Space played and Esc stopped.
- No console errors or warnings from the app. At 375 px wide, the layout
  stacks the face above the controls.

### Observations (for the later review)

- The speech has a clear 1980s-synth character (klattsch describes itself as
  "Votrax/SAM tier"). That fits the goal: stylized, fictional voices, never
  realistic speech.
- On normal phrases, jaw/loudness correlation is low (0.1–0.2). This is
  expected, not a sync fault: IY, UW and M are loud with a nearly closed jaw.
  The `AA . AA . AA` calibration phrase is the meaningful sync check. The
  timeline panel makes the relationship visible.
- Fast presets (about 75 ms/phoneme) give busy, small mouth motion. Slower
  rates read better on this face. Coarticulation keeps consonants from looking
  choppy.
- In the desktop app's browser pane, `requestAnimationFrame` pauses while the
  pane isn't in front, so the face freezes while audio continues. A normal
  foreground tab doesn't have this problem.

## Known limitations

- Babble syllable counts and stress are heuristic. Unusual words can get the
  wrong count, and some stress is wrong (e.g. *today* stresses the first
  syllable). The rhythm is close but not exact.
- Babble understands Latin letters, digits and common punctuation. Other
  scripts (Japanese, emoji) are ignored. Numbers are counted roughly, one
  syllable per two digits.
- Babble has no tone-of-text analysis: the mood is chosen by hand, not
  detected.

- Phoneme input only. Text-to-babble, microphone analysis, the Rust/WASM core,
  packaging and streaming are out of scope for this prototype.
- The whole utterance renders before playback. Long texts have a startup cost
  proportional to their length, and there is no streaming.
- The viseme values are hand-tuned for this face and have not been tested with
  listeners. There are no tongue, cheek or emotion controls.
- Only klattsch's default English bank is mapped. Other banks fall back to a
  generic pose.
- Polyphonic klattsch input (`[voice=N]`) plays and animates voice 0 only.
- Latency wasn't measured beyond the reported `baseLatency`/`outputLatency`.
  Rendering takes tens of milliseconds for preset-length phrases.
- `window.__mumble` is a debug hook for automated checks, not part of the
  puppet interface.
