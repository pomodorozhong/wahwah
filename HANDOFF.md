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

### codex/rust-pages

- Task: step 6 of six for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10). The user approved the implementation plan and carrying the P-13 documentation checkpoint into this PR. Source work is complete; publication approval is pending.
- PR: none. Ready to open against main at 23a91e5. The branch is unlinked; the proposed body closes #10 on merge. Steps 1–5 are merged, including PR #18. No merge is authorized.
- Code checkpoint: aa6beeb adds MIT licensing, license metadata, the /wahwah/ base, Pages build isolation, deployment workflow and build integration test. It follows the approved documentation checkpoint 8ec172b, based on main at 23a91e5.
- State: all six selected voices and live synthetic speech use Rust/WASM; live analysis stays in TypeScript. Views remain Tofu, VRM and Debug. The Pages build disables public-directory copying and the local-model manifest, then emits only bundled Tofu and license files alongside generated assets. Ordinary private builds retain startup models. The workflow checks PRs and main, uploads/deploys only main, and uses the github-pages environment. GitHub Pages is still disabled and no environment exists yet; Actions are enabled.
- Verification: all six AGENTS.md checks passed (36 Rust tests; 220 TypeScript tests across 17 files), plus npm run test:pages, npm run build:pages and actionlint 1.7.12. The implementation commit passed all of these independently in a fresh detached checkout after npm ci. The Pages test builds with disposable local-model and public-file fixtures: ordinary inclusion, Pages exclusion from output and picker, stale-output removal, exact Tofu/notices, prefixed HTML asset URLs, WASM and both worklets. Existing Pink Trombone sourcemap warnings appear in Vitest; tests pass.
- Browser verification: production preview passed all six voices, Tofu playback, Phoneme script, live Demo voice, recording and recorded playback, the empty startup-model picker and all four legacy URLs under /wahwah/. All production files returned HTTP 200, including application/wasm for the WASM binary. No browser warnings or errors. Development startup and playback also passed with the new prefix. Test audio is stopped.
- Not yet verified: the GitHub-hosted workflow and deployed assets/playback require publication and merge. Native VRM file selection, physical microphone and touchscreen gestures remain reviewer follow-up. The existing opened-file callback regression test passes.
- Toolchain: Rust 1.99.1 and wasm-bindgen-cli 0.2.130, with Node 26.13.0 locally and Node 24 in CI. Direct cargo commands need the Homebrew rustup and cargo bin directories on PATH. The existing WASM helper reads relative target/: a scratch verification attempt with CARGO_TARGET_DIR failed; the default-layout clean-checkout rerun passed. No shell profile changes.
- Local review servers: development http://127.0.0.1:5204/wahwah/ and production preview http://127.0.0.1:5203/wahwah/. Servers and ignored local files do not transfer to another computer. The earlier servers were left untouched.
- Model handling: pixiv’s VRM1_Constraint_Twist_Sample and preserved experiment models remain local-only. The Pages build excludes public/models even when local files are present. See the guides for the sample clarification and build commands.
- Next action: obtain P-14 publication approval for the reviewed final tip and exact title/body below, then verify the tip, push without force, open the ready PR and enable GitHub Pages with build_type=workflow. Verify the PR metadata, closing issues and checks. After the user authorizes merge and main deploys, verify the hosted assets and playback at https://pomodorozhong.github.io/wahwah/.
- P-13 resolved: the user approved carrying the documentation checkpoint into the step 6 PR instead of publishing it separately.
- **P-14** Push this reviewed branch, open the ready PR with the exact title/body below and enable GitHub Pages using GitHub Actions. Why: the open-pr skill requires approval of the finished branch before publication; plan approval does not authorize a push. Blocks: publication and Pages setup. Intended closing issue: #10 only, via the body; the branch has no linked issue. Merging is not included.
- Proposed title: ci(pages): publish the voice playground on GitHub Pages

