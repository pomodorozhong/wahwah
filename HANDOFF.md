# Handoff

## In progress

### feat/max-duration

- Task: fit a performance within a maximum output duration, with options to speed up, lower the volume, cut at a word and fade, plus playground controls with a plot. `Related to` [#20](https://github.com/pomodorozhong/wahwah/issues/20) (exact-duration fitting); it does not close it.
- PR: none yet; it waits on **P-04**. `origin/feat/max-duration` still holds the old pre-rebase backup.
- Code checkpoint: `1a69f74`, rebased onto `main` at `036b415`. It includes the two reviewer fixes: the audio never runs past `floor(cap × sampleRate)` samples, and `script.words` lists only the words that still play after a cut. The maximum duration now sits above the hash voice in the playground.
- Verification: the six documented checks passed on `1a69f74`. Not run: a listening check of capped audio.
- Next action: on approval of **P-04**, force-push with lease and open the PR.
- Pending: **P-04** force-push the rebased `feat/max-duration` (replacing the backup at `5dd1273`) and open its PR, using the `open-pr` skill. Why: pushing and opening a PR need approval. Blocks: review and merge of the maximum duration, and [#20](https://github.com/pomodorozhong/wahwah/issues/20).

## Ranked work

1. Publish `feat/max-duration` (**P-04**), then review and merge it.
2. Multilingual follow-ups from the review of [#39](https://github.com/pomodorozhong/wahwah/pull/39): [#42](https://github.com/pomodorozhong/wahwah/issues/42), decomposed Hangul jamo and a word-initial combining mark.
3. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
4. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), after the maximum-duration PR merges.
5. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
