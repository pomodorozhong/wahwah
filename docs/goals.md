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
| Support both VRM and Live2D. | VRM provides standard vowel expressions on a 3D avatar. Live2D lets us compare how the same performance reads on layered artwork. Both use one renderer. |
| Read Live2D meshes through Cubism Core. | The playground can draw them in Three.js without a second rendering stack. Users supply the runtime and models locally so the project can keep third-party assets out of its distribution. |
| Start with a small mouth vocabulary. | Every host can support it. Future layers for blink, gaze, brows, head pose, and mood can be optional and map onto each rig's existing expressions. |
| Evaluate live tracking on a real voice. | A synthetic test can measure lag and jitter. A speaker can judge whether the result looks right for the character and whether delaying the audio feels acceptable. |

The [architecture guide](architecture.md) describes the current input paths,
control format, and renderer mappings.

## Longer-term work

- **Reusable core.** Once the control format and input behaviour settle,
  extract suitable pieces into Rust for use through WASM, npm, Python, and
  Apple packages. Portability is the reason for the extraction. The first
  package and its minimum set of controls are still open.
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
