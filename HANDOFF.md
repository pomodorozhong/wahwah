# Handoff

## In progress

### codex/unified-voice-studio

- Task: Mustard Block / Writing Spread UI with all three inputs on one page. No linked issue.
- Draft PR: https://github.com/pomodorozhong/wahwah/pull/4 into main, awaiting review. Publication was authorized and completed; P-07 is resolved.
- Code checkpoint: bdea202 (after 2de2fc9), based on main at e275d48. Source is pushed. The earlier avatar-style and mouth experiments remain on the local backup branch.
- State: the home page is Voice playground; the input selector switches text-to-babble, phonemes and live microphone without replacing the puppet or camera. Mode drafts and settings survive switching during the visit. The portrait and signal monitor remain visible while settings scroll. The final monitor uses Ink & Gold with teal width, cream jaw and gold round traces, with matching patterned legends and meters. The preview title and Reset view are inside the bottom of the square.
- Verification: typecheck, 159 tests and production build passed. Chrome verified 60 responsive combinations, engine restoration after reload, legacy routing/history, preserved model/camera/drafts, audio/microphone cleanup (including pending permission), live demo and recorded playback. Physical microphone and touchscreen remain reviewer follow-ups.
- Review server: port 5202, started from this PR worktree.
- Next action: review the draft PR and local preview, then apply any review feedback before marking it ready. No open publication approvals for this branch.

## Ranked work

1. Compare the preview, VRM and Live2D faces on the same utterances and live input, with the real-mic evaluation of live mode (P-02), judged against the stylized target in `docs/goals.md`. It decides what comes next.
2. A first style pass (toon, 1-bit dither or comic print) on top of the hosts; which style first is the user's call.
3. If live mode still looks awkward with matched delay, decide whether to train a small viseme model in the MetaHuman-plugin style (P-03 needs a decision).
4. Longer-term direction from `docs/goals.md`: extract the stable pieces into a Rust core and WASM/npm/Python/Apple packages (P-04), for portability rather than speed.
5. Publish to npm as `wahwah` (the name was free on 2026-11-01): drop `"private": true` and add a library entry point once the stable pieces are chosen (ties to P-04).

## Pending

- **P-02** File issue "Evaluate live mode on a real microphone and choose defaults". Labels: `enhancement`, `needs-decision`. Body: "Live mode has only been verified with synthetic voices (klattsch, Pink Trombone, demo voice); the app's browser pane blocks mic access. In a normal browser, calibrate with the self-paced flow, then compare *Your voice profile* vs *uLipSync-style* (smoothness 50 ms and ~20 ms), and use *Delay test* at 0 ms vs *Match measured lag*. Record which looks least awkward and whether the problem is lag, jitter or wrong shapes. Decide the default mode, the smoothing, and whether delayed audio is acceptable for the intended use. Measured on synthetic speech: profile mode trails the sound by ≈90 ms and is the steadiest; uLipSync at 20 ms reads lip width and rounding better but jitters ~4×; the estimated mic-to-mouth delay is ≈54 ms with the audio-thread analysis." Why: filing issues needs approval. Blocks: tracking the evaluation.
- **P-03** File issue "Explore a trained viseme model for live mode". Labels: `enhancement`, `needs-decision`. Body: "If calibrated MFCC matching still looks wrong once timing is matched (see P-02), replace or augment it with a small trained model, as Runtime MetaHuman Lip Sync does (a compact transformer on mel spectrograms every 10 ms, 14 visemes or 81 controls; closed source, so only the approach can be copied). Steps: pick a label source (forced-aligned speech such as LibriSpeech + MFA, or TTS with phoneme timing as HeadAudio did), train a small model in Python with uv, export to ONNX, and run it in the browser (ONNX Runtime Web, WASM/WebGPU) through the existing estimator interface and `delayTest.ts` comparisons. Open question: is the effort worth it versus delayed audio?" Why: filing needs approval; the direction needs the user's decision. Blocks: nothing until P-02 is answered.
- **P-04** File issue "Plan the Rust core extraction". Labels: `enhancement`. Body: "The brief's long-term direction is a reusable Rust core compiled to WASM and packaged for npm, Python/uv and Apple. Candidates once behaviour settles: the face-control generator (`src/puppet/`), text-to-babble (`src/babble/`), live features and estimator (`src/live/`), the trombone synth. Measured this session: live analysis costs 0.1–0.7 ms per frame, so Rust/WASM is for portability, not live speed." Why: filing needs approval. Blocks: nothing now.
