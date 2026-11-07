# Handoff

## In progress

### docs/refresh-split-plan

- Task: refresh the docs after [PR #30](https://github.com/pomodorozhong/wahwah/pull/30) (the playground move) and [PR #29](https://github.com/pomodorozhong/wahwah/pull/29) (the `wahwah` package). Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23); closes none. The branch is not linked to an issue.
- PR: none yet. Not pushed.
- State: `docs/avatar-split.md` starting condition 1 is marked met, and this file no longer carries the merged branch's subsection. Conditions 2 and 3 are unchanged: the repository, license, CI and Tofu skeleton do not exist yet.
- Verification: docs only. `git diff --check` passed.
- Next action: review and push this docs change, or fold it into the `wahwah-avatar` setup work.
- Do not: write Markdown with hard-wrapped lines. Do not rewrite the experiment paths in `docs/avatar-split.md`: they refer to the backup branch's old layout.

## Ranked work

1. Create `wahwah-avatar` with a license, CI and a Tofu skeleton that renders from a `FaceControlTrack` using the released `wahwah-0.1.0.tgz` ([#23](https://github.com/pomodorozhong/wahwah/issues/23), which closes when it builds against that tarball). The package and the `apps/playground/` move are done. Then split steps 1, 2, 4, 5 then 3, npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), then Python and Swift ([plan](docs/packaging.md)).
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
