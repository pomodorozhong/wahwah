# Handoff

## In progress

### fix/live-test-signal-label

- Task: reword the live-mode test-signal dropdown label so it no longer says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). The PR fully resolves it with `Closes #24`; the branch is not linked to the issue.
- PR: none yet. Not pushed.
- State: one `fix(playground)` commit on `origin/main` `3ff34fa`, changing one string in `apps/playground/src/apps/live.ts`. No other file quotes the old label.
- Verification: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` (223 playground tests, 10 package tests) and `npm run build` passed. Not run: a visual check of the dropdown in the browser.
- Next action: you review and approve pushing this branch and opening the PR.

## Ranked work

1. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)). The avatar split is finished. [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker, local list and the visual and mouth experiments are in. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
