# Handoff

## In progress

### feat/hangul-jamo

- Task: [#42](https://github.com/pomodorozhong/wahwah/issues/42), group decomposed Hangul jamo into one syllable and test a word-initial combining mark.
- PR: none. The branch is local only and not yet linked to [#42](https://github.com/pomodorozhong/wahwah/issues/42); it carries only this handoff so far.
- Code checkpoint: `c91e25b` on `main` (the merge of [PR #48](https://github.com/pomodorozhong/wahwah/pull/48)). No code changes yet.
- Verification: none run on this branch.
- Next action: read [#42](https://github.com/pomodorozhong/wahwah/issues/42) and the multilingual tokenizer, then write failing tests for decomposed jamo and a word-initial combining mark.
- Pending: **P-11** push `feat/hangul-jamo` and link it to [#42](https://github.com/pomodorozhong/wahwah/issues/42) (`gh issue develop`). Why: pushing needs approval. Blocks: resuming from another computer.

## Ranked work

1. Multilingual follow-ups from the review of [#39](https://github.com/pomodorozhong/wahwah/pull/39): [#42](https://github.com/pomodorozhong/wahwah/issues/42), decomposed Hangul jamo and a word-initial combining mark.
2. Playground follow-ups from the review of [PR #48](https://github.com/pomodorozhong/wahwah/pull/48): [#49](https://github.com/pomodorozhong/wahwah/issues/49) (a cut line renders twice on every slider move) and [#50](https://github.com/pomodorozhong/wahwah/issues/50) (stray indent in `live.ts`). Both are small.
3. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
4. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), which can reuse the fitting step from [#45](https://github.com/pomodorozhong/wahwah/pull/45).
5. Maximum-duration gaps left after [#45](https://github.com/pomodorozhong/wahwah/pull/45): [#43](https://github.com/pomodorozhong/wahwah/issues/43) (volume options do nothing on a line that fits) and [#44](https://github.com/pomodorozhong/wahwah/issues/44) (an instrument word cut chops the last release).
6. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).
7. Drag on the playback monitor to tune the cap, fade and shapes, [#47](https://github.com/pomodorozhong/wahwah/issues/47). It builds on the Length card from [PR #48](https://github.com/pomodorozhong/wahwah/pull/48).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
