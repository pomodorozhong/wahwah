# Handoff

## In progress

### codex/docs-avatar-repo-boundary

- Task: document the split between the voice playground and `wahwah-avatar`. Related to [#6](https://github.com/pomodorozhong/wahwah/issues/6), [#11](https://github.com/pomodorozhong/wahwah/issues/11) and [#12](https://github.com/pomodorozhong/wahwah/issues/12); closes none.
- PR: [#21](https://github.com/pomodorozhong/wahwah/pull/21), open, ready, awaiting your review and merge. Based on main at `7936d2b` after the merged [#22](https://github.com/pomodorozhong/wahwah/pull/22) unwrapped the Markdown. No merge is authorized.
- State: docs only. `docs/goals.md` and `docs/architecture.md` describe the split as done and keep Tofu, with its bug #12, in `wahwah` as the reference VRM example. `docs/avatar-split.md` holds the starting conditions, a swimlane diagram (`docs/avatar-split.svg`), seven steps (including removing the VRM view and rewording the `README.md`, `docs/playground.md` and `docs/development-notes.md` text that still describes it) and the file lists. The standalone performance interface is now roadmap item 1. Nothing has moved: the repository, the issue transfers (#6 and #11 only) and the code are all still to do. The visual direction notes removed from `docs/goals.md` are kept under "What moves" in `docs/avatar-split.md` for the avatar repository.
- Verification: `git diff --check` passed. Application suites do not apply to a docs-only change.
- Next action: you review and merge #21, then start the standalone interface ([#23](https://github.com/pomodorozhong/wahwah/issues/23)) as a pinned git dependency.
- Do not: write Markdown with hard-wrapped lines; the repository now keeps one line per paragraph.

## Ranked work

1. Make `RenderedUtterance` and `FaceControlTrack` a standalone interface shared as a pinned git dependency, with a small example that plays a performance on Tofu. The avatar repository cannot start without it. Tracked in [#23](https://github.com/pomodorozhong/wahwah/issues/23). Publishing it as a package waits until the split is confirmed finished ([#25](https://github.com/pomodorozhong/wahwah/issues/25)).
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
