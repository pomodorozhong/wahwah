# Handoff

## In progress

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

### codex/rust-live-wasm

- Task: step 4 of six for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10): Rust/WASM dependency cleanup. Implementation plan approved in chat. Keep this branch unlinked because it does not finish the port.
- PR: [#17](https://github.com/pomodorozhong/wahwah/pull/17), open and ready for review against main. Published with the reviewed help-text follow-up. The branch stays unlinked to #10; the PR closes no issues.
- Code checkpoint: 73774a4 (help text) on acda10b (dependency cleanup), based on main at 5a4a597 (merged PR #16). Source changes are committed.
- State: live Mumble test speech, Demo voice and calibration responses render through WASM with generated mouth tracks disabled. Live analysis remains TypeScript and imports the copied ten vowel references and shared mouth poses synchronously without WASM. The klattsch and babble-engine packages, optional CMU dictionary, legacy JS synthesizers/adapters, TS track generator and stage fallback are removed. Pink Trombone remains for independent live test signals. Voice and live-analysis tests use actual Rust/WASM audio and tracks; obsolete adapter tests are removed. Upstream notices remain.
- Verification: all six AGENTS.md checks passed, including 36 Rust tests and 221 TypeScript tests across 16 files. The implementation commit also passed all six checks independently in a fresh detached checkout after npm ci. In-app browser checks passed for live Demo voice, complete guided calibration (all nine sounds distinct, 99% recognized), test sentence, Pink Trombone sweep, stop/restart, both analysis threads and puppet-off behavior. Production preview verified Demo voice, mode switching, all six text voices and Phoneme script. No browser errors. Physical microphone input and user sound judgment remain reviewer follow-up.
- Help-text follow-up verification: npm typecheck, all 221 TypeScript tests and production build passed. Browser verification covered all five mode explanations and the Vowel map guidance. The local Vite server was restarted to clear its stale module cache.
- Toolchain: pinned Rust 1.99.1 and wasm-bindgen-cli 0.2.130; direct cargo commands need /opt/homebrew/opt/rustup/bin and ~/.cargo/bin on PATH. No shell profile changes.
- Local review servers: development http://127.0.0.1:5197/ and production preview http://127.0.0.1:5198/. Test audio is stopped. These processes do not transfer to another computer.
- Remaining port work: remove Live2D and Preview face (step 5); add MIT, Pages workflow and /wahwah/ base path, enable Pages and close #10 (step 6). The vowel-sweep visualization (#13), real microphone evaluation (#8), live model (#9) and tofu M/B/P closure bug (#12) remain separately tracked.
- Next action: await review and merge of PR #17. After it merges, plan step 5 (remove Live2D and Preview face) on current main. Merging is not authorized.
- P-10 resolved: the user explicitly requested “push and open” after reviewing the implementation and requested help-text follow-up. Publication is authorized; merging is not.
- Published title: refactor(voice): finish Rust/WASM dependency cleanup

```markdown
## What changed

- Render the live Mumble test sentence, Demo voice and calibration responses through Rust/WASM. Keep the demo's higher pitch, formant scale and response delay; feed its audio through the TypeScript live analyzer with generated mouth tracks disabled.
- Copy the ten live F1/F2 reference pairs from klattsch, including UW's rounded endpoint, so live analysis and the audio worklet still load synchronously without WASM.
- Remove the klattsch and babble-engine npm dependencies, the optional CMU dictionary, obsolete JavaScript synthesis/adapters, and the stage's legacy rendering fallback. Retain upstream notices and the Pink Trombone test source.
- Migrate voice, mouth-track, calibration and live-analysis fixtures to Rust audio and tracks. Add tests for synthetic live inputs and a complete guided Demo voice calibration.
- Explain each Mouth shape from option and when the Vowel map can display its circle and trail.

## Why

This completes step 4 of the Rust/WASM port. The selected voices and live synthetic speech now use one Rust implementation, while microphone analysis remains in TypeScript. View cleanup and Pages publication remain steps 5 and 6.

## Verification

### Automated checks

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed, 36 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 221 tests across 16 files.
- `npm run build`: passed.

The implementation commit also passed all six checks in a fresh detached checkout after `npm ci`. Tests cover finite and repeatable live audio at multiple sample rates, calibration response timing, guided calibration, live analysis quality, pitch, distinct mouth poses and audio/mouth synchronization. Tests specific to discarded JavaScript adapters were removed.

### How to verify

1. Run `npm ci` and `npm run dev`. In Live microphone, choose Demo voice and press Start. The input level and mouth should move.
2. Press Calibrate my voice, then Begin. The demo should answer all prompts and finish with nine distinct sounds. Stop and restart the input.
3. Try the Mumble test sentence and Pink Trombone vowel sweep. In Analysis, expand Latency and switch between audio-thread and page analysis. Disable Puppet output and check that audio continues while the estimator reports off.
4. Switch to Text to mumble and play each of the six voices, then try Phoneme script.
5. In live mode, select each Mouth shape from option under Voice and check its help text. In Analysis, check the Vowel map explanation of the circle, trail and required mode.

Verified in the in-app browser: all steps above; guided demo calibration reported 99% recognition. Production preview also verified Demo voice, mode switching, all six text voices and Phoneme script. All five mouth-mode explanations and the Vowel map guidance were also verified in the browser. No browser errors were reported.

Reviewer follow-up: judge the Rust live demo by ear and exercise a physical microphone; physical microphone input was not tested.

## Related issues

Related to #10: step 4 of six. This PR closes no issues, and its branch is unlinked.
```

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue; PR 1 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14) and PR 2 as [#15](https://github.com/pomodorozhong/wahwah/pull/15); step 3 merged as [#16](https://github.com/pomodorozhong/wahwah/pull/16). Step 4, dependency cleanup, is open for review as [#17](https://github.com/pomodorozhong/wahwah/pull/17) on codex/rust-live-wasm. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Revisit the preserved rendering and mouth experiments in P-05 after completing the Rust/WASM port in #10, as confirmed by the user on 2026-11-03. Their order relative to the later capabilities above remains undecided.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-05** Preserved local experiments, deferred until after the Rust/WASM port in #10 by the user's decision on 2026-11-03. This is later integration work, not lost-work recovery. Proposed scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. Re-evaluate the earlier model scope against that shipped tofu when this work resumes; implementation and publication details remain to be agreed then. No matching extraction issues or milestones exist. Why: the user chose to handle these experiments after the Rust port. Blocks: later experiment integration only; nothing in rank one.

- P-05 preservation details: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
