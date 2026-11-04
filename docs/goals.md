# Project goals and decisions

How much character can a puppet get from a few well-timed mouth shapes?
The playground is where we try voices, calibrate microphones, and watch the
same performance on different faces.
The longer-term goal is a small library that other projects can use to drive
a puppet, starting with VTubing and extending to games and animation tools.
[Original prototype brief](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/08-mumble-voice-generator-handoff.md)

## Visual direction

The target is a stylized, front-facing character with readable mouth poses,
small head turns, and secondary motion. Three references suggest different
ways to draw it.

- *Breath of the Wild* uses painterly surfaces and toon shading.
- *Return of the Obra Dinn* makes a scene readable with one-bit monochrome
  and dithering. [Dithering notes](https://dukope.com/devlogs/obra-dinn/tig-32/)
- *Into the Spider-Verse* combines line work, halftones, and poses held over
  multiple frames. A held pose is worth trying on live speech because it may
  read more clearly than a mouth that changes shape on every frame.
  [Imageworks production notes](https://www.imageworks.com/node/1371)

A 2.5D puppet made from warped layers and a full 3D mesh could share the same
look. The intended rendering order is to deform the rig first, then apply
the visual style to its colors and masks. Whether the playground ships one
house style or several switchable styles remains open.

## Design decisions

| Choice | Reason |
| --- | --- |
| Keep input, mouth controls, and character rigs separate. | One utterance or microphone recording can exercise every rig. A future SDK can expose the controls independently of the renderer. |
| Build the playground with TypeScript, Vite, Web Audio, and Three.js. | Voice synthesis, editing, and a live puppet preview can run together in a browser. |
| Target VRM for the Rust/WASM migration. | Focus the supported playground on one avatar format. Keep general mouth controls separate from VRM expressions so a future adapter can consume the same performance. The playground keeps Tofu, VRM, and Debug views. |
| Port the selected voice core before adding more behavior. | No users rely on the current output, so compatibility is not a release constraint. Establish one Rust implementation before adding multilingual input, viewer identities, and duration fitting. |
| Start with a small mouth vocabulary. | Every host can support it. Future layers for blink, gaze, brows, head pose, and mood can be optional and map onto each rig's existing expressions. |
| Evaluate live tracking on a real voice. | A synthetic test can measure lag and jitter. A speaker can judge whether the result looks right for the character and whether delaying the audio feels acceptable. |

The [architecture guide](architecture.md) describes the current input paths,
control format, and renderer mappings.

## Next delivery: Rust/WASM and a hosted VRM playground

The next task is [the Rust/WASM rewrite](https://github.com/pomodorozhong/wahwah/issues/10).
The current TypeScript code is a proof of concept, and the Rust version becomes
the new standard, so matching today's output exactly is not a goal.

Rust will own invented speech, timing and pitch, synthesis, and synchronized
puppet controls. TypeScript continues to host the UI, Web Audio playback,
Three.js, VRM rendering, and live mode. Live analysis stays in TypeScript because
porting it would only help a future native consumer.

The end state keeps six sound choices: Wah-wah trombone, the klattsch formant
voice with Trombone color, and Talking Instruments' Muted Horn, Trombone, Ooh
Choir, and Kazoo from Babble Engine. The puppet views are Tofu, VRM, and Debug.
The project is MIT-licensed and published on GitHub Pages under `/wahwah/`.

The work lands as six PRs, in the order listed on the issue: Rust voices in the
playground, Rust performance, instruments, dependency cleanup, playground
cleanup, and publishing. Rust now owns Mumble generation and synchronized
audio and mouth performances, including the four Talking Instruments voices.
Dependency and playground cleanup are complete. Licensing and Pages are the
remaining step.

After that, add multilingual invented speech including Chinese and mixed-language
text, deterministic viewer-to-character profiles for Twitch, and configurable
fixed-duration output. The distinction between an exact duration and a maximum
duration remains a feature-design choice.

## Longer-term work

- **Reusable packages.** Choose npm library scope and native Python or Apple
  bindings once a consumer needs them. Portability is the motivation for
  Rust; a current performance bottleneck has not been established.
- **More inputs and hosts.** Webcam or ARKit tracking could drive the same
  controls. A custom 2.5D host is an option if the project needs an entirely
  open-source runtime. How much of the body to animate beyond the head
  remains open. [Inochi2D](https://github.com/Inochi2D/inochi2d-docs)
- **Streaming output.** Explore a transparent window, NDI, or Syphon for
  sending a puppet to OBS. Measure the complete path from input to display
  before choosing performance work.

See the [handoff](../HANDOFF.md) for the current work order.

## Design references

- The original face was inspired by the klattsch animation [*take seventeen*](https://crashunited.itch.io/klattsch/devlog/1683093/take-seventeen-a-short-animation-starring-klattsch).
- The [VTubing pipeline notes](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/03-vtubing-pipeline-tech-stack.md) cover 2.5D rigs, tracking, and OBS output.
- For extensions to the control format, see the [VRM specification](https://vrm.dev/en/), [Cubism SDK manual](https://docs.live2d.com/en/cubism-sdk-manual/top/), and [ARKit face-tracking vocabulary](https://developer.apple.com/documentation/arkit/tracking-and-visualizing-faces).
