# Handoff

## In progress

### codex/docs-avatar-repo-boundary

- Task: document the planned split between the voice playground and `wahwah-avatar`. Related to [#6](https://github.com/pomodorozhong/wahwah/issues/6), [#11](https://github.com/pomodorozhong/wahwah/issues/11) and [#12](https://github.com/pomodorozhong/wahwah/issues/12); closes none.
- PR: [#21](https://github.com/pomodorozhong/wahwah/pull/21), open against main, based on `72f6ab0`. No merge is authorized.
- State: docs only. The PR defines the ownership split, keeps Tofu in `wahwah` as the reference VRM example, adds a versioned mapping to the hash-voice roadmap item, records maximum duration as the owner's decision, and moves the split method, steps and file lists into docs/avatar-split.md, with goals.md and architecture.md written as if the split is done. Nothing has moved yet. Content removed from `goals.md` is in a local handoff zip for the avatar repository, kept out of git.
- Verification: `git diff --check` re-run after the latest edits. Application suites are not relevant to a docs-only change.
- Next action: user reviews PR #21. After it merges, `docs/avatar-split.md` governs when code and issues move.

## Ranked work

1. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
2. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
3. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6), [#11](https://github.com/pomodorozhong/wahwah/issues/11), and P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) when that repository exists. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

- **P-16** Post the completion note below to [#10](https://github.com/pomodorozhong/wahwah/issues/10) under the connected GitHub account. The user chose to keep this request pending. Why: the GitHub Comment Identity skill requires explicit authorization to publish a comment. Blocks: recording the final deployment and verification on the closed issue.

```markdown
Codex-authored handoff note, 2026-11-05

Step 6 and the Rust/WASM port are complete. [PR #19](https://github.com/pomodorozhong/wahwah/pull/19) merged as `72f6ab0` and closed this issue. The MIT license, upstream notices, `/wahwah/` base path and Pages workflow are in main. The Pages build keeps local model files out of the artifact and model picker.

The initial [deployment](https://github.com/pomodorozhong/wahwah/actions/runs/41863265854) stalled during a [GitHub Actions and Pages incident](https://www.githubstatus.com/incidents/xr3myzj7ms51). Its uploaded artifact passed inspection, and the existing run later succeeded. The [public playground](https://pomodorozhong.github.io/wahwah/) and all 15 deployed files returned HTTP 200. Hosted browser checks passed for all six voices, Tofu animation, Phoneme script, mode switching and live Demo voice with no browser warnings or errors.

No port or deployment work remains. The local `codex/pages-handoff` branch is an unlinked documentation checkpoint. Multilingual invented-speech input is the next ranked capability.
```
