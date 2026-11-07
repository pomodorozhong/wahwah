# wahwah

Invented, stylized speech for puppets. A Rust/WASM voice engine renders audio together with timed mouth controls that any host can map onto its own rig.

- `wahwah` is the voice engine and the performance types.
- `wahwah/performance` is only the types and sampling helpers: `FaceControls`, `FaceControlTrack`, `RenderedUtterance`, `Timeline`, `sampleFaceTrack`, `segmentAt`, `normalizeControls`, `lerpControls` and `NEUTRAL`. It never loads WASM.
- `wahwah/mumble` is the Mumble generator and tokenizer. It is unstable and may change in any release.

## Install

Releases are tarballs on [GitHub releases](https://github.com/pomodorozhong/wahwah/releases). Install one by URL:

```
npm i https://github.com/pomodorozhong/wahwah/releases/download/v0.1.0/wahwah-0.1.0.tgz
```

The tarball includes the compiled WASM, so no Rust toolchain is needed.

## Use

```ts
import { DEFAULT_VOICE, loadVoices, renderMumble, sampleFaceTrack } from 'wahwah';

await loadVoices();
const utterance = renderMumble('Hello there!', { seed: 3 }, DEFAULT_VOICE, 48000, { engine: 'formant', brassColor: 0.75 });
const controls = sampleFaceTrack(utterance.track!, 0.3);
```

A bundler such as Vite finds the `.wasm` file by itself. In Node, pass the bytes: `loadVoices(readFileSync(path))`. The playground in the repository is the worked example: see `docs/interface.md`.
