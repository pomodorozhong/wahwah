# Handoff

## In progress

### codex/docs-avatar-repo-boundary

- Task: document the split between the voice playground and `wahwah-avatar`. Related to [#6](https://github.com/pomodorozhong/wahwah/issues/6), [#11](https://github.com/pomodorozhong/wahwah/issues/11) and [#12](https://github.com/pomodorozhong/wahwah/issues/12); closes none.
- PR: [#21](https://github.com/pomodorozhong/wahwah/pull/21), open, ready, awaiting your review and merge. Based on main at `7936d2b` after the merged [#22](https://github.com/pomodorozhong/wahwah/pull/22) unwrapped the Markdown. No merge is authorized.
- State: docs only. `docs/goals.md` and `docs/architecture.md` describe the split as done and keep Tofu, with its bug #12, in `wahwah` as the reference VRM example. `docs/avatar-split.md` holds the starting conditions, six steps (including removing the VRM view and rewording the `README.md`, `docs/playground.md` and `docs/development-notes.md` text that still describes it) and the file lists. The standalone performance interface is now roadmap item 1. Nothing has moved: the repository, the issue transfers (#6 and #11 only) and the code are all still to do. A local zip with removed `goals.md` content for the avatar repository is kept outside git.
- Verification: `git diff --check` passed. Application suites do not apply to a docs-only change.
- Next action: you review and merge #21, then approve P-19 so the standalone interface can start.
- Do not: write Markdown with hard-wrapped lines; the repository now keeps one line per paragraph.

## Ranked work

1. Make `RenderedUtterance` and `FaceControlTrack` a standalone, versioned interface (a package or a pinned git dependency) with a small example that plays a performance on Tofu. The avatar repository cannot start without it. Issue draft: P-19.
2. Add multilingual invented-speech input, including Chinese and mixed-language text, a general Unicode fallback, and language-specific rhythm improvements.
3. Add a general-purpose caller-provided hash for deterministic voice settings through a versioned mapping. Document Twitch as an example; account and chat handling belong to the external integration.
4. Add maximum output duration with synchronized audio and mouth timing. Shorter lines retain their natural duration. Exact-duration fitting is the P2 follow-up in [#20](https://github.com/pomodorozhong/wahwah/issues/20).

The avatar model and visual-style work is planned for `wahwah-avatar`. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) when that repository exists; P2 [#12](https://github.com/pomodorozhong/wahwah/issues/12) stays here with Tofu. The issue transfer and code migration have not started. The preserved experiment source is on `codex/backup-puppet-experiments-2026-11-02` at `4442a8c`; do not merge that snapshot wholesale or publish its model archives.

The Rust/WASM port and Pages launch are complete through [#10](https://github.com/pomodorozhong/wahwah/issues/10) and [PR #19](https://github.com/pomodorozhong/wahwah/pull/19).

## Pending

- **P-16** Post the completion note below to [#10](https://github.com/pomodorozhong/wahwah/issues/10) under the connected GitHub account. The user chose to keep this request pending. Why: the GitHub Comment Identity skill requires explicit authorization to publish a comment. Blocks: recording the final deployment and verification on the closed issue.

```markdown
Codex-authored handoff note, 2026-11-05

Step 6 and the Rust/WASM port are complete. [PR #19](https://github.com/pomodorozhong/wahwah/pull/19) merged as `72f6ab0` and closed this issue. The MIT license, upstream notices, `/wahwah/` base path and Pages workflow are in main. The Pages build keeps local model files out of the artifact and model picker.

The initial [deployment](https://github.com/pomodorozhong/wahwah/actions/runs/41863265854) stalled during a [GitHub Actions and Pages incident](https://www.githubstatus.com/incidents/xr3myzj7ms51). Its uploaded artifact passed inspection, and the existing run later succeeded. The [public playground](https://pomodorozhong.github.io/wahwah/) and all 15 deployed files returned HTTP 200. Hosted browser checks passed for all six voices, Tofu animation, Phoneme script, mode switching and live Demo voice with no browser warnings or errors.

No port or deployment work remains. The local `codex/pages-handoff` branch is an unlinked documentation checkpoint. The standalone performance interface is the next ranked item.
```

- **P-19** File a GitHub issue for the standalone performance interface, then link it from ranked item 1. Why: creating an issue needs your approval. Blocks: starting the work and the avatar repository. Draft: title `Make the performance interface importable without the playground`; body: Goal: let another project import `RenderedUtterance` and `FaceControlTrack` without the playground, as a versioned package or a pinned git dependency (choose which and record why). Scope: a minimal export of the two types and their helpers, a small example that plays a rendered performance on Tofu, and a version policy. Acceptance: a separate project builds against the interface and plays a performance on Tofu. Why now: `docs/avatar-split.md` requires it before the `wahwah-avatar` repository can start. Open question, needs-decision: package or pinned git dependency.
