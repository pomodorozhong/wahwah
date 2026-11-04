# Handoff

## In progress

### codex/rust-instruments

- Task: step 3 of six for [issue #10](https://github.com/pomodorozhong/wahwah/issues/10): Rust Talking Instruments with per-note mouth movement. The branch stays unlinked because it does not finish the port.
- PR: not opened; ready for review, pending publish approval P-08. Implementation plan P-07 was approved in chat. The user requested a Rust class diagram in chat only; do not add it to the repository.
- Code checkpoint: 4cbf95c, based on main at 86906df (merged PR #15).
- State: all six text-mode choices run in Rust: Wah-wah trombone, klattsch, Muted Horn, Trombone (Talking Instruments), Ooh Choir and Kazoo. Instruments compile original text to explicit notes with onsets, pitch endpoints, amplitude and word ranges. Each note drives its own open or rounded mouth pulse. Instrument presets are shared JSON; edited controls survive switching voices and input modes.
- Remaining port work: move live demo synthesis and legacy tests to WASM, copy the remaining live vowel values, remove klattsch and babble-engine, remove Live2D and Preview face, then add MIT and publish Pages. The packages and legacy callers remain for the separate dependency-cleanup step. Live analysis still imports poses synchronously without WASM.
- Verification: all six AGENTS.md checks passed, including 36 Rust tests and 234 TypeScript tests across 15 files. Browser checks passed for all six voices, delivery controls, retained settings across voices/input modes, puppet-off diagnostics, live demo analysis and production Ooh Choir, with no browser errors. The implementation commit is also checked independently in a temporary detached worktree. Physical microphone input and user sound judgment remain reviewer follow-up.
- Toolchain: pinned Rust 1.99.1 and wasm-bindgen-cli 0.2.130; direct cargo commands need /opt/homebrew/opt/rustup/bin and ~/.cargo/bin on PATH. No shell profile changes. Dependencies are installed in this worktree.
- Known limitation: the default tofu M/B/P target stays slightly open; see [#12](https://github.com/pomodorozhong/wahwah/issues/12).
- Next action: obtain approval for P-08, push the exact reviewed branch tip and open the PR against main. No push is authorized yet.
- **P-08** Publish approval requested: push codex/rust-instruments and open a ready-for-review PR against main with the exact title and body below. Why: the open-pr skill requires separate approval of the finished branch before publishing. Blocks: publishing only. Merging closes no issues, and the branch is unlinked to #10. No implementation scope deviations; the requested diagram is delivered in chat only.
- Proposed title: feat(voice): synthesize Talking Instruments in Rust/WASM

```markdown
## What changed

- Rewrite Talking Instruments' Muted Horn, Trombone, Ooh Choir and Kazoo in Rust, including note phrasing, envelopes, brass/Kazoo glides and choir pitch quantization.
- Generate mouth movement from every note's onset and release, including multiple notes inside a word. Each WASM render returns typed audio, a timeline, note metadata and an optional mouth track together.
- Expose six direct sound choices in Text to mumble. Keep the two trombones distinct and provide instrument pitch, speed, expression and brightness controls that retain edits during the visit.
- Share instrument presets between Rust and TypeScript, add Wrong Floor's MIT notice, and update the guides. Dependency removal remains the next PR.

## Why

This completes step 3 of the Rust/WASM port. All six selected text-mode voices now run in Rust, and instrument mouth timing comes directly from each note rather than the old adapter's word timestamps and audio-envelope estimates.

## Verification

### Automated checks

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed, 36 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 234 tests across 15 files.
- `npm run build`: passed.

Tests cover deterministic and distinct audio, finite bounded samples at multiple sample rates, pitch glides and choir quantization, per-note mouth timing, pauses, neutral endings, puppet-off behavior, delivery controls and UTF-16 source ranges.

### How to verify

1. Run `npm ci` and `npm run dev`. In Text to mumble, open Voice and play the greeting with each of the six sound choices.
2. Enter `information? information.` and check that the mouth articulates multiple times within each word.
3. Change Mood, Seed, Pitch, Speaking speed, Expression and Brightness. Switch instruments, then switch to another input mode and back; edited instrument settings should remain.
4. Disable Puppet output and play. Analysis should report "off — generator not run" while audio continues.
5. In Live microphone, select Demo voice and press Start. The live analyzer and mouth movement should still run.

Verified in the in-app browser: playback of all six voices, edited controls, settings retention across voice and input changes, puppet-off diagnostics, live demo analysis, and Ooh Choir in the production build. No browser errors were reported.

Reviewer follow-up: judge the new voices by ear. Physical microphone input was not exercised.

## Related issues

Related to #10: step 3 of six. This PR does not close the port issue.
```

## Ranked work

1. [#10 Port the selected voice core to Rust/WASM and deploy the VRM playground](https://github.com/pomodorozhong/wahwah/issues/10), in the six PRs listed on the issue; PR 1 merged as [#14](https://github.com/pomodorozhong/wahwah/pull/14) and PR 2 as [#15](https://github.com/pomodorozhong/wahwah/pull/15); step 3 is built locally and awaits publish approval P-08. Do this before the following capabilities.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, with a general Unicode fallback and language-specific rhythm improvements.
3. Add deterministic viewer-to-character voice profiles for Twitch, with stable account identity, a versioned mapping and saved overrides.
4. Add configurable fixed-duration output with synchronized audio and mouth timing; decide exact duration versus a maximum when designing this feature.

Revisit the preserved rendering and mouth experiments in P-05 after completing the Rust/WASM port in #10, as confirmed by the user on 2026-11-03. Their order relative to the later capabilities above remains undecided.

Nice-to-have ideas, without implementation priority: [#8 real-microphone evaluation](https://github.com/pomodorozhong/wahwah/issues/8), [#9 trained live-viseme model](https://github.com/pomodorozhong/wahwah/issues/9), and [#11 visual styles](https://github.com/pomodorozhong/wahwah/issues/11), alongside the existing [#6 line-boil experiment](https://github.com/pomodorozhong/wahwah/issues/6). The [#12 mouth-closure bug](https://github.com/pomodorozhong/wahwah/issues/12) is separately tracked; no priority relative to the port was selected. npm library publication and native bindings remain longer-term possibilities.

## Pending

- **P-05** Preserved local experiments, deferred until after the Rust/WASM port in #10 by the user's decision on 2026-11-03. This is later integration work, not lost-work recovery. Proposed scope: (1) codex/vrm-render-styles: model rebuild command, style metadata, lighting, shaders and screen passes for Painted Toon, Ink Dither and Comic Print; regenerate from a supplied source and check motion, low-resolution rendering, dither switching, stable comic dots and ordinary VRM fallback. (2) codex/replacement-mouths: sample-rig detection, replacement mouth selector/plates, and gesture-driven selection from general FaceControls; test original and fallback VRMs with generated and live/demo input. (3) codex/experimental-mouth-modes: optional sculpted lips, ink contour, hinged jaw and traced gesture replay, dependent on replacement mouths; compare poses and switching, including styled hosts. The old recommendation was replacement mouths before optional mouth modes, retaining the three controls and original VRM mouth as default. Publish only approved generators/source, keeping sample assets, generated binaries and ZIPs local. Each extracted feature would target current main and pass typecheck, tests and build. Navigation, trombone color and unified UI from the original proposal already merged; the selected tofu model also shipped separately. Re-evaluate the earlier model scope against that shipped tofu when this work resumes; implementation and publication details remain to be agreed then. No matching extraction issues or milestones exist. Why: the user chose to handle these experiments after the Rust port. Blocks: later experiment integration only; nothing in rank one.

- P-05 preservation details: codex/backup-puppet-experiments-2026-11-02 at 4442a8c (source checkpoint a5bbc48) remains a local-only backup with model ZIPs; restore there using bash restore-models.sh, then unzip -o wahwah-experiment-models.zip -d public. Never merge that snapshot wholesale or publish its local model archives. codex/square-puppet-studio and its dirty draft worktree remain untouched, as do the detached navigation, unified-UI and prototype worktrees.
