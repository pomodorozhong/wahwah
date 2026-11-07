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
| `RenderedUtterance` | `engine`, `warnings`, `audio`, a `Timeline` and an optional face track. |
| `Timeline`, `PerformanceSegment` | The sounds on a timeline, with source text ranges. |
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

The playground is the worked example. [`src/ui/stage.ts`](../src/ui/stage.ts) runs the playback clock and samples the track. [`src/host/vrm.ts`](../src/host/vrm.ts) and [`src/host/mappings.ts`](../src/host/mappings.ts) drive the Tofu VRM from the controls. A test keeps the host files off the voice engine, live input and UI, so the example uses only what an outside project also has.

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
