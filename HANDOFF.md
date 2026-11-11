# Handoff

## In progress

### feat/playground-layout

- Task: redesign the playground layout, closing [#46](https://github.com/pomodorozhong/wahwah/issues/46) (the crowded Voice tab) and [#34](https://github.com/pomodorozhong/wahwah/issues/34) (the nearly empty Puppet tab).
- PR: none yet. The branch is local only and not yet linked to either issue.
- Code checkpoint: `d9e7049` fix(playground): let the stage fill its space and tighten the in-between layouts (after the layout in `a7a5267` and three styling fixes).
- State: implemented as approved (P-07). Wide screens show the stage and line on top with control columns below; tablets fold the columns two per row; phones use Script, Voice and Analysis tabs. A segmented input picker replaces the dropdown, the Puppet tab's controls sit on the stage, and the fit curves (speed, reached, fade, markers and the faint cut tail) are drawn in the playback monitor with chips, hidden on phones. The separate fade plot is gone (`fadePlot.ts` became `fitCurves.ts`). Design mockups: https://claude.ai/artifact/EVXvkhAS4HcnfMrRACsHWV (private).
- Verification at `d9e7049`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` (226 + 18 tests), `npm run build` and `npm run test:pages` pass. Checked in the browser at 1280×800, 834×1194 and 375×812: all three input modes, every sound engine in Text to mumble (four columns, no horizontal scroll), the Analysis switch, phone tabs, and the cap with fade and cut tail, including Kazoo playback.
- Not checked: real phone hardware, touch use of the Puppet menu, and landscape phones (they get the tablet layout).
- Next action: get approval to push and open the PR (P-06, P-08).
- Pending: **P-06** push `feat/playground-layout` and link it to [#46](https://github.com/pomodorozhong/wahwah/issues/46) and [#34](https://github.com/pomodorozhong/wahwah/issues/34) (`gh issue develop`). Why: pushing and linking need approval. Blocks: the PR.
- Pending: **P-08** open the PR with the drafted title and body. Why: publishing needs approval. Blocks: review.

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
