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

- **A line that fits is untouched.** It renders exactly as without a cap, and `fit` is empty.
- **A longer line is sped up first,** by at most 1.6 times, without changing pitch. Every time on the score is scaled together, so the audio, the timeline and the face track still line up.
- **If that is not enough, the end is cut** at the cap with an 80 ms fade, the mouth closes at the cut, and `warnings` says so. The words after the cut are not in the timeline.
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
