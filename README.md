# Mumble voice playgrounds

Prototypes for invented, stylized speech with an optional 3D puppet. Text or
phonemes go in, [klattsch](https://github.com/tgies/klattsch) speaks them, and
a procedural Three.js face moves its jaw and lips on the same timeline. The
goal is fictional voices, never realistic speech.

- **Babble playground** (`/babble/`): type English and hear invented gibberish
  that keeps its rhythm, stress, pauses and intonation, in the spirit of
  [Babble Engine](https://github.com/wrongfloor-dev/babble-engine). Three
  engines can speak it: klattsch, a **wah-wah muted trombone** (the
  cartoon-teacher voice, `/babble/?engine=trombone`), or Babble Engine itself.
- **Live mic playground** (`/live/`): talk into the microphone and the puppet
  follows in real time, from live voice analysis, with latency readouts.
- **klattsch playground** (`/klattsch/`): type ARPABET phonemes straight into
  klattsch.
- Every page has a **debug puppet** view that draws only the instructions:
  each control's value, its direction and speed, and the force pushing it.

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
- **Live mic playground** (`/live/`): microphone in, mouth motion out.
- **klattsch playground** (`/klattsch/`): ARPABET phonemes straight into klattsch.

Press **Play** or Space (or **Start** on the live page). Browsers start audio
only after a click or key press, and the microphone only after you allow it.

### Layout

Every page uses the same layout:

- **Left: the stage.** It holds the face (or debug puppet), a **transport bar**
  with play/stop, time, active sound, *Puppet output*, *View* and *Idle
  motion*, a row of **meters** (jawOpen, lipWidth, lipRound and the audio
  level), and the **timeline**.
- **Right: a panel** with collapsible sections (Text, Engine and character,
  Voice, Diagnostics …).

On desktop both columns stay pinned to the window height, and the panel
scrolls on its own, so the face and transport are always visible while you
change settings. Below 860 px wide, the columns stack.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and sync tests (Node, no browser) |
| `npm run build` | Type check, then production build to `dist/` |
| `npm run preview` | Serve the production build |

## Babble playground

- **Sound engine**:
  - *klattsch formant voice*: our text-to-babble (described below), spoken by
    klattsch.
  - *Wah-wah trombone*: the same text-to-babble, played on a muted trombone
    (see [Wah-wah trombone](#wah-wah-trombone)). Its extra controls are
    *Brassiness*, *Plunger wah* and *Transpose*.
  - *Babble Engine*: its own text-to-babble and synthesis, with 15 styles that
    speak the text (*Bloopa Doopa* ignores text, so it's left out) and several
    voices each.

  Text, mood and seed are shared between engines, so the same line can be
  compared directly.
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

With **Babble Engine**, the engine invents the syllables itself and reports
only each syllable's start time and text (e.g. `zah`, `Noo`, or one letter at
a time in *Critter Chatter*). `src/engines/babbleEngine.ts` turns that into the
same timeline klattsch produces:

- The syllable's letters give an onset consonant and vowel, e.g. `zah` → S + AA
  and `Noo` → N + UW.
- A syllable ends at the next syllable or at the first 30 ms of quiet in the
  rendered audio, whichever comes first. Quiet gaps become pauses, so the mouth
  closes between words.
- The English word highlight follows Babble Engine's per-character `reveal`
  times.

The puppet instruction generator and both puppet views run unchanged on either
engine.

How English becomes babble with klattsch (`src/babble/`):

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

### Wah-wah trombone

The muffled "wah-wah" adult voice of classic cartoons is a trombone played with
a plunger mute. `src/engines/trombone.ts` is a small synth of our own written
in TypeScript, with no extra dependency:

- **Timing and pitch** come from the same klattsch performance as the other
  engines (`f0Curve()` follows klattsch's pitch targets and glides). Syllables,
  stress, question rises and moods therefore carry over. *Transpose* shifts the
  whole contour, by default down 5 semitones into trombone range.
- **Tone** is additive brass: up to 48 harmonics, a portamento between notes,
  and a slight vibrato.
- **Plunger**: a resonant low-pass whose corner frequency follows an
  "openness" curve. Open vowels (AA) open it wide, rounded vowels (UW) half,
  and consonants and pauses close it. That gives *wah* on every syllable.
  Louder notes also get brassier.
- **Sync with the face**: the plunger and the puppet's jaw both come from the
  same vowel timeline, so the mouth opens exactly when the horn does.
  Measured jaw/loudness r = 0.56 on a long sentence and 0.71 on the sample
  greeting.

## Live mic playground

1. Pick **Input**: *Microphone* (choose a device once permission is granted)
   or a test signal played aloud and analyzed:
   - a babble sentence (klattsch);
   - a **vowel sweep** ah · ee · oo · eh made by
     [Pink Trombone](https://github.com/chdh/pink-trombone-mod), a different
     voice that the analyzer was not tuned on.

   The test signals show the mode without a mic.
2. Press **● Start**. With the microphone, *Hear the microphone* sends it to
   your speakers (use headphones). The audio never leaves the page.
3. Talk. The face (or the debug puppet) follows your voice.

How the live voice analysis works (`src/live/estimator.ts`, pure and
host-agnostic):

- Each display frame reads the latest 1024 samples (21 ms at 48 kHz) and their
  spectrum from an `AnalyserNode`.
- **Jaw = loudness.** The level in dBFS is compared with:
  - a **noise floor** that drops at once to quieter input and creeps up
    6 dB/s, so a fan or hum is learned within a few seconds but speech is not;
  - a **recent peak** that decays 3 dB/s.

  The mouth starts to open at *Gate* dB above the floor, but never more than
  *Loudness range* below the recent peak. That keeps loud and soft sounds
  distinct even in a dead-silent room. *Sensitivity* scales the opening, and
  *Open time* / *Close time* smooth it.
- **Mouth shape**, set by *Mouth shape from*:
  - **Formants** (default): vowels, s/sh/f and closed lips, described below.
  - **Brightness only**: the earlier method. It is one dark ↔ bright axis, so
    it only really tells "ah" from "oo".
  - **Loudness only**: the jaw, nothing else.

  In formant mode each frame is read as one of:
  - **Vowel.** A pitched frame (periodicity ≥ 0.5) gets F1 and F2 from a
    14th-order LPC fit at 12 kHz (`src/live/features.ts`). They are matched
    against ten reference vowels from klattsch's Klatt (1980) bank
    (`src/live/vowels.ts`) in log-frequency space, after dividing by an
    adaptive **speaker scale**. The scale is the stretch that best fits recent
    vowels (1 = adult male, ~1.15 adult female, ~1.3 child) and adapts over
    about 2 s. The three nearest vowels' mouth poses are blended; they are the
    same designed visemes the text pipeline uses. Their openness is then
    scaled by loudness.
  - **Fricative.** Unvoiced hiss (low periodicity, more than 35% of power
    above 2.5 kHz) is placed by its frequency centre: above 5.2 kHz → **s**
    (teeth together, spread), 2.8–5.2 kHz → **sh** (rounded), lower → **f**.
  - **Closed lips** (m, n, b): a pitched hum with more than 95% of its power
    below 500 Hz *and* at least 8 dB below recent speech. *Unverified on real
    speech* (see Known limitations).
- The **Vowel map** section plots your live F1/F2 on a vowel chart (front
  left, open down) against the reference vowels at your speaker scale, with a
  one-second trail.
- **Puppet output off** stops the estimator. Only the level meter keeps
  running.
- The timeline shows the last 6 s on a −90..0 dBFS scale: input level, noise
  floor, the "opens above" threshold, and the three controls.
- **Latency** section: input latency (the track's reported latency, or
  `baseLatency`), half the analysis window, the open-time smoothing, and the
  display frame are added up into an estimated microphone-to-mouth delay.
  With the defaults this is about 60 ms.

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

## Debug puppet

Pick **Puppet view → Debug (instructions only)** on either page. The 3D face is
replaced by a diagram of the control stream itself:

- **Shape**: a mouth outline sized by the controls. Height follows `jawOpen`,
  width follows `lipWidth − lipRound`, and a dashed ring grows with
  `lipRound`. Faint outlines trail the last few frames.
- **Arrows**, one axis per control: jaw is vertical (down = opening), width is
  horizontal from both corners (outward = widening), and rounding is diagonal
  from the ring (outward = rounding).
  - **Solid arrow = velocity**: the direction the control is moving, with
    length proportional to speed (45 px per unit/s).
  - **Outlined arrow = force**: the push on the control, i.e. its
    acceleration, treating each control as a unit mass (1.6 px per unit/s²).
    For example, a jaw that is still opening but already slowing shows a solid
    arrow down and an outlined arrow up.
- **Table**: value, velocity (units/s) and force (units/s²) for each control.

Velocity and force come from `src/puppet/motion.ts`. It is a host-agnostic
`MotionTracker` that differentiates whatever controls the host receives
(playback, relaxing after stop, or a future live source), with 20/40 ms
smoothing. The debug puppet is a second host for the same control format,
which shows the format isn't tied to the 3D face.

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
- **Live analysis** (`src/live/`) turns audio frames into `FaceControls`.
  `features.ts` handles spectrum, LPC formants and periodicity, `vowels.ts`
  the reference vowels and speaker scale, and `estimator.ts` combines them
  with loudness. `ptVoice.ts` renders Pink Trombone test voices. None of it
  touches the microphone or Web Audio, which live in `src/apps/live.ts`.
- **UI** (`src/ui/puppetView.ts`) holds the page shell, the transport bar, the
  meters and the `PuppetView` (face or debug puppet). `src/ui/stage.ts` adds
  utterance playback and the timeline for the babble and klattsch pages. The
  live page uses `PuppetView` directly.
- **Engines**: every sound source produces an `Utterance`, which is a
  `Timeline` (sounds with timing) plus `render(sampleRate)`. klattsch's
  utterance comes from `klattschUtterance()` and Babble Engine's from
  `src/engines/babbleEngine.ts`. The puppet generator reads only the
  `Timeline`.
- **Debug host** (`src/host/debug.ts`) draws the controls and their motion
  (`src/puppet/motion.ts`) on a 2D canvas, with no Three.js.
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
| Second engine | Babble Engine 1.4.0 (MIT), installed from GitHub pinned to commit `c1d0571`. It isn't on the npm registry. | It is the feature-direction reference and does text-to-babble end to end, so it's the most useful comparison with klattsch. I read the pinned source before installing: it is a self-contained synthesizer with no network, storage or file access. |
| Babble Engine mouth shapes | Letters of each invented syllable → onset + vowel codes, plus syllable ends from audio loudness | The engine reports no per-sound identity. This reuses the existing generator and face mapping unchanged. |
| Debug "force" | Acceleration of each control (unit mass), next to velocity | "Direction" is the sign of the velocity. "Force" is the push that changes it, which shows easing in and out more clearly than speed alone. |
| Cartoon-teacher voice | Our own additive muted-trombone synth, driven by the existing babble + klattsch timing and pitch | The sound is a brass instrument with a plunger mute, so a small purpose-built synth gets closer than a speech synth. Reusing the performance keeps the face in exact sync. Babble Engine's *Talking Instruments → trombone* voice is another option already on the page. |
| Trombone rendering speed | Rotating phasors instead of a `sin()` per harmonic per sample | 6.5 s of audio renders in 76 ms instead of 295 ms, so sliders stay responsive. |
| Live jaw | Loudness above an adaptive noise floor, capped relative to a decaying recent peak | The brief asked for loudness-driven jaw first. The peak cap fixes a jaw stuck fully open in a quiet room (seen with the test signal). |
| Live mouth shape | LPC formants matched to reference vowels with an adaptive speaker scale, plus fricative and closure cues. Brightness-only is kept as a mode. | Brightness gave only one axis (ah ↔ oo). Formants are the cue that transfers best between voices, and the vowel poses reuse the text pipeline's visemes. |
| Pink Trombone's role | A second, articulatory test voice (held vowels, vowel sweep, live test signal), not the inversion model | I first tried matching the whole spectral envelope against a 252-entry Pink Trombone tract codebook. It recovered Pink Trombone's own shapes but read klattsch's "oo" as an open "ah": envelope shape carries each voice's brightness. Formants transfer, so the analysis matches formants and Pink Trombone checks it on a voice it wasn't tuned on. |
| Pink Trombone package | `pink-trombone-mod` 0.1.0 from npm (MIT), imported as `pink-trombone-mod/Synthesizer.js` | I read its synth modules before installing: plain TypeScript with no network, storage or DOM use (only its demo UI, which we don't import, touches the page). It has no package entry point, and its extensionless imports need Vite to process it in tests (`server.deps.inline`). |
| LPC order | 14 at 12 kHz | Orders 8–12 locked onto harmonics for voices above ~180 Hz ("oo" read as 890/2240 Hz). Order 14 keeps "oo" at 330–410 / 990–1180 Hz up to 300 Hz pitch. |
| Lip rounding source | Vowel match only | Mixing in spectral darkness raised klattsch scores (0.27 → 0.41) but made Pink Trombone's "ee" look rounded (0.3–0.7). It depends on the voice, so it was left out. |
| Closure rule | Low-band share above 0.95 and at least 8 dB below the recent peak | The low-band share alone can't separate "m" from "oo" (both 0.97–1.0). Neither test synth models a nasal murmur's lower level, so the rule follows phonetics and is marked unverified. |
| Live page structure | A separate page, sharing `PuppetView` and the control format | Live input has no utterance or timeline, so it doesn't fit `Stage`. Sharing the puppet view keeps hosts identical. |
| Layout | Transport and meters under the face, a scrolling panel with collapsible sections, 380 px wide | The panel had grown taller than the window with three engines. Always-used controls now stay next to the face. |
| First play | Re-render only when the device sample rate differs from the prepared audio | First Play used to re-render, delaying the start by up to ~0.3 s with the trombone. |
| Package versions | three 0.187, vite 8.3, typescript 7.0, vitest 5.0 | Latest at the time of writing. |

## Verification

Environment: macOS 26.6.2, Node 26.12.0, npm 11.20.0, and the Claude desktop
app's built-in browser (Chromium) at an `AudioContext` sample rate of 48 kHz,
`baseLatency` 5.3 ms and `outputLatency` 32 ms.

**Automated** (`npm test`, 113 tests, all passing). Live mouth shapes
(23 tests in `tests/liveShapes.test.ts`):

- **LPC formants** on klattsch AA, AH, IY and UH at 110 and 220 Hz are within
  15% of the bank's targets. Pink Trombone's ah has F1 > 600, ee has
  F2 > 1800, and oo has F2 < 1000. Periodicity separates a tone (> 0.9, pitch
  ≈ 150 Hz) from noise (< 0.3).
- **Vowel matching** maps each reference vowel to itself. A 20%-shifted "ee"
  still reads as "ee" at scale 1.2, and the scale search picks a value
  above 1.
- **Held sounds, klattsch**: AA opens the jaw (> 0.6), IY is wide and nearly
  closed, UW is rounded, EH is spread and half open, S has the teeth together,
  and SH is rounded.
- **Held sounds, Pink Trombone** (not tuned on): AA opens, IY is wide, and UW
  is rounded above 0.8.
- **Pink Trombone sweep** ah → ee → oo: the jaw is highest on ah, width is
  above 0.5 on ee, and rounding above 0.6 on oo.
- **Closure rule**: a constructed signal, a buzzy vowel then a hum 14 dB
  quieter, reads as closure, with the jaw below 0.1.
- **Whole sentences** (objective score): each control is correlated with the
  face track the text pipeline makes for the same rendered sentence, over
  four sentences, each in a larger voice (scale 1, 120 Hz) and a smaller one
  (scale 1.15, 200 Hz):

  | Mode | jaw | width | round |
  | --- | --- | --- | --- |
  | Loudness only | 0.50 | — | — |
  | Brightness only (before) | 0.50 | 0.10 | 0.40 |
  | **Formants (now)** | 0.49 | **0.58** | 0.27 |

  Lip width went from essentially uncorrelated to clearly tracking, and the
  jaw is unchanged. Rounding is the weakest control: on klattsch sentences
  the old brightness cue scores higher. As above, that cue doesn't hold
  across voices.
- **Speaker scale**: a smaller voice ends with a larger scale than a bigger
  one.
- **Speed**: the analysis takes under 4 ms per frame, inside a 16.7 ms frame.

Trombone (5 tests):

- `f0Curve` matches klattsch's base pitch and reaches a +60 Hz glide.
- Rendered pitch, by autocorrelation, is within 5% of the speech pitch.
- The plunger is more open on AA than UW, loudness is above 0.9 on vowels, and
  below 0.15 in a 200 ms pause.
- Spectral centroid on AA is at least 1.3× that on UW: the *wah*.
- Output is deterministic and normalized to a 0.7 peak, and the jaw follows
  loudness (r 0.56, within 60 ms).

Live estimator (8 tests):

- Level and centroid are measured correctly. Silence and quiet noise keep the
  mouth closed (< 0.02).
- A loud voice opens the jaw above 0.7 within 100 ms, and it closes below 0.05
  after the voice stops.
- A hum that starts in a quiet room first opens the mouth, then is learned as
  the floor within 8 s.
- Against digital silence, a soft sound opens the mouth at least 0.4 less than
  a loud one.
- Sensitivity ×2 opens at least twice as far as ×0.5. Dark tones read as
  rounded, bright tones as wide.
- On rendered speech fed frame by frame, the jaw follows the loudness envelope
  with r = 0.87, 33 ms behind the sound (never ahead).

Engines and motion (20 tests):

- `MotionTracker`: rising/falling controls give positive/negative velocity
  (0.1 per frame at 60 fps → 6/s). x = t² gives force ≈ 2. Constant speed and a
  still pose give no force.
- Babble Engine adapter: syllable letters → sounds (`zah` → S AA, `Noo` → N UW,
  `Ou` → AW, `ya` → Y AA, …). Syllables end at silence and gaps become pauses,
  and output is deterministic per seed. For the *sim*, *animal*, *grumble* and
  *droid* styles: the audio is audible, the jaw opens above 0.5, the mouth is
  closed (< 0.05) in the pause after "there!", and jaw/loudness r > 0.3.

Babble (39 tests):

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

**In the browser, live formant mode** (Pink Trombone vowel sweep as input):

- The face moved through distinct shapes:
  - ah: jaw 0.85, read as AA at 750/1100 Hz;
  - ee: width 0.89, jaw 0.42, read as IY at 290/2030 Hz;
  - oo: rounding 1.00, width 0, read as UW at 315/750 Hz;
  - eh: width 0.58, jaw 0.59, read as IH (its neighbour) at 500/2250 Hz;
  - then back to ah.
- The speaker scale settled at ×1.09. The vowel map showed the live dot and
  trail moving between reference vowels. No console errors.

**In the browser, layout, trombone and live mode**:

- The new layout renders on all four pages. At 375 px wide, neither the babble
  nor the live page scrolls sideways.
- Babble page, all three engines playing the sample greeting: klattsch (level
  0.24, r 0.67), trombone (level 0.09, r 0.71) and Babble Engine
  *animal/fern* (level 0.24, r 0.51). Each engine shows only its own
  controls, and `?engine=trombone` preselects the trombone.
- Live page with the test signal:
  - Loud vowels open the jaw 0.96–0.99, softer sounds 0.55–0.75, and gaps
    close to 0.01–0.02.
  - The threshold sits about 30 dB below the recent peak, and lip rounding
    rose to 0.4–0.8 on dark vowels.
  - The latency section showed 5.3 ms input, a 21.3 ms window, 25 ms
    smoothing and a 20 ms frame, about 61 ms in total.
  - Puppet off stopped the estimator (run count unchanged) and the face went
    neutral. The debug puppet worked on live input.
- **The real microphone was not tested.** The desktop app's browser pane
  blocks microphone access. The page reported "Permission denied" and stayed
  usable. Mic input needs checking in a normal browser.
- No console errors on any page in a fresh tab.

**In the browser, Babble Engine and the debug puppet**:

- Babble Engine *Babblish/Lottie* on "Hello there! How are you today?": output
  level 0.19, the face reached AA (jaw 0.90), and the English highlight moved
  from *Hello* to *How*. Diagnostics: r = 0.57, with the jaw leading by 10 ms.
  *Grumble/Angry* gave `Ou mo du gu Noo goo` and the face reached AW.
- Jaw/loudness correlation for all 15 text styles on that line ranged from
  0.35 to 0.79. Most were aligned within ±40 ms, but *Gizmo*, *Ghost* and
  *Soft Tones* had the jaw 70–100 ms behind, likely because those voices
  swell in slowly. Each line rendered in 6–125 ms.
- Debug puppet during klattsch babble: while closing, the jaw showed velocity
  −1.60/s with force +54/s² (slowing before reopening). While opening, it
  showed +6.8/s, with width arrows pointing outward.
- Puppet off with Babble Engine: audio played (level 0.29), the face stayed
  neutral, and the generator didn't run.
- Each engine shows only its own controls. Both pages had no console errors in
  a fresh tab.

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

- Live mode was only verified with synthetic voices (klattsch and Pink
  Trombone), not a real microphone, which the desktop app's browser pane
  blocks. Mic levels vary widely, so *Sensitivity*, *Gate* and *Loudness
  range* may need tuning per setup. Analysis runs once per display frame, so
  a background tab stops it.
- Formant mode limits:
  - **Rounding** is the weakest control (sentence r 0.27).
  - **Very high voices** (above ~300 Hz) can still confuse F1 with a
    harmonic.
  - **eh** tends to read as its neighbour ih.
  - **f** sometimes reads as sh at higher pitch.
  - The **speaker scale** needs a second or two of varied vowels to settle;
    a single held vowel can be explained by several scales.
  - **Closed-lip detection** (m, n, b) follows the usual phonetics, but no
    test voice reproduces a real nasal murmur's lower level. klattsch's and
    Pink Trombone's "m" are as loud as their vowels. Expect it to need tuning
    on a real voice.
  - Other consonants (t, d, k, l, r …) aren't classified. Their mouth shape
    follows loudness and the surrounding vowel.
- The trombone renders the whole line before playing, like the other engines.
  It is not a live instrument, and it doesn't follow the microphone.

- Babble Engine mouth shapes are guessed from romanized syllable text, and
  syllable ends from loudness. *Critter Chatter* speaks letter by letter, so
  its mouth follows letters. Styles with slow-onset sounds lag by up to
  ~100 ms. Babble Engine's own room/reverb (`play()`) isn't used, so its audio
  plays dry.
- The debug puppet differentiates frame by frame, so very uneven frame timing
  makes the force readout jumpy. Long arrows are clipped at 150 px.

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
