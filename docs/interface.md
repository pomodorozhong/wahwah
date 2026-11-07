# Performance interface

`@wahwah/performance` is how another project plays a wahwah performance without the playground. It holds the mouth controls, the timed face track, the rendered utterance and the helpers to sample them. It has no dependencies and no browser, Three.js or WASM code. The wider layout and distribution plan is in the [packaging plan](packaging.md).

## Install

Each release is a tarball on [GitHub releases](https://github.com/pomodorozhong/wahwah/releases), tagged `performance-v<version>`. Install it by URL, which records the file's hash in your lockfile:

```bash
npm i https://github.com/pomodorozhong/wahwah/releases/download/performance-v0.1.0/wahwah-performance-0.1.0.tgz
```

To develop both projects together, link the package instead: `npm i file:../wahwah/packages/performance`. Run `npm run build:packages` in `wahwah` first, because the package exports compiled `dist/` files.

## What it contains

| Name | Purpose |
| --- | --- |
| `FaceControls` | `jawOpen`, `lipWidth` and `lipRound`, each in [0, 1]. Neutral is all zeros. |
| `FaceControlTrack`, `FaceControlSample` | Timed controls at a fixed rate. |
| `RenderedUtterance` | `engine`, `warnings`, `audio`, a `Timeline` and an optional face track. |
| `Timeline`, `PerformanceSegment` | The sounds on a timeline, with source text ranges. |
| `sampleFaceTrack(track, seconds)` | Controls at a time on the playback clock. Neutral outside the track. |
| `segmentAt(timeline, seconds)` | The sound or pause at a time. |
| `normalizeControls`, `lerpControls`, `NEUTRAL`, `CONTROL_RANGES` | Range rules and interpolation. |

## Playing a performance

A host schedules the audio on its clock, samples the track at the time that is audible, and maps the controls onto its rig:

```ts
import { sampleFaceTrack, type RenderedUtterance } from '@wahwah/performance';

function controlsNow(utterance: RenderedUtterance, startedAt: number, now: number) {
  return utterance.track ? sampleFaceTrack(utterance.track, now - startedAt) : null;
}
```

The playground is the worked example. [`src/ui/stage.ts`](../src/ui/stage.ts) runs the playback clock and samples the track. [`src/host/vrm.ts`](../src/host/vrm.ts) and [`src/host/mappings.ts`](../src/host/mappings.ts) drive the Tofu VRM from the controls. A test keeps the host files off the voice engine, live input and UI, so the example uses only what an outside project also has.

## Versions

- Releases follow `MAJOR.MINOR.PATCH`. Until 1.0 the format may still change.
- Adding a field or helper is not breaking. Renaming or removing one, or changing a range, is, and bumps the minor version before 1.0 and the major version after it.
- [`CHANGELOG.md`](../packages/performance/CHANGELOG.md) says what changed in each release.

## Releasing

Update the version in `packages/performance/package.json` and the changelog, merge, then push the tag:

```bash
git tag performance-v0.1.0
git push origin performance-v0.1.0
```

The release workflow checks that the tag matches the package version, tests the package, builds it, and attaches the tarball to a GitHub release. To check a build first, run `npm run pack:performance`, which writes the tarball to `release-assets/`.
