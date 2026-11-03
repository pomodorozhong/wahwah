# Handoff

## In progress

### feat/rust-performance

- Task: second of six PRs for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10), which holds the agreed end state and PR order. Move text-to-babble and mouth track generation to Rust, so one call returns audio and mouth movement together, and share mouth pose data with live mode's TypeScript. The branch stays unlinked because this PR doesn't resolve the issue.
- PR: none yet.
- Code checkpoint: 9913759 on main, the merged [PR #14](https://github.com/pomodorozhong/wahwah/pull/14). No source work has started on this branch.
- State: the klattsch formant voice, Wah-wah trombone and Trombone color run in Rust/WASM. Text-to-babble, the mouth track, Babble Engine, Live2D and live mode are still TypeScript and JavaScript. Rust keeps its own copy of the trombone's vowel shapes until this PR's shared data replaces it.
- Toolchain: Homebrew `rustup`, pinned to Rust 1.99.1, and `wasm-bindgen-cli` 0.2.130 from cargo. `scripts/build-wasm.mjs` finds them without shell profile changes. Running `cargo` directly needs `/opt/homebrew/opt/rustup/bin` and `~/.cargo/bin` on PATH; no shell profile was changed.
- Verification: PR #14 passed the checks in `AGENTS.md` and the user accepted the voices by ear. Nothing has been run on this branch yet. Physical microphone input and the README's Rust setup on a clean machine were not exercised for PR #14.
- Avoid: making live analysis wait on WASM. `src/live/analysisWorklet.ts` reaches `VISEMES` and klattsch's `banks` on the audio thread, so pose data needs a form both Rust and TypeScript can read at build time.
- Preserved local work: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
- Known limitation: the default tofu M/B/P mouth target stays slightly open; see [bug #12](https://github.com/pomodorozhong/wahwah/issues/12).
- Next action: plan PR 2 with the `open-pr` skill and get approval for that plan before building.

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue; PR 1 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14), and PR 2 is next. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-05** Deferred, unapproved extraction proposal from the preserved local experiment backup. Remaining scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. No remaining extraction is authorized or scheduled, and the earlier model scope must be re-evaluated against that shipped tofu. No matching extraction issues or milestones exist. Why: these remaining experiments were proposed but never selected. Blocks: optional experiment recovery only; nothing in rank one.
