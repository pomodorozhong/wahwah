# Handoff

## In progress

### codex/playground-cleanup

- Task: step 5 of six for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10). The implementation plan was approved in chat. Source work is complete. Publication was approved in chat, followed by an explicit request to continue and add the tested-VRM note.
- PR: [#18](https://github.com/pomodorozhong/wahwah/pull/18), open and ready for review against main at a97b87f. Published with the requested tested-VRM picker note. Title, full body, head/base, commit and empty closing-issue list were verified. GitHub reported no PR checks. The branch is unlinked and closes no issues; #10 remains open for step 6.
- Code checkpoint: 0952130 corrects the picker note to identify pixiv’s VRM1_Constraint_Twist_Sample, on published a97b87f and the step 5 implementation 60aa3ba. Based on main at 2562f67. The user clarified that the tested model means the earlier pixiv sample, not Tofu.
- State: Tofu, VRM and Debug are the only views. Removed Preview face, Live2D, Cubism declarations, Live2D mappings/tests, folder loading/runtime discovery and stencil allocation. Local-model discovery is VRM-only. The stage detaches its 3D host while switching or in Debug and waits for Tofu without a fallback face. VRM selection, camera navigation, idle settings and renderer-independent mouth controls remain. Guides describe the supported views and include the previous mouth-analysis/vowel-map guidance.
- Verification: all six AGENTS.md checks passed, including 36 Rust tests and 220 TypeScript tests across 17 files. The implementation commit independently passed all six checks in a fresh detached checkout after npm ci. Five Live2D tests were removed; four regression tests cover startup, late Tofu completion after selecting Debug or VRM, idle settings and opened-file selection. Browser checks passed for Tofu/Debug playback, Phoneme script, supplied-model VRM loading using the bundled Tofu as an ordinary VRM, model/view retention, orbit/zoom/reset, idle settings, live Demo voice and puppet-off diagnostics. Production preview verified Tofu/Debug playback, input switching and live Demo voice. No browser errors.
- Picker-note follow-up: the user corrected the tested model to pixiv’s VRM1_Constraint_Twist_Sample. The note now names that sample, not Tofu. Restored its existing file locally under the ignored public/models/vrm directory; it is selected in the local development playground. Verified the corrected note, actual sample loading and generated playback in the browser with no errors. All six AGENTS.md checks passed again (36 Rust tests, 220 TypeScript tests). The sample file remains local and must not be committed or published.
- Reviewer follow-up: native Open .vrm file selection, physical microphone and touchscreen gestures. The in-app automated file chooser timed out, so file-opening behavior is covered through its change callback in a regression test. The temporary startup-model fixture was removed before the final build.
- Local review servers: development http://127.0.0.1:5201/ and production preview http://127.0.0.1:5202/. Test audio is stopped. Processes do not transfer to another computer.
- Toolchain: pinned Rust 1.99.1 and wasm-bindgen-cli 0.2.130; direct cargo commands need /opt/homebrew/opt/rustup/bin and ~/.cargo/bin on PATH. No shell profile changes.
- Next action: await review of PR #18. After merge, step 6 adds MIT, Pages workflow and /wahwah/ base path, enables Pages and closes #10. Merging is not authorized.
- P-11 superseded: the user approved carrying forward the documentation checkpoint from codex/rust-playground-cleanup in this implementation PR instead of publishing that older checkpoint separately.
- P-12 resolved: the user approved pushing and opening the reviewed PR, then explicitly requested continuing publication with the added VRM picker note. The initial reviewed tip a361f58 was pushed; publication continues with the requested note. No merge is authorized.
- Proposed title: refactor(playground): remove Live2D and preview face

```markdown
## What changed

- Keep Tofu cube, VRM model and Debug as the three puppet views. Remove Preview face and Live2D, their renderers and Cubism declarations, Live2D mappings and tests, folder loading and runtime discovery.
- Detach the 3D host and camera controls while changing views or showing Debug. Wait for Tofu without a fallback face, and keep the selected view active when loading finishes.
- Make local-model discovery VRM-only. Preserve VRM selection, camera navigation, idle settings and renderer-independent mouth controls. Explain beneath the VRM model picker that this option has only been tested with pixiv’s VRM1_Constraint_Twist_Sample.
- Add regression coverage for startup, asynchronous view switching, idle settings and opened VRM selection. Update the guides and carry forward the mouth-analysis and vowel-map guidance.

## Why

This completes step 5 of the six-step Rust/WASM port. The playground now supports Tofu, VRM and Debug. Licensing and GitHub Pages publication remain step 6.

## Verification

### Automated checks

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed, 36 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 220 tests across 17 files.
- `npm run build`: passed.

Five Live2D-only tests were removed and four view-loading/VRM-selection tests were added. The implementation commit also passed all six checks in a fresh detached checkout after `npm ci`.

### How to verify

1. Run `npm ci` and `npm run dev`. Under Puppet, View should offer only Tofu cube, VRM model and Debug (instructions).
2. Play a line with Tofu. Drag to orbit, scroll to zoom, reset the view and toggle Idle motion.
3. Supply a VRM under `public/models/` before starting Vite, or choose Open .vrm file. Switch between VRM, Debug and Tofu; return to VRM and check the retained model.
4. Switch between Text to mumble, Phoneme script and Live microphone. In live mode, select Demo voice and start it. Change views while it runs, then toggle Puppet output and stop.

Verified in the in-app browser: Tofu and Debug playback, Phoneme script, supplied-model VRM loading (using the bundled Tofu asset as an ordinary VRM), retained model and view selection, orbit/zoom/reset, idle settings, live Demo voice and puppet-off diagnostics. Production preview verified Tofu and Debug playback, mode switching and live Demo voice. The VRM testing note was verified beneath Model and hidden in Tofu and Debug. After correcting the sample name, the actual pixiv VRM1_Constraint_Twist_Sample was loaded locally and verified during generated playback. No browser errors were reported.

Reviewer follow-up: native Open .vrm file selection, a physical microphone and touchscreen gestures. The in-app browser's automated file chooser timed out; the opened-file callback and retained blob selection are covered by a regression test.

## Related issues

Related to #10: step 5 of six. This PR closes no issues, and its branch is unlinked.
```

### codex/rust-dependency-cleanup

- Task: resume step 4 of six for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10). This branch is a wrap-up documentation checkpoint only; step 4 source work has not started. Keep it unlinked because it will not finish the port.
- PR: none for this branch. [PR #16](https://github.com/pomodorozhong/wahwah/pull/16) merged on 2026-11-04 as 5a4a597; the first three port steps are complete. The instrument branch's remote was deleted. The local codex/rust-instruments branch remains at f783fd4 with no unique file content relative to that merge.
- Code checkpoint: main at 5a4a597, whose tree was verified identical to the tested instrument branch at f783fd4. The current working tree has no unfinished application-source changes.
- State: all six text-mode voices run in Rust/WASM. Rust owns Mumble generation and mouth tracks; the four instruments have explicit per-note timing. The live demo and legacy synthesis/track tests still use JS paths. The live audio worklet reads shared poses synchronously without WASM initialization.
- Next action: prepare the step 4 implementation plan with the open-pr skill and obtain plan approval before changing source. Move live-demo synthesis to WASM, copy the remaining live vowel reference values, migrate affected legacy tests, and remove klattsch, babble-engine and obsolete adapters. Keep live analysis in TypeScript. View cleanup and Pages remain steps 5 and 6.
- Verification: the completed implementation passed all six AGENTS.md checks, including 36 Rust tests and 234 TypeScript tests across 15 files, plus browser checks of all six voices, delivery controls, retained settings, puppet-off diagnostics, live demo analysis and production Ooh Choir. The implementation commit also passed independently in a temporary detached checkout. Wrap-up changes only HANDOFF.md, checked with git diff --check; application tests were not rerun for this documentation-only checkpoint. Physical microphone input was not exercised.
- Toolchain: pinned Rust 1.99.1 and wasm-bindgen-cli 0.2.130; direct cargo commands need /opt/homebrew/opt/rustup/bin and ~/.cargo/bin on PATH. No shell profile changes. Dependencies are installed in this worktree.
- Local servers: development http://127.0.0.1:5193/ and production preview http://127.0.0.1:5194/ both returned HTTP 200 at wrap-up and were left running on this computer at the user's request. These processes do not transfer to another computer.
- Issue handoff: [Codex-authored progress note](https://github.com/pomodorozhong/wahwah/issues/10#issuecomment-6622181634) was posted and its exact body verified.
- Known limitation: the default tofu M/B/P target stays slightly open; see [#12](https://github.com/pomodorozhong/wahwah/issues/12).
- **P-09** Push this branch's documentation checkpoint, based on main at 5a4a597 and changing only HANDOFF.md, without opening a PR. Why: the previous publication approval covered the exact instrument PR tip; it does not authorize publishing this new branch. Blocks: retrieving the latest repository handoff from another computer. The application code and issue progress note are already remote.

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue. Steps 1–4 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14), [#15](https://github.com/pomodorozhong/wahwah/pull/15), [#16](https://github.com/pomodorozhong/wahwah/pull/16) and [#17](https://github.com/pomodorozhong/wahwah/pull/17). Step 5, removing Live2D and Preview face, is implemented on codex/playground-cleanup; published as [PR #18](https://github.com/pomodorozhong/wahwah/pull/18) and awaiting review. Step 6 is licensing and Pages. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Revisit the preserved rendering and mouth experiments in P-05 after completing the Rust/WASM port in #10, as confirmed by the user on 2026-11-03. Their order relative to the later capabilities above remains undecided.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-09 obsolete:** the old codex/rust-dependency-cleanup documentation checkpoint is superseded by the newer code and handoff merged through PR #17. Its original subsection remains from that branch’s own record; publishing it is unnecessary.

- **P-11 superseded:** the user approved including the useful codex/rust-playground-cleanup documentation in the step 5 implementation PR. Separate publication of the older checkpoint is unnecessary.

- **P-05** Preserved local experiments, deferred until after the Rust/WASM port in #10 by the user's decision on 2026-11-03. This is later integration work, not lost-work recovery. Proposed scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. Re-evaluate the earlier model scope against that shipped tofu when this work resumes; implementation and publication details remain to be agreed then. No matching extraction issues or milestones exist. Why: the user chose to handle these experiments after the Rust port. Blocks: later experiment integration only; nothing in rank one.

- P-05 preservation details: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
