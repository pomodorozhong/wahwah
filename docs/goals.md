# Project goals and decisions

How much character can a puppet get from a few well-timed mouth shapes? The playground is where we try voices, calibrate microphones, and inspect the model-independent puppet instructions. The longer-term goal is a small library that other projects can use to drive a puppet, starting with VTubing and extending to games and animation tools. [Original prototype brief](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/08-mumble-voice-generator-handoff.md)

## What wahwah provides

`wahwah` is a voice engine and playground. It generates invented speech, analyzes a live microphone, keeps audio and mouth motion on one timeline, and describes the mouth movement in a format that does not depend on any model. Other projects build on that. [`wahwah-avatar`](avatar-split.md) is the first: it shows 3D characters, applies visual styles, and connects to Twitch and OBS.

A consumer receives the generated audio and timeline plus timed `FaceControlTrack` samples. It can pass a stable hash to get repeatable voice settings, through a versioned mapping so that later changes to the voices do not alter existing characters. Twitch is only a documentation example: a consumer that hashes a viewer ID owns the account lookup, chat data, and character choice.

Tofu is the reference example of how a VRM model links to those instructions: its model, generator, and control-to-rig mapping live here. It shows the format in use and is not a voice feature. Its mouth-pose bug, [#12](https://github.com/pomodorozhong/wahwah/issues/12), stays here too. Other models, model selection, visual styles, and mouth experiments live in `wahwah-avatar`.

Voice and live-input work lives here: real-microphone evaluation ([#8](https://github.com/pomodorozhong/wahwah/issues/8)), a trained viseme model ([#9](https://github.com/pomodorozhong/wahwah/issues/9)), live visualization ([#13](https://github.com/pomodorozhong/wahwah/issues/13)) and exact-duration fitting ([#20](https://github.com/pomodorozhong/wahwah/issues/20)).

## Design decisions

| Choice | Reason |
| --- | --- |
| Keep input, mouth controls, and character rigs separate. | One utterance or microphone recording can exercise every rig. A future SDK can expose the controls independently of the renderer. |
| Keep voice output independent of avatar rigs. | One audio performance and timed controls can drive different hosts. `wahwah-avatar` owns 3D model rendering and rig mappings. |
| Keep the voice playground browser-based. | TypeScript, Vite and Web Audio support voice synthesis, editing, microphone analysis and diagnostics. Tofu stays as the reference VRM example. |
| Start with a small mouth vocabulary. | Every host can support it. Optional blink, gaze, body motion, and style controls belong to the avatar host that implements them. |
| Evaluate live tracking on a real voice. | A synthetic test can measure lag and jitter. A speaker can judge whether the result looks right for the character and whether delaying the audio feels acceptable. |

The [architecture guide](architecture.md) describes the current input paths, control format, and renderer mappings.

## Shipped foundation

The [Rust/WASM port](https://github.com/pomodorozhong/wahwah/issues/10) is complete, and the MIT-licensed voice playground runs on [GitHub Pages](https://pomodorozhong.github.io/wahwah/). Rust owns generated speech, timing and pitch, synthesis, and synchronized puppet controls for all six voices. TypeScript hosts the UI, Web Audio playback, Three.js, VRM rendering, and live analysis. The playground shows the Tofu and Debug views; `wahwah-avatar` is the home for other 3D models, model selection, and styles.

## Roadmap

1. **Standalone performance interface.** Make `RenderedUtterance` and `FaceControlTrack` importable without the playground, as a versioned package or a pinned git dependency, with a small example that plays a performance on Tofu. `wahwah-avatar` needs this before it can start.
2. **Multilingual invented speech.** Support Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. **Deterministic character voices from a hash.** Expose a general-purpose interface that accepts a caller-provided hash and derives repeatable voice settings through a versioned mapping, so a later change to the mapping cannot silently change existing characters. Use Twitch as a documentation example. An external integration can hash a stable Twitch viewer ID and pass the result to wahwah. The external integration owns account lookup, authentication, and Twitch data handling.
4. **Maximum output duration.** Fit longer lines within a caller-supplied cap while keeping audio and mouth motion synchronized. Shorter lines keep their natural duration.

[Exact-duration fitting](https://github.com/pomodorozhong/wahwah/issues/20) is a P2 follow-up after maximum duration. It should fit either shorter or longer performances exactly to a requested time on the shared audio and mouth timeline.

## Longer-term work

- **Reusable packages.** Beyond the standalone interface, choose npm library scope and native Python or Apple bindings once a consumer needs them. Portability is the motivation for Rust; a current performance bottleneck has not been established.
- **More inputs.** Webcam or ARKit tracking could generate the same model-independent controls. Prioritize an input when a consumer needs it.
- **Additional 3D and 2.5D hosts.** Rig support, model-specific expression mappings and renderer choices belong in `wahwah-avatar`. A custom 2.5D host is an option if that app needs an entirely open-source runtime.
- **Streaming integrations.** Twitch chat and OBS Browser Source are part of the `wahwah-avatar` use case. Consider NDI or Syphon when a consumer needs it.

See the [handoff](../HANDOFF.md) for the current work order.

## Design references

- The original face was inspired by the klattsch animation [*take seventeen*](https://crashunited.itch.io/klattsch/devlog/1683093/take-seventeen-a-short-animation-starring-klattsch).
- The [VTubing pipeline notes](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/03-vtubing-pipeline-tech-stack.md) cover 2.5D rigs, tracking, and OBS output.
- For extensions to the control format, see the [VRM specification](https://vrm.dev/en/), [Cubism SDK manual](https://docs.live2d.com/en/cubism-sdk-manual/top/), and [ARKit face-tracking vocabulary](https://developer.apple.com/documentation/arkit/tracking-and-visualizing-faces).
