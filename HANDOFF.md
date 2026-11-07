# Handoff

## In progress

### feat/wahwah-package

- Task: replace the `@wahwah/performance` package with one `wahwah` package that holds the voice engine and the performance types, for [#23](https://github.com/pomodorozhong/wahwah/issues/23). Related to #23, not closing it: #23 closes when `wahwah-avatar` builds against a released tarball. The branch is not linked to an issue.
- PR: none yet. [PR #28](https://github.com/pomodorozhong/wahwah/pull/28) merged and `performance-v0.1.0` was released from the re-pushed tag.
- State: `packages/wahwah` has three entry points (`wahwah`, `wahwah/performance`, `wahwah/mumble`), the generated WASM and presets, `loadVoices(source?)`, and its own tests. The playground and its tests import it. The release workflow now triggers on `v*` tags and installs the Rust toolchain. A local `refactor/playground-app` branch (unpushed) holds the finished move of the playground into `apps/playground/`; it must be redone on top of this PR because both touch the same files.
- Verification: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` (231 tests), `npm run build`, `npm run test:pages`, `npm run build:pages` and `git diff --check` passed. The packed tarball installed into a scratch project, rendered a Mumble line in plain Node and built with Vite. The release workflow has not run, and the playground was not opened in a browser on this branch.
- Next action: you review and merge the PR, then push the tag `v0.1.0` and confirm the release has `wahwah-0.1.0.tgz`. After that, delete the old `performance-v0.1.0` release and tag (`gh release delete performance-v0.1.0 --cleanup-tag`), and redo the playground move.
- Do not: write Markdown with hard-wrapped lines. Do not publish a tarball from a build that skipped the package tests. Do not make `generateMumble` or `tokenizeText` part of the main `wahwah` entry point; they stay in `wahwah/mumble` until a consumer needs them.

## Ranked work

1. Ship the `wahwah` package (voice engine and performance types) by GitHub release tarball, with the playground as the worked example. The avatar repository cannot start without it. Tracked in [#23](https://github.com/pomodorozhong/wahwah/issues/23). Publishing to npm waits until the split is confirmed finished ([#25](https://github.com/pomodorozhong/wahwah/issues/25)). Order after it: create `wahwah-avatar`, split steps 1, 2, 4, 5 then 3, the move to `apps/playground/`, npm, then Python and Swift ([plan](docs/packaging.md)).
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
