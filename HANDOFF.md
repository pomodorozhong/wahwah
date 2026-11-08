# Handoff

## In progress

### refactor/remove-vrm-picker

- Task: split steps 4 and 5. Removed the VRM picker, local `.vrm` loading and the generic VRM path from the playground, and updated the text that described them. Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23); closes none. The branch is not linked to an issue.
- PR: none yet. Not pushed.
- State: code is at `28e9940` and docs at `f2c981d`, on `origin/main` `9c8e3cb`. `wahwah-avatar` carries the picker and local list ([wahwah-avatar#5](https://github.com/pomodorozhong/wahwah-avatar/pull/5), merged). The `public/models/` ignore rule stays, because a local `public/models/` folder exists at the repository root. `docs/avatar-split.svg` still reads "Move #6, #11" and was left as is.
- Verification: `npm run typecheck`, `npm test` (223 playground tests, 10 package tests), `npm run build`, `npm run build:pages` and `npm run test:pages` passed. Not run: `cargo fmt`, `clippy` and `test`, because `cargo` is not on this shell's PATH and no Rust code changed. Not tried in a browser.
- Next action: you review and approve pushing this branch and opening the PR.

## Ranked work

1. Move the experiments to `wahwah-avatar` (split step 3; [plan](docs/avatar-split.md)), then npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), and Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. Its model picker and local list are in; the experiments have not moved. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
