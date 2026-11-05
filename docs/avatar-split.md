# Avatar split plan

How the avatar work moves out of `wahwah` into `wahwah-avatar`. The resulting ownership is described in [Project goals](goals.md) and the [architecture guide](architecture.md). This document covers the method, the order, and what moves.

## Starting conditions

Do not create the repository or move code or issues until all three hold.

1. **Consumable interface** (roadmap item 1). `RenderedUtterance` and `FaceControlTrack` can be imported without the playground, as a versioned package or a pinned git dependency. Choose which, and document a small example that plays a rendered performance on Tofu.
2. **Boundary documented.** The goals and architecture docs describe the split.
3. **Destination ready.** The repository exists with a license, CI, and a skeleton that renders Tofu from a `FaceControlTrack` using the interface in condition 1.

## Steps

Each step is its own PR.

1. Transfer [#6](https://github.com/pomodorozhong/wahwah/issues/6) (line boil) and [#11](https://github.com/pomodorozhong/wahwah/issues/11) (visual styles). [#12](https://github.com/pomodorozhong/wahwah/issues/12) (Tofu M/B/P closure, P2) stays in `wahwah` because Tofu does.
2. Move the host extras and model picking.
3. Extract the visual and mouth experiments, replacement mouths before optional mouth modes.
4. Remove what moved from `wahwah`, and update `vite.config.ts`, `scripts/check-pages.mjs` and the picker tests. The voice playground and its Pages workflow stay.
5. Remove the VRM model view from the playground, and change the text that describes it: the VRM sentence in `README.md`, the VRM model and local `.vrm` instructions and the tofu-and-VRM camera sentence in `docs/playground.md`, and the VRM mentions in `docs/development-notes.md`. Until this step the guides describe the VRM view that still exists.
6. Build the Twitch/OBS app. It needs the hash voice interface from the roadmap.

## What stays in wahwah

Tofu: `scripts/tofu/`, `public/tofu/corner-cut.vrm`, `src/host/mappings.ts`, the minimal VRM host the playground needs to show it, and their tests and pose images (`docs/face.jpg`, `docs/poses.jpg`, `tests/mappings.test.ts`, `tests/tofu.test.js`). Three.js and `@pixiv/three-vrm` stay with them.

## What moves

- Host extras: `src/host/faceNavigation.ts`, `src/host/follower.ts`, `src/host/studyMotion.ts`, and any part of `src/host/host.ts`, `src/host/renderer.ts` and `src/host/vrm.ts` that only serves other models or styles. Decide the exact split when extracting.
- Model picking and local model loading: the avatar parts of `src/ui/puppetView.ts`, the local-model manifest in `vite.config.ts`, `src/localModels.d.ts` and `tests/puppetView.test.ts`.
- Experiments, from the preserved `codex/backup-puppet-experiments-2026-11-02` branch: `src/host/surfaceStyle.ts`, `src/host/inkDither.ts`, `src/host/comicPrint.ts`, `src/host/puppetMouth.ts`, `src/host/referenceMouth.ts`, `src/host/mouthModes.ts` and `scripts/remake-vrm-models.mjs`. Rework changes to `renderer.ts`, `vrm.ts`, `host.ts` and `puppetView.ts` against the current code. The snapshot also holds obsolete app code and private model archives, so do not merge it wholesale, and keep generated archives and sample model ZIPs local.