```markdown
## What changed

- Add the MIT license and npm/Cargo license metadata. Preserve the klattsch and Babble Engine notices, add the browser-library notices, and include the license files in production output.
- Serve the playground under `/wahwah/`, including WASM, Tofu, audio worklets and legacy playground URLs.
- Add `npm run build:pages`. Its Pages mode disables automatic public-directory copying and the local-model manifest, then includes only the bundled Tofu and license files. Ordinary builds retain local startup models; Pages visitors can open a VRM file in their browser.
- Add a GitHub Actions workflow that runs the six repository checks plus the Pages test and build on pull requests and pushes to main. Only main uploads and deploys through the `github-pages` environment. Pin the actions to commit hashes and use Node 24, the repository's Rust toolchain and wasm-bindgen-cli 0.2.130.
- Carry forward the tested-VRM documentation checkpoint and document local preview and deployment.

## Why

This is step 6 of the Rust/WASM port. It prepares the licensed playground for GitHub Pages while keeping user-supplied model files out of the published artifact and model picker.

## Verification

### Automated checks

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed, 36 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 220 tests across 17 files.
- `npm run build`: passed.
- `npm run test:pages`: passed. A real build with disposable local files verifies ordinary-build inclusion, Pages exclusion from files and the picker, removal of stale private output, exact Tofu/notices, prefixed HTML asset URLs, WASM and both worklets.
- `npm run build:pages`: passed.
- `actionlint .github/workflows/pages.yml`: passed with actionlint 1.7.12.

The implementation commit also passed these checks independently in a fresh detached checkout after `npm ci`, using the default Rust target layout.

### How to verify

1. Run `npm ci`, `npm run test:pages`, `npm run build:pages` and `npm run preview`. Open the printed URL ending in `/wahwah/`.
2. Play all six sound engines with Tofu. Switch to Phoneme script and play a line. Under Puppet, select VRM model: the Pages build should offer Open .vrm file without startup models.
3. Switch to Live microphone, choose Demo voice and start. Under Analysis, record a short clip and play it back. Stop test audio.
4. Open `/wahwah/mumble/`, `/wahwah/klattsch/`, `/wahwah/babble/` and `/wahwah/live/`. Each should retain the base prefix and select the corresponding input; Babble selects Mumble.
5. After merge and deployment, repeat the hosted playback checks and verify the WASM, Tofu and worklet requests at `https://pomodorozhong.github.io/wahwah/`.

Verified in the in-app browser against the production preview: all six voices, Tofu, Phoneme script, live Demo voice, recording and recorded playback, the empty startup-model picker and all four legacy URLs. All production assets returned HTTP 200, including the WASM response with application/wasm. No browser warnings or errors. Development startup and playback also passed under `/wahwah/`.

Reviewer follow-up: native VRM file selection, physical microphone and touchscreen gestures. The GitHub Actions run and hosted deployment/playback remain pending publication and merge.

## Related issues

Closes #10
```

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue. Steps 1–5 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14), [#15](https://github.com/pomodorozhong/wahwah/pull/15), [#16](https://github.com/pomodorozhong/wahwah/pull/16), [#17](https://github.com/pomodorozhong/wahwah/pull/17) and [#18](https://github.com/pomodorozhong/wahwah/pull/18). Step 6, licensing and Pages publication, is implemented on codex/rust-pages and awaits publication approval (P-14), merge and deployed verification. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Revisit the preserved rendering and mouth experiments in P-05 after completing the Rust/WASM port in #10, as confirmed by the user on 2026-11-03. Their order relative to the later capabilities above remains undecided.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-09 obsolete:** the old codex/rust-dependency-cleanup documentation checkpoint is superseded by the newer code and handoff merged through PR #17. Its original subsection remains from that branch’s own record; publishing it is unnecessary.

- **P-05** Preserved local experiments, deferred until after the Rust/WASM port in #10 by the user's decision on 2026-11-03. This is later integration work, not lost-work recovery. Proposed scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. Re-evaluate the earlier model scope against that shipped tofu when this work resumes; implementation and publication details remain to be agreed then. No matching extraction issues or milestones exist. Why: the user chose to handle these experiments after the Rust port. Blocks: later experiment integration only; nothing in rank one.

- P-05 preservation details: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
