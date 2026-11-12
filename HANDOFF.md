# Handoff

## In progress

### feat/playground-layout

- Task: redesign the playground layout, closing [#46](https://github.com/pomodorozhong/wahwah/issues/46) (the crowded Voice tab) and [#34](https://github.com/pomodorozhong/wahwah/issues/34) (the nearly empty Puppet tab).
- PR: none yet. The branch is local only and not linked to either issue; the PR body closes them instead.
- Code checkpoint: `0a56782` feat(playground): two-column layout with an example shelf and always-visible Length.
- State: the final layout the user picked (mockup direction S, then G's left column) is built. Wide: the stage at top left with Voice (engine picker in its title) and Character in a list that scrolls on its own; on the right an example shelf, the line row with a Text / Phonemes switch, a light playback monitor with no readouts and pill chips, and Length in four always-visible groups disabled while the cap is off. The masthead switch is Text to wahwah / Live microphone, with a GitHub mark after a matching divider. Phonemes now has Length too (`ui/lengthControls.ts`, values shared with Text). Live microphone puts Voice profile and the analysis tools in the list and Response under the monitor. Tablets keep two columns and scroll; phones have Script and Voice tabs (underlined) with a closed Diagnostics section at the bottom of Voice.
- Verification at `0a56782`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` (226 + 18 tests), `npm run build` and `npm run test:pages` pass. Checked in the browser at 1440×900 and 1280×800 (one screen, no scroll), 768×1024 and 375×812: Text, Phonemes and Live microphone, example cards, the cap with fit chips, the cap carrying over to Phonemes, phone tabs and the Diagnostics fold.
- Not checked: listening to playback in this round, every sound engine at every width, a microphone or calibration session, real phone hardware, and landscape phones.
- Next action: get approval to push and open the PR (P-08).
- Pending: **P-08** push `feat/playground-layout` (no force) and open the PR titled "feat(playground): two-column layout with an example shelf and always-visible Length", closing [#34](https://github.com/pomodorozhong/wahwah/issues/34) and [#46](https://github.com/pomodorozhong/wahwah/issues/46). Why: pushing and publishing need approval. Blocks: review. Note: #46 asked for the cap-off options to take a line or two; the user chose always-visible, disabled controls instead.

## Ranked work

1. Redesign the playground layout on `feat/playground-layout`, closing [#46](https://github.com/pomodorozhong/wahwah/issues/46) and [#34](https://github.com/pomodorozhong/wahwah/issues/34). The user picked this as the next task.
2. Multilingual follow-ups from the review of [#39](https://github.com/pomodorozhong/wahwah/pull/39): [#42](https://github.com/pomodorozhong/wahwah/issues/42), decomposed Hangul jamo and a word-initial combining mark.
3. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
4. Exact-duration fitting, [#20](https://github.com/pomodorozhong/wahwah/issues/20) (P2), which can reuse the fitting step from [#45](https://github.com/pomodorozhong/wahwah/pull/45).
5. Maximum-duration gaps left after [#45](https://github.com/pomodorozhong/wahwah/pull/45): [#43](https://github.com/pomodorozhong/wahwah/issues/43) (volume options do nothing on a line that fits) and [#44](https://github.com/pomodorozhong/wahwah/issues/44) (an instrument word cut chops the last release).
6. Speak emoji as short reaction sounds, [#41](https://github.com/pomodorozhong/wahwah/issues/41). It builds on the multilingual tokenizer from [#39](https://github.com/pomodorozhong/wahwah/pull/39).
7. Drag on the playback monitor to tune the cap, fade and shapes, [#47](https://github.com/pomodorozhong/wahwah/issues/47). It builds on the new Length card.

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
