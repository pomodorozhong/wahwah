# Handoff

## In progress

### refactor/apps-playground

- Task: move the playground into `apps/playground/` as `docs/packaging.md` describes. No issue is filed, and the branch is not linked to one. It is unstarted: this branch holds only this handoff.
- PR: none. [PR #29](https://github.com/pomodorozhong/wahwah/pull/29) merged as `fbb50f2`, and [v0.1.0](https://github.com/pomodorozhong/wahwah/releases/tag/v0.1.0) is released with `wahwah-0.1.0.tgz`; it installs from its URL and rendered a Mumble line in plain Node. The old `performance-v0.1.0` release and tag are deleted. The user wants the move as its own PR after #29.
- Code checkpoint: `origin/main` at `fbb50f2`. The playground is still at the repository root, and `packages/wahwah` is the only package.
- State: a finished move exists on the local, unpushed branch `refactor/playground-app` (`0ffa233`, `bb54dbc`, `93dde55`), but it was built on the old `@wahwah/performance` layout and conflicts with the merged package. Redo it on this branch rather than merging it. It moves `index.html`, `babble/`, `klattsch/`, `live/`, `mumble/`, `vite.config.ts`, `tsconfig.json`, `public/`, `src/`, `tests/` and the playground's `scripts/` into `apps/playground/`, adds a private `@wahwah/playground` package, makes the root scripts forward to it (the root `dev` and `preview` scripts must end in `--` so port arguments reach Vite), and fixes: the `data/` imports (`../../../../data/`), `vite.config.ts` aliases and the LICENSE it publishes, `tests/setup.ts` (the WASM path under `packages/wahwah`), the Pages check, the Pages artifact path (`apps/playground/dist`), `.gitignore` for `apps/playground/public/models/`, and the docs paths. Experiment paths in `docs/avatar-split.md` stay in the old layout because they refer to the backup branch.
- Verification: nothing run on this branch. The earlier attempt passed every check and loaded in the browser.
- Next action: you approve a plan (the `open-pr` skill requires one), then redo the move and run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:pages` and `npm run build:pages`, and open the playground in the browser. Move the git-ignored `public/models/` files with the directory, and do not delete them.
- Pending on this branch: P-02, push `refactor/apps-playground` with this handoff commit, which publishes it. It blocks nothing else.
- Do not: write Markdown with hard-wrapped lines. Do not merge `refactor/playground-app`. Do not switch branches in the shared checkout; use a worktree. The `wahwah-avatar` handoff zip from 2026-11-07 lists the old `src/...` paths and is stale after this move.

## Ranked work

1. Create `wahwah-avatar` and build its Tofu skeleton against [v0.1.0](https://github.com/pomodorozhong/wahwah/releases/tag/v0.1.0) of the `wahwah` package; this is the acceptance for [#23](https://github.com/pomodorozhong/wahwah/issues/23), which closes when it builds. The starting conditions are in `docs/avatar-split.md`. The handoff zip from 2026-11-07 is stale on paths after the playground move.
2. Move the playground into `apps/playground/` (branch `refactor/apps-playground`), then the avatar split steps 1, 2, 4 and 5, then step 3 ([plan](docs/avatar-split.md)). Publishing to npm waits until the split is confirmed finished ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)).
3. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
4. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
5. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
6. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

- P-01: post a comment on [#25](https://github.com/pomodorozhong/wahwah/issues/25) recording the packaging decisions. Proposed text: "The package is now `wahwah`, one package with the voice engine and the performance types, released by tarball as v0.1.0. When publishing to npm, check that the `wahwah` name is still free (it returned 404 when checked on 2026-11-07), set up an npm account with two-factor authentication, and publish from GitHub Actions with provenance. Both upstream sources in `THIRD_PARTY_NOTICES.md` are MIT and the tarball carries their notices." It blocks nothing; it needs your OK because it posts to GitHub.
