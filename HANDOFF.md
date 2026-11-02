# Handoff

## In progress

### codex/default-tofu-model

- Task: make the selected white, clipped-corner tofu cube the default puppet, update the README images, and default Text to babble to Wah-wah trombone. Ready PR [#7](https://github.com/pomodorozhong/wahwah/pull/7) is open into main. The branch is unlinked and the PR will close no issues. Issue #6 is a separate line-boil experiment.
- Code checkpoint: fe736c1 (trombone default follow-up; original model feature e49e8c7), based on main at 4b97a10 (merged PR #5). The old readme-cleanup P-09 request is obsolete because PR #5 merged.
- State: the original model update is awaiting PR review and merge. The trombone default and matching documentation are committed locally, awaiting P-12 publication approval. The bundled model, generator, default-view integration, and current portrait/pose row are committed and pushed. The source model keeps the selected hinged mouth and body performance, with white shading, a thicker outline, larger eyes, and pale peach cheeks. All other views remain available. Only the selected model is shipped.
- Verification: the trombone follow-up passes typecheck, 165 tests, production build, and whitespace checks. Browser checks confirm the fresh-visit default, trombone playback, and an explicit klattsch URL override. The stale Vite server was restarted before browser verification. Original model verification: model regeneration is byte-identical; typecheck, 165 tests, production build, and diff whitespace checks pass. glTF structural validation has zero errors or warnings (the validator does not validate the VRM extension). The browser loads the VRM, renders the README images, plays generated speech, and switches views and input modes. Physical microphone input and external VRM/Live2D files were not exercised. The documentation-only checkpoint commit does not change runtime behavior.
- Known limitation: M/B/P still reads as a small open smile rather than a sealed mouth. No mouth redesign is included.
- Publication checkpoint: ea06c53 was approved in chat on 2026-11-03 and pushed without force. P-11 is resolved. PR #7 has the approved head, main base, exact title and body, ready status, and no closing issues. GitHub reports no check runs.
- Next action: obtain P-12 approval, push the follow-up without force, update PR #7 to the exact title and body below, and verify the remote head, metadata, and check status. Merging requires a separate instruction.
- **P-10** Optional issue draft, not filed: "Use the white tofu cube as the default puppet". Body: "Start the voice playground with the selected clipped-corner tofu model. Ship the white surface, thick ink border, larger eyes and pale peach blush, preserve the hinged mouth and body performance across inputs, and update the README images. Keep the other face hosts selectable and ship the model generator with tests." Why: the handoff working rules call for an issue draft on an unlinked work branch; filing an additional issue has not been requested. Blocks: nothing; the PR can be published without it.

- **P-12** Push the committed trombone-default follow-up and its handoff checkpoint to the existing PR #7, keeping it ready for review, with the exact revised title and body below. The new behavior was explicitly requested in chat; the previous publication approval covered ea06c53 only. Why: the open-pr skill requires renewed approval when the branch changes. Blocks: publishing the new commit and updating PR metadata only. No labels, reviewers, comments, or issue links are proposed.

PR title: **feat(playground): default to tofu puppet and wah-wah trombone**

Proposed PR body:

> ## What changed
>
> - Start the playground with a bundled white tofu cube: clipped corners, a thick ink outline, larger eyes, and soft peach cheeks.
> - Default Text to babble to Wah-wah trombone while preserving explicit engine URLs and the visit's saved engine choice. Update the README and playground guide to describe the default voice.
> - Drive its hinged mouth, shoulder roll, gaze, and brow accents from the existing face controls. Keep the procedural preview, external VRM, Live2D, and debug views available.
> - Ship the model generator and regeneration command, add geometry and motion tests, and refresh the README portrait and neutral/AA/IY/UW/M image row. Include a browser capture page for reproducing the images.
>
> ## Why
>
> The selected stylized puppet and muted trombone voice should be the first experience when visitors open the playground. The same model stays mounted across text, phoneme, and live input modes, and the README describes the default character and voice.
>
> ## Verification
>
> ### Automated checks
>
> - `npm run build:tofu`: passed; output matches the shipped model byte-for-byte.
> - `npm run typecheck`: passed.
> - `npm test`: passed, 165 tests.
> - `npm run build`: passed.
> - glTF structural validation: zero errors and warnings. The validator does not validate the VRM extension; the model was also loaded with the playground's VRM host.
>
> ### How to verify
>
> 1. Run `npm ci` and `npm run dev`. Open the playground and confirm the white tofu cube is the initial puppet and Voice → Sound engine selects Wah-wah trombone. Play the greeting. Visit `/?engine=klattsch` and confirm the explicit engine choice still works.
> 2. Under Puppet, switch to Preview face and back to Tofu cube. Switch between text, phoneme, and live input modes; the selected cube should remain available.
> 3. Compare the README portrait and five mouth poses with the capture page described in the development notes.
>
> Verified: fresh visits default to trombone, an explicit klattsch URL selects klattsch, generated playback, view and input-mode switching, production asset loading, and both README image renders in the browser.
>
> Reviewer follow-up: physical microphone input and external VRM/Live2D file loading were not exercised for this change.
>
> Known limitation: the current M/B/P target remains a small open smile rather than a fully sealed mouth. This PR preserves the selected mouth design.
>
> ## Related issues
>
> No linked issue; merging this PR will close no issues.

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
