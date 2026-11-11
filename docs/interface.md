# The wahwah package

`wahwah` is how another project uses the voice engine and plays a performance without the playground. It holds the Rust/WASM engine, the mouth controls, the timed face track, the rendered utterance and the helpers to sample them. The wider layout and distribution plan is in the [packaging plan](packaging.md).

## Install

Each release is a tarball on [GitHub releases](https://github.com/pomodorozhong/wahwah/releases), tagged `v<version>`. Install it by URL, which records the file's hash in your lockfile:

```bash
npm i https://github.com/pomodorozhong/wahwah/releases/download/v0.1.0/wahwah-0.1.0.tgz
```

The tarball includes the compiled WASM, the licence and the third-party notices, so no Rust toolchain is needed. To develop both projects together, link the package instead: `npm i file:../wahwah/packages/wahwah`. Run `npm run build:packages` in `wahwah` first, because the package exports compiled `dist/` files.

## Entry points

| Import | Contents |
| --- | --- |
| `wahwah/performance` | Types and helpers only. It never loads WASM, so a host that just plays performances can use it alone. |
| `wahwah` | The voice engine and everything in `wahwah/performance`. |
| `wahwah/mumble` | The Mumble generator and tokenizer. Unstable: it exposes the shapes of the Rust code and may change in any release. |

## What it contains

| Name | Purpose |
| --- | --- |
| `loadVoices(source?)` | Loads the WASM once. A bundler needs no argument. In Node, pass the `.wasm` bytes. |
| `renderMumble`, `renderPhonemes`, `renderInstrument` | Render a line to a `RenderedUtterance`. |
| `STYLES`, `MOODS`, `INSTRUMENTS`, `DEFAULT_VOICE`, `DEFAULT_TROMBONE` | The voice settings and presets. |
| `FaceControls` | `jawOpen`, `lipWidth` and `lipRound`, each in [0, 1]. Neutral is all zeros. |
| `FaceControlTrack`, `FaceControlSample` | Timed controls at a fixed rate. |
| `RenderedUtterance` | `engine`, `warnings`, `audio`, a `Timeline`, an optional face track, and `fit` when a maximum duration shortened the line. |
| `DurationFit` | What a maximum duration did: `naturalSeconds`, `speed` and `truncated`. |
| `Timeline`, `PerformanceSegment` | The sounds on a timeline, with source text ranges. |
| `deriveVoice(hash, mapping)` | A repeatable character voice from a caller-provided hash. See [Character voices from a hash](#character-voices-from-a-hash). |
| `sampleFaceTrack(track, seconds)` | Controls at a time on the playback clock. Neutral outside the track. |
| `segmentAt(timeline, seconds)` | The sound or pause at a time. |
| `normalizeControls`, `lerpControls`, `NEUTRAL`, `CONTROL_RANGES` | Range rules and interpolation. |

## Playing a performance

A host renders a line, schedules the audio on its clock, samples the track at the time that is audible, and maps the controls onto its rig:

```ts
import { DEFAULT_VOICE, loadVoices, renderMumble, sampleFaceTrack } from 'wahwah';

await loadVoices();
const utterance = renderMumble('Hello there!', { seed: 3 }, DEFAULT_VOICE, 48000, { engine: 'formant', brassColor: 0.75 });
const controlsNow = (startedAt: number, now: number) => sampleFaceTrack(utterance.track!, now - startedAt);
```

The playground is the worked example. [`apps/playground/src/ui/stage.ts`](../apps/playground/src/ui/stage.ts) runs the playback clock and samples the track. [`apps/playground/src/host/vrm.ts`](../apps/playground/src/host/vrm.ts) and [`apps/playground/src/host/mappings.ts`](../apps/playground/src/host/mappings.ts) drive the Tofu VRM from the controls. A test keeps the host files off the voice engine, live input and UI, so the example uses only what an outside project also has.

## Character voices from a hash

`deriveVoice(hash, mapping)` turns a hash into voice settings that always come out the same, so a viewer, player or save slot keeps one voice. Call it after `loadVoices()`.

```ts
const voice = deriveVoice(hexDigest, VOICE_MAPPING_V1);
renderMumble('Hello there!', { seed: voice.seed, styleId: voice.styleId }, voice.settings, 48000, { engine: 'formant', brassColor: voice.brassColor });
```

- **The hash is yours.** Hash a stable identifier with a salt of your own, so the same identifier gives a different voice in each app. Pass at least 16 bytes, as a `Uint8Array` or as hex digits in either case, with no prefix. A shorter hash, bad hex or an unknown mapping throws. wahwah never sees the identifier. Account lookup and chat data stay with the caller.
- **The mapping version is required.** A released mapping never changes its ranges, its style list or its results, and tests pin one output. A change ships as a new mapping number, and callers move to it when they choose.
- **Each setting is drawn on its own.** HKDF-SHA256 ([RFC 5869](https://www.rfc-editor.org/rfc/rfc5869)) expands the hash under one label per setting, such as `wahwah/character-voice/v1/pitch`. A setting added later gets a new label and cannot move the others.
- **What comes back** is plain data: pitch 85–220 Hz, 85–140 ms per phoneme, formant scale 0.85–1.25, one of the `bubbly`, `chirpy` and `grumbly` styles, a seed, a brass color, and trombone settings. The mood is not part of it. Choose one per line.

A Twitch example: hash the viewer's numeric user ID with your own salt, using SHA-256, and pass the digest. wahwah does not know about Twitch.

## Maximum duration

Every render call (`renderMumble`, `renderPhonemes`, `renderInstrument`) takes an optional last argument, `maxDurationSeconds`, from 0.1 to 600.

```ts
const utterance = renderMumble(text, options, voice, 48000, { engine: 'formant', brassColor: 0.75 }, true, 4);
utterance.fit; // { naturalSeconds: 9.3, speed: 1.6, truncated: true }
```

- **A line that fits is untouched,** except that it can lose one trailing sample to stay within `floor(cap × sampleRate)`. `fit` is empty.
- **A longer line is sped up first,** by at most 1.6 times by default, without changing pitch. Every time on the score is scaled together, so the audio, the timeline and the face track still line up.
- **If that is not enough, the end is cut** at the cap with a fade (80 ms, linear, unless you set `cutFade`), the mouth closes at the cut, and `warnings` says so. The words after the cut are not in the timeline or in `script.words`; `script.phonemes` still holds the whole line.
- **The fade is yours to shape.** Pass `fit.cutFade` after the cap: `{ milliseconds: 0–5000, curve: 'linear' | 'smooth' | 'quick' | 'decibel' | 'none', exponent: 0.1–8, endVolume: 0–1 }`, each part optional. `smooth` is a half cosine, `quick` drops fast and then trails off, `decibel` is a straight line in decibels down to -60 dB, and `none` or 0 ms is a hard cut. `exponent` bends the curve (above 1 holds the volume longer, below 1 drops sooner) and `endVolume` is the volume the fade stops at, 0 by default. A fade longer than the audio is held to it. Only a line that was cut is faded.
- **The speed-up is yours to shape.** Pass `fit.speedUp`: `{ profile: 'constant' | 'rampUp' | 'rampDown' | 'smooth', max: 1–3 }`. `constant` is the default. `rampUp` starts at normal speed and gets faster toward the end, `rampDown` does the reverse, and `smooth` is an eased ramp up. `max` is the fastest the line gets, and 1 turns the speed-up off, so a long line is only cut. `fit.speed` is then the average speed and `fit.peakSpeed` the fastest.
- **A cut can fall between words.** Pass `fit.cutAt: 'word'` (the default is `'anywhere'`). The line then ends where the last word that fits whole ends, and the fade shapes that ending. `fit.atWord` is true and `fit.cutSeconds` says where. The audio can end a little before the cap, and the words after the cut are not in the timeline. In a Mumble line a word is a word of the text. In a phoneme script it is a run of sounds between pauses, so a script without pauses is one word. If not even the first word fits, the line is cut at the cap, and `warnings` says so.
- **The volume can change along the line.** Pass `fit.volume`: `{ profile: 'constant' | 'rampUp' | 'rampDown' | 'smooth', level: 0–2 }`, with the same shapes as the speed-up. `constant` holds `level` (1 is the voice's own volume), `rampUp` goes from 1 to `level` over the line, `rampDown` from `level` to 1, and `smooth` is an eased ramp up. A level above 1 boosts, and the result is kept within full scale. It applies to a line that was fitted, before the fade, and the default changes nothing.
- **The cap counts everything,** including the pauses and the synthesis tail. The audio is never longer than `floor(cap × sampleRate)` samples, and the timeline and track end by the cap.
- **Exact durations are separate.** Stretching a short line to a requested length is [#20](https://github.com/pomodorozhong/wahwah/issues/20).

## Versions

- Releases follow `MAJOR.MINOR.PATCH`. Until 1.0 the format may still change.
- Adding a field or helper is not breaking. Renaming or removing one, or changing a range, is, and bumps the minor version before 1.0 and the major version after it.
- [`CHANGELOG.md`](../packages/wahwah/CHANGELOG.md) says what changed in each release.

## Releasing

Update the version in `packages/wahwah/package.json` and the changelog, merge, then push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow checks that the tag matches the package version, builds the WASM, tests the package, and attaches the tarball to a GitHub release. To check a build first, run `npm run pack:wahwah`, which writes the tarball to `release-assets/`.
