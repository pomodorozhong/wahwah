# Handoff

## In progress

### feat/multilingual-input

- Task: the top of a local stack of two PRs for ranked items from the roadmap: `feat/voice-hash` (character voices from a caller-provided hash) and this branch (multilingual invented-speech input), each with its playground control. The maximum output duration grew large and moved to its own branch, `feat/max-duration`, cut from `main` and outside the stack; it is `Related to` [#20](https://github.com/pomodorozhong/wahwah/issues/20). None has an issue.
- PR: [#38](https://github.com/pomodorozhong/wahwah/pull/38) (`feat/voice-hash` into `main`) and [#39](https://github.com/pomodorozhong/wahwah/pull/39) (this branch into `feat/voice-hash`), open for review as [stack #40](https://github.com/pomodorozhong/wahwah/stack/40).
- Code checkpoint: review fixes are folded. `feat/voice-hash` is `4ec03cf` (`a0891ba` plus the playground hash section, which now shows and locks the hash's values in Voice settings) and this branch is `9ba4453` (`75af4d4` with the combining-mark and sokuon fixes, plus the playground samples), on `origin/main` `84735bf`, followed by this branch's `docs:` handoff commit. `feat/max-duration` is `43de5b6`: the cap (`f626f1b`), the speed-up, volume, word-cut and fade options (`16fa600`) and the playground controls with a plot (`43de5b6`).
- State: the final review and the PR bodies are in `.agents/propose-stack/feat-voice-hash/` (ignored by Git, local only): `body-1.md`, `body-2.md` and `review.md` for the stack, and `separate-max-duration-body.md` for the other branch. Ranked items 3 and 4 are reviewer findings on this branch that are still open. `feat/max-duration` and `feat/voice-hash` both touch the interface guide, the changelog, the WASM bindings and `voice.test.js`, so the second to land needs a rebase.
- Verification: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` and `npm run build` passed on the folded `feat/voice-hash` and `feat/multilingual-input`, and earlier on `feat/max-duration`. The hash display was checked in the browser. English Mumble output matches `main` over 45 lines. Not run: a listening check of capped audio, and the Chinese samples by ear.
- Next action: watch CI on both PRs, then fix ranked items 3 and 4 on this branch or merge the stack as is.

## Ranked work

1. `feat/max-duration`: always cut the audio to `floor(cap × sampleRate)` samples in `render_performance_within` and `render_instrument_within`. A line that barely fits is one sample over today. Add a test with a fractional-sample cap, and say "except at most one trailing sample" in the PR body.
2. `feat/max-duration`: after a cut, `MumblePerformance.script.words` still lists words that never play. Filter them or document it.
3. Multilingual PR: decomposed Hangul (`U+1100–11FF` jamo) makes each jamo its own word. Group jamo into one syllable.
4. Multilingual PR: a lone combining mark at the start of a word is skipped with no test. Add one.
5. Merge the voice stack ([#38](https://github.com/pomodorozhong/wahwah/pull/38), [#39](https://github.com/pomodorozhong/wahwah/pull/39)). Then rebase and publish `feat/max-duration`.
6. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
7. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), after the maximum-duration PR merges.

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

- **P-02** Delete the remote branch `origin/refactor/apps-playground` (`b1b869c`). It has no PR, and its two commits past `main` only change `HANDOFF.md`. Why: remote deletions need approval. Blocks: nothing.
