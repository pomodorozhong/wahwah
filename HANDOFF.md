# Handoff

## In progress

### feat/max-duration

- Task: fit a performance within a maximum output duration, with options to speed up, lower the volume, cut at a word and fade, plus playground controls with a plot. `Related to` [#20](https://github.com/pomodorozhong/wahwah/issues/20) (exact-duration fitting); it does not close it. It was split out of the voice stack, whose PRs [#38](https://github.com/pomodorozhong/wahwah/pull/38) and [#39](https://github.com/pomodorozhong/wahwah/pull/39) have merged.
- PR: none yet. The branch is pushed to `origin` as a backup, before the rebase; the PR waits on **P-04**.
- Code checkpoint: `f626f1b` (the cap), `16fa600` (speed-up, volume, word-cut and fade options) and `43de5b6` (playground controls with a plot), still on the old base `84735bf`, followed by this `docs:` handoff commit. `main` is now `036b415`.
- State: the PR body draft is `.agents/propose-stack/feat-voice-hash/separate-max-duration-body.md` (ignored by Git, local only). The branch needs a rebase onto `main`: [#38](https://github.com/pomodorozhong/wahwah/pull/38) also changed the interface guide, the changelog, the WASM bindings and `voice.test.js`, so expect conflicts there. Ranked items 1 and 2 are open reviewer findings on this branch.
- Verification: the six documented checks passed on `43de5b6` before the split from the stack. Nothing has been checked on the new `main`. Not run: a listening check of capped audio.
- Next action: rebase onto `main` (drop this handoff commit's conflict by keeping the incoming subsection), fix ranked items 1 and 2, run the six checks, then ask for **P-04**.
- Avoid: the rebase rewrites this pushed branch, so pushing it afterwards is a force-push and needs approval too.
- Pending: **P-04** force-push the rebased `feat/max-duration` and open its PR with the saved body (refreshed after the rebase and fixes), using the `open-pr` skill. Why: pushing and opening a PR need approval. Blocks: review and merge of the maximum duration, and [#20](https://github.com/pomodorozhong/wahwah/issues/20).

## Ranked work

1. `feat/max-duration`: always cut the audio to `floor(cap × sampleRate)` samples in `render_performance_within` and `render_instrument_within`. A line that barely fits is one sample over today. Add a test with a fractional-sample cap, and say "except at most one trailing sample" in the PR body.
2. `feat/max-duration`: after a cut, `MumblePerformance.script.words` still lists words that never play. Filter them or document it.
3. Rebase and publish `feat/max-duration` (**P-04**).
4. Multilingual follow-ups from the review of [#39](https://github.com/pomodorozhong/wahwah/pull/39): [#42](https://github.com/pomodorozhong/wahwah/issues/42), decomposed Hangul jamo and a word-initial combining mark.
5. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
6. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), after the maximum-duration PR merges.
7. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
