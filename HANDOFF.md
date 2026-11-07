# Handoff

## In progress

### docs/packaging-plan

- Task: document the package layout, release-tarball distribution and the future Swift and Python packages in `docs/packaging.md`. Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23) and [#25](https://github.com/pomodorozhong/wahwah/issues/25); closes none. The branch is not linked to an issue.
- PR: none yet. [PR #21](https://github.com/pomodorozhong/wahwah/pull/21) merged as `0df612f`, and this branch starts from it.
- State: docs only. `docs/packaging.md` describes a planned layout (`apps/playground`, `packages/performance`, `packages/voice`, Python and Swift bindings), GitHub release tarballs now and npm later, the SwiftPM root constraint, and Rust as the source of truth for the format. Nothing in it is built. `docs/goals.md`, `docs/avatar-split.md` and `docs/README.md` link to it and no longer say "pinned git dependency".
- Verification: `git diff --check` to run before publishing. Application suites do not apply to a docs-only change.
- Next action: show the title and body for publish approval, then start the `packages/performance` PR for #23.
- Do not: write Markdown with hard-wrapped lines; the repository keeps one line per paragraph. Do not use a pinned git dependency for the package layout: npm cannot install a subfolder of a git repository.

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
