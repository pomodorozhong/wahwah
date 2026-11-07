# Handoff

## In progress

### fix/release-package-tests

- Task: fix the release workflow for `@wahwah/performance`, which failed on `performance-v0.1.0` because the package tests loaded the playground's WASM setup. Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23); closes none. The branch is not linked to an issue.
- PR: none yet. [PR #27](https://github.com/pomodorozhong/wahwah/pull/27) merged as `5eea198`. The tag `performance-v0.1.0` was pushed to that commit, the release run `42345652712` failed in "Test the package", and no release or tarball exists.
- State: the package has its own `vitest.config.ts` and a `test` script, and the release workflow runs `npm test --workspace`. The package tests pass with `src/wasm` removed.
- Verification: `npm test` (all suites), `npm run typecheck` and `git diff --check` passed. The release workflow has not run again.
- Next action: you review and merge the PR, then delete the remote tag `performance-v0.1.0` (no release was published from it) and push it again on the fixed `main`, which needs your approval. Then confirm the release has the tarball. The move to `apps/playground/` waits for that and for your go.
- Do not: write Markdown with hard-wrapped lines. Do not publish a tarball from a build that skipped the package tests.

## Ranked work

1. Make `RenderedUtterance` and `FaceControlTrack` a standalone `@wahwah/performance` package shared by GitHub release tarball, with the playground as the worked example. The avatar repository cannot start without it. Tracked in [#23](https://github.com/pomodorozhong/wahwah/issues/23). Publishing to npm waits until the split is confirmed finished ([#25](https://github.com/pomodorozhong/wahwah/issues/25)). Order after it: create `wahwah-avatar`, split steps 1, 2, 4, 5 then 3, `packages/voice` (licence check first), the move to `apps/playground/`, npm, then Python and Swift ([plan](docs/packaging.md)).
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
