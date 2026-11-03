# Handoff

## In progress

### feat/rust-performance

- Task: second of six PRs for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10). Rust owns Mumble generation and mouth tracks, and one WASM render returns audio and mouth movement from one score. The branch stays unlinked because this PR does not resolve the whole issue.
- PR: not opened; ready for review, pending publish approval P-06. The user approved the implementation plan and selected this existing branch in chat.
- Code checkpoint: 4821fc7, based on main at 9913759 plus the pre-existing handoff commit 4ae6dd0.
- Worktree: this task now owns the feat/rust-performance checkout. The original repository checkout was clean and is detached at 4ae6dd0 with its source files untouched, avoiding two worktrees advancing the same branch.
- State: Text to mumble and Phoneme script use complete Rust performances for the formant voice and Wah-wah trombone. Shared JSON supplies mouth poses to Rust, TypeScript live analysis and the trombone plunger. The live demo uses Rust-generated Mumble scripts with legacy JS synthesis; Babble Engine still uses its own generator/audio and a TypeScript mouth track. The four instrument voices and dependency removal remain later PRs.
- Naming: the user selected Mumble for our invented-speech generator. UI: Text to mumble; code: mumble. The external Babble Engine name remains. Old /babble/ and ?mode=babble links select Mumble.
- Toolchain: Homebrew rustup, pinned Rust 1.99.1, wasm-bindgen-cli 0.2.130. Direct cargo commands need /opt/homebrew/opt/rustup/bin and ~/.cargo/bin on PATH; no shell profile was changed. Dependencies are installed in this worktree; npm ci used a temporary cache because the default cache was outside the sandbox's writable roots.
- Verification: all six AGENTS.md checks passed (27 Rust tests; 190 TypeScript tests across 14 files). Browser checks passed for both Rust voices, Happy delivery, phoneme playback, puppet-off diagnostics, live demo analysis, retained Babble Engine playback, old links, and the production /mumble/ route; no browser errors. User sound judgment and physical microphone input remain reviewer follow-up. Shared-data extraction preserved all 39 poses, three styles and five moods.
- Avoid: making live analysis wait on WASM. The audio worklet imports the shared pose JSON synchronously. JavaScript synthesis and track generation remain only for legacy callers scheduled for cleanup.
- Preserved local work: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
- Known limitation: the default tofu M/B/P mouth target stays slightly open; see [bug #12](https://github.com/pomodorozhong/wahwah/issues/12).
- Next action: obtain approval for P-06, push this exact reviewed branch tip, then open the PR against main. No push is authorized yet.
- **P-06** Publish approval requested: push feat/rust-performance and open a ready-for-review PR against main with the exact title and body below. Why: the open-pr skill requires separate approval of the finished branch before publishing. Blocks: publishing only. Merging closes no issues; issue #10 has no branch link. No plan deviations beyond the user's branch-name correction.
- Proposed title: feat(voice): generate Mumble performances in Rust/WASM

```markdown
## What changed

- Move seeded Mumble generation, English syllable rhythm, mood and mouth tracks into the browser-independent Rust core.
- Render the formant voice or Wah-wah trombone, timeline and optional mouth movement from one score in one stateless WASM call. Return audio as a Float32Array and convert source ranges to JavaScript string positions.
- Share mouth poses and Mumble presets with TypeScript. Live analysis reads poses directly without initializing WASM; its demo still uses legacy JavaScript synthesis until the dependency-cleanup step.
- Rename the input to Text to mumble and our code to mumble. Add /mumble/ while preserving /babble/ and ?mode=babble links. Keep Babble Engine available for its scheduled instrument rewrite.

## Why

The voices already render in Rust, but text generation and mouth movement still came from separate TypeScript stages. This makes one Rust score responsible for the generated performance and completes step 2 of the agreed port.

## Verification

### Automated checks

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed, 27 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 190 tests across 14 files.
- `npm run build`: passed.

Coverage includes repeatable generation, punctuation and moods, valid audio at multiple sample rates, matching audio and mouth duration, closed bilabial targets, disabled mouth generation, and UTF-16 offsets after emoji and smart punctuation.

### How to verify

1. Run `npm ci` and `npm run dev`. In Text to mumble, play the greeting with Wah-wah trombone and klattsch, then change Mood and Seed.
2. In Phoneme script, play `M AA . IY . UW` and inspect the distinct mouth shapes and playback monitor.
3. Disable Puppet output and play again. Analysis should report "off — generator not run" while audio continues.
4. Switch to Live microphone, select Demo voice, and press Start. Confirm that live analysis and mouth movement run.
5. Open `/mumble/`, `/babble/`, and `?mode=babble`. Each should select Text to mumble. Babble Engine should still play with a moving mouth.

Verified in the in-app browser: both Rust voices, Happy delivery, phoneme playback, puppet-off diagnostics, live demo analysis, retained Babble Engine playback, legacy links, and the production build's /mumble/ route. No browser errors were reported.

Reviewer follow-up: judge the sound by ear; physical microphone input was not exercised. The tofu model's existing M/B/P mouth-closure limitation remains tracked in #12.

## Related issues

Related to #10: step 2 of six. This PR does not close the port issue.
```

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue; PR 1 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14); PR 2 is built locally and awaits publish approval P-06. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Revisit the preserved rendering and mouth experiments in P-05 after completing the Rust/WASM port in #10, as confirmed by the user on 2026-11-03. Their order relative to the later capabilities above remains undecided.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-05** Preserved local experiments, deferred until after the Rust/WASM port in #10 by the user's decision on 2026-11-03. This is later integration work, not lost-work recovery. Proposed scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. Re-evaluate the earlier model scope against that shipped tofu when this work resumes; implementation and publication details remain to be agreed then. No matching extraction issues or milestones exist. Why: the user chose to handle these experiments after the Rust port. Blocks: later experiment integration only; nothing in rank one.
