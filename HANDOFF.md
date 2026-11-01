# Handoff

## In progress

### feat/model-faces

- Task: VRM and Live2D faces from `docs/goals.md`'s work order (no GitHub issue; the repository has no remote). Branched from `feat/prototype` after its `docs:` commit 5b54abb, which replaced the first-prototype brief with `docs/goals.md`.
- PR: none (no remote).
- Code checkpoint: 663949f
- State: every page's *View* menu switches between *Preview face*, *VRM model*, *Live2D model* and *Debug*, all driven by the same three controls and one Three.js renderer. The *Model* menu lists files in git-ignored `public/models/` and can open a `.vrm` file or Live2D folder from disk. Local models on this computer: `VRM1_Constraint_Twist_Sample.vrm` (three-vrm example, no license stated) and Live2D Hiyori free sample with Cubism Core 6.0.1; other computers need their own copies (see README "Character models").
- Verification at 663949f: `npm run typecheck`, `npm test` (156 passed) and `npm run build` passed. In the browser pane on `/klattsch/`: both models load; held poses show open, spread and rounded mouths on each; klattsch playback drives both with idle motion; no console errors. Not run: `/live/` with a real mic on the new faces, and the faces at phone width.
- Known gaps: no Live2D physics or `.motion3.json` playback (needs Cubism Framework); most Live2D models, Hiyori included, draw rounding as a narrower mouth, not a pucker; VRM framing is tuned only on one model.
- Next action: the user compares the three faces on `/live/` with a real mic in a normal browser (work order step 4 and P-02) and says which reads best and what looks wrong.
- Pending: P-01 (create the GitHub repository) also blocks pushing this branch.

### feat/prototype

- Task: first prototype from the original brief (now superseded by `docs/goals.md`), then the follow-ups the user asked for in the same session (no GitHub issue yet; the repository has no remote).
- PR: none (no remote).
- Code checkpoint: 3a7ea16
- State: four playgrounds work. `/klattsch/` is phonemes to klattsch. `/babble/` is English to invented babble, with klattsch, wah-wah trombone and Babble Engine as sound engines. `/live/` is microphone to puppet, with formant, voice-profile and uLipSync-style modes, self-paced calibration, analysis on the audio thread, and the delay test. All pages have a debug puppet view. The user found the generated-voice puppet "quite good" and live mic still "awkward". The live improvements since then are untested on the user's real voice.
- Verification: `npm run typecheck`, `npm test` (147 passed) and `npm run build` passed at 3a7ea16. Browser checks used the demo, test and Pink Trombone voices: calibration flow, worklet at 187 analyses/s, delay test record/match/playback/loop, no console errors in a fresh tab. Not run: any real microphone (the desktop app's browser pane blocks mic access).
- Next action: the user tries `/live/` with a real mic in a normal browser. Calibrate, compare *Your voice profile* and *uLipSync-style* (smoothness 50 vs ~20 ms), and use *Delay test* at 0 ms vs *Match measured lag*. Their answer to "lag, jitter or wrong shapes?" picks the next task (see Ranked work).
- Avoid:
  - Matching whole spectral envelopes against a Pink Trombone tract codebook: it did not transfer across voices.
  - Mixing spectral darkness into lip rounding: it made Pink Trombone's "ee" look rounded.
  - Expecting Rust/WASM to cut live delay: analysis is about 0.1–0.7 ms per frame.
  - Comparing modes with misaligned windows: use window-end alignment, see `docs/development-notes.md`.
- Pending: **P-01** create a private GitHub repository `pomodorozhong/mumble-voice`, add it as `origin` and push `feat/prototype`. Why: creating an outward-facing repository needs approval (pushing a work branch would not). Blocks: resuming on another computer, filing P-02 to P-04 as issues, and any PR.

## Ranked work

1. Compare the preview, VRM and Live2D faces on the same utterances and live input, with the real-mic evaluation of live mode (P-02), judged against the stylized target in `docs/goals.md`. It decides what comes next.
2. A first style pass (toon, 1-bit dither or comic print) on top of the hosts; which style first is the user's call.
3. If live mode still looks awkward with matched delay, decide whether to train a small viseme model in the MetaHuman-plugin style (P-03 needs a decision).
4. Longer-term direction from `docs/goals.md`: extract the stable pieces into a Rust core and WASM/npm/Python/Apple packages (P-04), for portability rather than speed.

## Pending

- **P-02** File issue "Evaluate live mode on a real microphone and choose defaults". Labels: `enhancement`, `needs-decision`. Body: "Live mode has only been verified with synthetic voices (klattsch, Pink Trombone, demo voice); the app's browser pane blocks mic access. In a normal browser, calibrate with the self-paced flow, then compare *Your voice profile* vs *uLipSync-style* (smoothness 50 ms and ~20 ms), and use *Delay test* at 0 ms vs *Match measured lag*. Record which looks least awkward and whether the problem is lag, jitter or wrong shapes. Decide the default mode, the smoothing, and whether delayed audio is acceptable for the intended use. Measured on synthetic speech: profile mode trails the sound by ≈90 ms and is the steadiest; uLipSync at 20 ms reads lip width and rounding better but jitters ~4×; the estimated mic-to-mouth delay is ≈54 ms with the audio-thread analysis." Why: filing issues needs a GitHub repository (P-01) and approval. Blocks: tracking the evaluation.
- **P-03** File issue "Explore a trained viseme model for live mode". Labels: `enhancement`, `needs-decision`. Body: "If calibrated MFCC matching still looks wrong once timing is matched (see P-02), replace or augment it with a small trained model, as Runtime MetaHuman Lip Sync does (a compact transformer on mel spectrograms every 10 ms, 14 visemes or 81 controls; closed source, so only the approach can be copied). Steps: pick a label source (forced-aligned speech such as LibriSpeech + MFA, or TTS with phoneme timing as HeadAudio did), train a small model in Python with uv, export to ONNX, and run it in the browser (ONNX Runtime Web, WASM/WebGPU) through the existing estimator interface and `delayTest.ts` comparisons. Open question: is the effort worth it versus delayed audio?" Why: filing needs P-01 and approval; the direction needs the user's decision. Blocks: nothing until P-02 is answered.
- **P-04** File issue "Plan the Rust core extraction". Labels: `enhancement`. Body: "The brief's long-term direction is a reusable Rust core compiled to WASM and packaged for npm, Python/uv and Apple. Candidates once behaviour settles: the face-control generator (`src/puppet/`), text-to-babble (`src/babble/`), live features and estimator (`src/live/`), the trombone synth. Measured this session: live analysis costs 0.1–0.7 ms per frame, so Rust/WASM is for portability, not live speed." Why: filing needs P-01 and approval. Blocks: nothing now.
