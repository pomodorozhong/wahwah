# Goals

What this project is for, the decisions behind it, and where it is going.
Current state and the next task live in [`HANDOFF.md`](../HANDOFF.md); how
things work today lives in the [README](../README.md). *(As of 2026-11-01.)*

## Goal

A **stylized talking face**: a puppet that speaks invented voices and follows
a live voice, built to be fun to make and play with. Realism is never the
goal. The moonshot visual target is the stylization of *The Legend of Zelda:
Breath of the Wild*, *Return of the Obra Dinn* and *Spider-Man: Into the
Spider-Verse*.

The project ends up as two things:

- **A playground** for setting up and tuning parameters: voices, mappings,
  calibration, characters and visual style, with the debug views needed to
  see why a face moves the way it does.
- **A library/SDK** that the user and others can drop into other projects:
  VTubing first, but not limited to it (games, animation tools, chat
  characters).

The face is the center. Voice engines and live analysis are the **inputs**
that drive it through one host-agnostic puppet instruction format, and any
face (procedural, VRM, Live2D, or a future custom 2.5D puppet) is a **host**
that maps those instructions onto its own rig.

## Module boundaries

```text
Text / phonemes → voice engine (klattsch, Babble Engine, trombone) → audio
        └──────────→ puppet instruction generator ─┐
Microphone → live voice analysis ──────────────────┼→ puppet instructions
(later) Webcam / ARKit face tracking ──────────────┘     (host-agnostic)
                                                               │
                                     host adapter → rig → style pass → output
                                       ├ preview face (procedural Three.js)
                                       ├ VRM (three-vrm)
                                       └ Live2D (Cubism Core drawn in Three.js)
```

- **Inputs** produce timed instructions and know nothing about rigs.
- **Puppet instructions** are the contract. They stay independent of Three.js
  and of any one avatar format.
- **Hosts** map instructions to a rig. A host owns cosmetic motion the format
  does not carry (idle sway, physics), and how it reads.
- **Style** is a separate stage after the rig, so the same puppet can switch
  looks (see below).

## Puppet instruction format

Today it is three mouth controls in [0, 1]: `jawOpen`, `lipWidth`,
`lipRound` (see the README's control format). Direction:

- **The mouth stays the core contract**, so every input and every host
  supports at least that.
- **It grows in layers** for VTubing and expressive characters: blink and
  gaze, brows, head pose, and expression or mood. Hosts that lack a layer
  ignore it.
- **It maps onto existing standards rather than copying one.** Each host
  documents its mapping: Live2D's standard parameter IDs (`ParamMouthOpenY`,
  `ParamMouthForm`, `ParamEyeLOpen`, `ParamAngleX`…), VRM expressions
  (`aa ih ou ee oh`, `blink`, `happy`…), and ARKit blendshapes as the common
  face-tracking vocabulary (VTube Studio, MediaPipe).

## Visual direction

Stylized, front-facing characters with convincing small head turns,
expressions and some secondary motion, not a freely rotating realistic
humanoid. Two ideas carry over from the
[VTubing pipeline note](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/03-vtubing-pipeline-tech-stack.md):

- **Dimensionality and rendering style are separate.** A 2.5D puppet
  (layered artwork warped and parallaxed for depth cues) is a representation;
  cel shading is a look. 2.5D may cost less than full 3D, but only measuring
  proves it.
- **Style is a pass, not part of the rig:**
  `puppet deformation → base color and masks → alpha-aware style pass → output`.
  Candidate modes, one hybrid house style or switchable:
  - painterly/toon, after *Breath of the Wild*;
  - 1-bit dithered monochrome, after *Return of the Obra Dinn*;
  - comic print, after *Into the Spider-Verse*: line work, halftones,
    hatching, registration offsets and deliberately stepped motion.

The style goal feeds back into live analysis. Stepped, held poses ("on twos")
are part of the Spider-Verse look, so the live mic may not need perfectly
smooth continuous tracking. Picking clear, readable mouth poses and holding
them could look better and hide jitter. Live mode should be evaluated against
the target style, not against realism.

## Decisions

