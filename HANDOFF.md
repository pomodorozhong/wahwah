# Handoff

## In progress

### feat/performance-package

- Task: ship `@wahwah/performance` as a workspace package with a release workflow and make the playground import it, for [#23](https://github.com/pomodorozhong/wahwah/issues/23). Related to #23, not closing it: #23 closes when `wahwah-avatar` builds against a released tarball. The branch is not linked to an issue.
- PR: none yet. [PR #26](https://github.com/pomodorozhong/wahwah/pull/26) merged as `11a0e75`, and this branch starts from it.
- State: the package is in `packages/performance` (controls, sampler, performance types), the playground and its tests import it directly with no shims, `scripts/pack-release.mjs` and `.github/workflows/release.yml` build and attach the tarball on a `performance-v*` tag, and `docs/interface.md` covers install, versions and releasing. The release workflow has not run: no tag exists. No release has been published.
- Verification: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test` (230 tests), `npm run build`, `npm run test:pages` and `git diff --check` passed. The packed tarball installed into a scratch project that type-checked and ran under Node ESM. The playground UI was not opened in a browser.
- Next action: you review and merge the PR, then push the tag `performance-v0.1.0` to run the release workflow, then create `wahwah-avatar` against that tarball. Draft comments on #23 and #25 about the tarball decision for approval.
- Do not: write Markdown with hard-wrapped lines; the repository keeps one line per paragraph. Do not install the package from a git URL: npm cannot install a subfolder of a git repository.

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
