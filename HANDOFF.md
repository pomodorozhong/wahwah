# Handoff

## In progress

### feat/hangul-jamo

- Task: a four-PR stack built with `gh stack`, bottom first: `feat/hangul-jamo` closes [#42](https://github.com/pomodorozhong/wahwah/issues/42), `fix/length-double-render` closes [#49](https://github.com/pomodorozhong/wahwah/issues/49) and [#50](https://github.com/pomodorozhong/wahwah/issues/50), `fix/fit-volume-when-fits` closes [#43](https://github.com/pomodorozhong/wahwah/issues/43), and `fix/instrument-cut-release` closes [#44](https://github.com/pomodorozhong/wahwah/issues/44).
- PR: the four PRs are being opened bottom first after the user approved publishing on 2026-11-13; the next handoff records their links.
- Code checkpoint: based on `c91e25b` on `main`. The review found no P0 or P1 issues; its fixups (this handoff, a development note, and a test and changelog line for Arabic harakat) are folded into PR 1. The review request and PR bodies are in `.agents/propose-stack/feat-hangul-jamo/`, which Git ignores.
- Verification: each branch tip passed the six checks from `AGENTS.md` in a clean worktree. In the browser, a Length slider step on a cut 28 s line took 19 ms against 262 ms for a Voice step, and Volume level 50% halved a fitting line.
- Review follow-ups, filed as P2: [#51](https://github.com/pomodorozhong/wahwah/issues/51) extended Hangul jamo blocks, [#52](https://github.com/pomodorozhong/wahwah/issues/52) an LV block followed by a trailing jamo, [#53](https://github.com/pomodorozhong/wahwah/issues/53) the instrument word-cut label.
- Next action: watch the four PRs' checks and reviews, and merge the stack with `gh stack merge` when the user asks.

## Ranked work

1. Finish the stack in `feat/hangul-jamo`: [#42](https://github.com/pomodorozhong/wahwah/issues/42), [#49](https://github.com/pomodorozhong/wahwah/issues/49), [#50](https://github.com/pomodorozhong/wahwah/issues/50), [#43](https://github.com/pomodorozhong/wahwah/issues/43) and [#44](https://github.com/pomodorozhong/wahwah/issues/44). Its P2 follow-ups are [#51](https://github.com/pomodorozhong/wahwah/issues/51), [#52](https://github.com/pomodorozhong/wahwah/issues/52) and [#53](https://github.com/pomodorozhong/wahwah/issues/53).
2. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
3. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), which can reuse the fitting step from [#45](https://github.com/pomodorozhong/wahwah/pull/45) once the stack's fixes to it land.
4. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).
5. Drag on the playback monitor to tune the cap, fade and shapes, [#47](https://github.com/pomodorozhong/wahwah/issues/47). It builds on the Length card from [PR #48](https://github.com/pomodorozhong/wahwah/pull/48).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
