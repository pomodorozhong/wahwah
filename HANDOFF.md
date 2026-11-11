# Handoff

## In progress

### feat/playground-layout

- Task: redesign the playground layout, to close [#46](https://github.com/pomodorozhong/wahwah/issues/46) (the Voice tab crowded by the maximum-duration controls) and [#34](https://github.com/pomodorozhong/wahwah/issues/34) (the nearly empty Puppet tab).
- PR: none. The branch is local only, created from `main` at `1543c37`, and not yet linked to either issue.
- Code checkpoint: none yet; only this `docs:` handoff commit.
- State: not started. The Voice tab markup is `voiceHtml` in `apps/playground/src/apps/mumble.ts`; the user guide is `docs/playground.md`.
- Next action: draft the redesign plan with the `open-pr` skill and get it approved before changing code.
- Pending: **P-06** push `feat/playground-layout` and link it to [#46](https://github.com/pomodorozhong/wahwah/issues/46) and [#34](https://github.com/pomodorozhong/wahwah/issues/34) (`gh issue develop`). Why: pushing and linking need approval. Blocks: resuming from another computer.

## Ranked work

1. Redesign the playground layout on `feat/playground-layout`, closing [#46](https://github.com/pomodorozhong/wahwah/issues/46) and [#34](https://github.com/pomodorozhong/wahwah/issues/34). The user picked this as the next task.
2. Multilingual follow-ups from the review of [#39](https://github.com/pomodorozhong/wahwah/pull/39): [#42](https://github.com/pomodorozhong/wahwah/issues/42), decomposed Hangul jamo and a word-initial combining mark.
3. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
4. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), which can reuse the fitting step from [#45](https://github.com/pomodorozhong/wahwah/pull/45).
5. Maximum-duration gaps left after [#45](https://github.com/pomodorozhong/wahwah/pull/45): [#43](https://github.com/pomodorozhong/wahwah/issues/43) (volume options do nothing on a line that fits) and [#44](https://github.com/pomodorozhong/wahwah/issues/44) (an instrument word cut chops the last release).
6. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
