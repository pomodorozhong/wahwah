# Handoff

## In progress

### refactor/playground-app

- Task: move the playground into `apps/playground/` as the packaging plan describes. Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23); closes none. The branch is not linked to an issue. [PR #29](https://github.com/pomodorozhong/wahwah/pull/29) (the `wahwah` package) merged and the `v0.1.0` release exists.
- PR: none yet.
- State: redone on top of #29 (the earlier local version predated it and conflicted). `src/`, `tests/`, `public/`, the Tofu and Pages scripts, `vite.config.ts`, `tsconfig.json` and the entry pages moved to `apps/playground/` as renames, with a new `@wahwah/playground` package. The root scripts forward to it, so `npm run dev`, `test`, `typecheck` and `build` still work from the root. `packages/wahwah` and the release workflow are unchanged.
- Verification: `npm run typecheck`, `npm test` (224 playground tests and 10 `wahwah` tests), `npm run build`, `npm run test:pages`, `npm run build:pages` and `npm run build:packages` passed. The Rust checks were not rerun; no Rust file changed. The dev server and the playground in a browser were not exercised, and the Pages workflow has not run.
- Next action: you review and merge the PR. Then refresh the stale parts of `docs/avatar-split.md` (starting condition 1 is met) and this file.
- Do not: write Markdown with hard-wrapped lines. Do not rewrite the experiment paths in `docs/avatar-split.md`: they refer to the backup branch's old layout.

## Ranked work

1. Ship the `wahwah` package (voice engine and performance types) by GitHub release tarball, with the playground as the worked example. The avatar repository cannot start without it. Tracked in [#23](https://github.com/pomodorozhong/wahwah/issues/23). Publishing to npm waits until the split is confirmed finished ([#25](https://github.com/pomodorozhong/wahwah/issues/25)). Order after it: create `wahwah-avatar`, split steps 1, 2, 4, 5 then 3, npm, then Python and Swift ([plan](docs/packaging.md)).
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