| Decision | Reason |
| --- | --- |
| Invented, stylized speech only; never realistic speech or faces. | The fun is in the character, and realism is a different project. |
| TypeScript + Vite + Three.js + Web Audio + npm for the playground. | Fast iteration on voice and face together in a browser. |
| One host-agnostic instruction format between inputs and hosts. | Any input can drive any face, and the format is what the SDK ships. |
| Both VRM and Live2D hosts, drawn in the one Three.js renderer. | VRM is an open standard with built-in visemes; Live2D is the mature 2D-puppet baseline. One renderer avoids two WebGL contexts. |
| Live2D drawn from Cubism Core directly, without PixiJS or physics at first. | `pixi-live2d-display` targets PixiJS 6 and is unmaintained; physics and `.motion3.json` need Live2D's Cubism Framework. |
| Third-party models and Cubism Core stay out of git. | Their licenses restrict redistribution; the user downloads them. |
| Live mic quality is a high priority. | It is what makes the face feel alive in VTubing; the approach may change to suit the stylized look. |
| A reusable Rust core compiled to WASM, packaged for npm, Python/uv and Apple, remains a goal. | Portability for the SDK. Not speed: live analysis costs 0.1–0.7 ms per frame. |
| General streaming text-to-voice interfaces stay out of scope. | Not needed for the face. |

## Near-term work order

1. **Host interface.** Split the procedural face out behind a small host
   interface, so the view can switch faces.
2. **VRM host.** Map mouth controls to VRM vowel expressions, plus blink,
   head sway, look-at and spring bones.
3. **Live2D host.** Draw Cubism Core meshes in Three.js with clipping masks;
   map to `ParamMouthOpenY` and `ParamMouthForm`, and use the model's
   `EyeBlink` group, breath and head angles.
4. **Compare faces.** Run all three on the same utterances and live input,
   and record what reads well.
5. **Live mic on a real voice** (HANDOFF.md P-02), judged against the target
   style.

## Later

- A first **style pass** (toon, dither or comic print) on top of the hosts.
- **More instruction layers**: blink and gaze, brows, head pose, mood.
- **Webcam or ARKit face tracking** as another input to the same format, for
  VTubing (MediaPipe Face Landmarker in the browser; ARKit blendshapes from an
  iPhone).
- **A custom 2.5D puppet host**, if Live2D's proprietary runtime or license
  becomes a limit; Inochi2D is the open alternative to study.
- **Output to OBS** (transparent window, NDI or Syphon) and an end-to-end
  performance budget on the user's M2 Pro, measured before optimizing.
- **The Rust core** (HANDOFF.md P-04) once behavior settles.

## Open questions

- Should the visual references become one hybrid style or switchable modes?
- Must the finished SDK stack be open source, or may it depend on Live2D's
  proprietary Cubism Core?
- How far should the instruction format grow before the SDK's first release,
  and should it stay 0–1 controls or adopt part of a standard vocabulary?
- What latency is acceptable for live mode, and is delaying the audio to
  match the face acceptable (see the delay test)?
- Does the puppet stop at the head, or include shoulders and upper-body sway?
- Which platforms does the SDK package first: npm, Python or Apple?

## References

- [klattsch](https://github.com/tgies/klattsch): the phoneme speech engine.
  Its creator's [*take seventeen*](https://crashunited.itch.io/klattsch/devlog/1683093/take-seventeen-a-short-animation-starring-klattsch)
  face first inspired this project.
- [Babble Engine](https://github.com/wrongfloor-dev/babble-engine): reference
  for text-to-gibberish behavior and voice/mood controls.
- [VRM](https://vrm.dev/en/) and [three-vrm](https://github.com/pixiv/three-vrm):
  open avatar format with standard expressions.
- [Live2D Cubism SDK](https://docs.live2d.com/en/cubism-sdk-manual/top/):
  Cubism Core, standard parameter IDs and the free sample models (check each
  license before use).
- [Inochi2D](https://github.com/Inochi2D/inochi2d-docs): open deformable
  2D-puppet alternative.
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
  and [ARKit face tracking](https://developer.apple.com/documentation/arkit/tracking-and-visualizing-faces):
  face-tracking inputs with blendshape outputs.
- [Obra Dinn dithering notes](https://dukope.com/devlogs/obra-dinn/tig-32/) and
  [Imageworks on Into the Spider-Verse](https://www.imageworks.com/node/1371):
  references for the style targets.
- Packaging paths for the Rust core: [wasm-pack](https://wasm-bindgen.github.io/wasm-pack/),
  [maturin](https://www.maturin.rs/), [uv](https://docs.astral.sh/uv/) and
  [Swift binary packages](https://developer.apple.com/documentation/xcode/distributing-binary-frameworks-as-swift-packages).
- History: the original
  [first-prototype brief](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/08-mumble-voice-generator-handoff.md)
  and the [VTubing pipeline note](https://github.com/pomodorozhong/rabbit-holes/blob/master/learning-notes/03-vtubing-pipeline-tech-stack.md)
  in the research repository.
