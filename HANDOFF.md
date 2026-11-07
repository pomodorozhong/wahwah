# Handoff

## In progress

### docs/transfer-avatar-issues

- Task: split step 1. Transferred [#6](https://github.com/pomodorozhong/wahwah/issues/6) to [wahwah-avatar#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) to [wahwah-avatar#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4), then updated the links and the split plan. Related to [#23](https://github.com/pomodorozhong/wahwah/issues/23); closes none. The branch is not linked to an issue.
- PR: none yet. Not pushed.
- State: the issue transfers are done and cannot be undone. The transfer dropped #11's `idea` label, so the label was created in `wahwah-avatar` and reapplied. `docs/avatar-split.md` marks step 1 done and starting condition 3 met, and says `wahwah-avatar` carries a copy of Tofu. `docs/avatar-split.svg` still reads "Move #6, #11" and was left as is.
- Verification: docs only. `git diff --check` passed.
- Next action: you review and approve pushing this branch and opening the PR.
- Do not: write Markdown with hard-wrapped lines. Do not rewrite the experiment paths in `docs/avatar-split.md`: they refer to the backup branch's old layout.

## Ranked work

1. Move model picking, local model loading and generic VRM support from wahwah to `wahwah-avatar`, then remove them here (split steps 2, 4 and 5; [plan](docs/avatar-split.md)). Then the experiments (step 3), npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)), and Python and Swift ([plan](docs/packaging.md)). [#23](https://github.com/pomodorozhong/wahwah/issues/23) closes once `wahwah-avatar` builds against the tarball, which it now does.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).
5. Reword the live test-signal label that still says klattsch ([#24](https://github.com/pomodorozhong/wahwah/issues/24)). Small change; bundle it with other work.

The avatar model and visual-style work lives in [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which has its first playground and Pages site. Its issues [#3](https://github.com/pomodorozhong/wahwah-avatar/issues/3) (line boil, from #6) and [#4](https://github.com/pomodorozhong/wahwah-avatar/issues/4) (visual styles, from #11) were transferred; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The code migration has not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

None.
