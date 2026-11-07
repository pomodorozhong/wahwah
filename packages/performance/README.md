# @wahwah/performance

Host-agnostic types and helpers for playing a wahwah performance. It has no dependencies and no browser, Three.js or WASM code.

- `FaceControls`: `jawOpen`, `lipWidth` and `lipRound`, each in [0, 1].
- `FaceControlTrack`: timed `FaceControlSample`s that a host interpolates on its own clock.
- `RenderedUtterance`: audio, a `Timeline` of sounds and an optional face track.
- `sampleFaceTrack`, `normalizeControls`, `lerpControls`, `segmentAt` and `NEUTRAL`.

## Install

Releases are tarballs on [GitHub releases](https://github.com/pomodorozhong/wahwah/releases). Install one by URL:

```
npm i https://github.com/pomodorozhong/wahwah/releases/download/performance-v0.1.0/wahwah-performance-0.1.0.tgz
```

## Use

```ts
import { sampleFaceTrack, type RenderedUtterance } from '@wahwah/performance';

function controlsNow(utterance: RenderedUtterance, startedAt: number, now: number) {
  return utterance.track ? sampleFaceTrack(utterance.track, now - startedAt) : null;
}
```

Outside the track the controls are neutral. The playground's Tofu view is the worked example: see `docs/interface.md` in the repository.
