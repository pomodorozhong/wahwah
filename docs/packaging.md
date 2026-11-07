# Packaging plan

How `wahwah` becomes importable by other projects, and how that extends to Swift and Python. Nothing here is built yet. Every layout below is planned. The ownership boundary with `wahwah-avatar` is in [Project goals](goals.md) and the [avatar split plan](avatar-split.md).

## Target layout

```
wahwah/
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── Package.swift
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── README.md
├── HANDOFF.md
├── AGENTS.md
├── .github/
│   └── workflows/
│       ├── pages.yml
│       ├── ci.yml
│       └── release.yml
├── crates/
│   ├── wahwah-core/
│   ├── wahwah-wasm/
│   ├── wahwah-python/
│   └── wahwah-swift/
├── data/
│   ├── mouth-poses.json
│   ├── mumble-presets.json
│   └── instrument-presets.json
├── packages/
│   ├── performance/
│   │   ├── package.json
│   │   ├── tsconfig.build.json
│   │   ├── CHANGELOG.md
│   │   ├── src/
│   │   │   ├── controls.ts
│   │   │   ├── sample.ts
│   │   │   ├── performance.ts
│   │   │   └── index.ts
│   │   └── tests/
│   ├── voice/
│   │   ├── package.json
│   │   ├── tsconfig.build.json
│   │   ├── CHANGELOG.md
│   │   ├── scripts/
│   │   │   └── build-wasm.mjs
│   │   ├── src/
│   │   │   ├── wasm/
│   │   │   ├── rustVoice.ts
│   │   │   ├── presets.ts
│   │   │   └── index.ts
│   │   └── tests/
│   ├── python/
│   │   ├── pyproject.toml
│   │   └── src/
│   └── swift/
│       ├── Sources/
│       └── Tests/
├── apps/
│   └── playground/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── public/
│       │   ├── tofu/
│       │   └── models/
│       ├── src/
│       │   ├── apps/
│       │   ├── host/
│       │   ├── live/
│       │   ├── ui/
│       │   ├── puppet/
│       │   ├── playback.ts
│       │   └── analysis.ts
│       ├── tests/
│       └── scripts/
│           ├── check-pages.mjs
│           ├── tofu/
│           └── docs/
├── scripts/
│   └── pack-release.mjs
└── docs/
    ├── README.md
    ├── goals.md
    ├── architecture.md
    ├── avatar-split.md
    ├── packaging.md
    ├── releasing.md
    ├── playground.md
    └── development-notes.md
```

## Packages

- **`@wahwah/performance`** holds the types and helpers a host needs to play a performance: `FaceControls`, `FaceControlTrack`, `RenderedUtterance`, `Timeline`, `sampleFaceTrack`, `segmentAt`. It has no dependencies and no browser, Three.js or WASM code. This is the standalone interface of [#23](https://github.com/pomodorozhong/wahwah/issues/23).
- **`@wahwah/voice`** wraps the Rust/WASM engine and its adapter so another project can generate speech. It depends on `@wahwah/performance`.
- **`@wahwah/playground`** is the app and stays private. It imports both packages like any other consumer, which makes it the worked example of the interface. A test checks that the Tofu path imports only the package, not engine internals.
- **Python and Swift** wrap the Rust core, not the TypeScript packages. `crates/wahwah-python` (PyO3, built into wheels with maturin) feeds `packages/python`. `crates/wahwah-swift` (UniFFI or a C ABI, built into an XCFramework) feeds `packages/swift`.

## Distribution

| Target | How it ships |
| --- | --- |
| TypeScript, for now | GitHub release tarballs, one tag per package such as `performance-v0.1.0`. CI runs `npm pack` and attaches the file to a release. A consumer installs by URL, and the lockfile records its hash. |
| TypeScript, later | npm, with provenance from GitHub Actions ([#25](https://github.com/pomodorozhong/wahwah/issues/25)). Publishing waits until the split is confirmed finished. |
| Python | PyPI wheels, with a CI matrix for macOS, Linux and Windows. |
| Swift | A `binaryTarget` that points to an XCFramework zip attached to a release, with its checksum. |

Rejected:

- **A pinned git dependency.** npm cannot install a subfolder of a git repository, so the package layout cannot be installed that way.
- **GitHub Packages.** Installing needs a token even for public packages, and the scope must match the GitHub owner.

Each TypeScript tarball ships compiled `dist/` and type declarations, so a consumer does not need to compile TypeScript from `node_modules`. The `voice` tarball also ships the built `.wasm` and its generated JavaScript, so consumers need no Rust toolchain. `rust-toolchain.toml` pins the toolchain that builds it.

During development, link a package with a `file:` path.

## Constraints

- **SwiftPM** reads `Package.swift` from the repository root and cannot point at a subfolder. Either keep `Package.swift` at the root, or put the Swift package in its own small repository.
- **Python wheels** are platform-specific, so the release workflow needs a build matrix.
- **The `@wahwah` npm scope** must be available, and `voice` needs a licence check on the code derived from klattsch and Babble Engine before it is published anywhere public.

## Source of truth

Rust defines the format of the mouth controls, the track and the timeline. Shared JSON fixtures, such as a sample `FaceControlTrack`, are loaded by the tests of every language. The TypeScript `performance` package is the JavaScript view of that format, so adding Swift and Python does not create a third definition.

## Order

1. This plan.
2. `packages/performance` and switching the playground's imports to it ([#23](https://github.com/pomodorozhong/wahwah/issues/23)), with the release workflow.
3. Create `wahwah-avatar` and build its Tofu skeleton against the package.
4. Split steps 1, 2, 4 and 5, then step 3 (see the [avatar split plan](avatar-split.md)).
5. `packages/voice`, after the licence check.
6. Move the playground into `apps/playground/`, after the split so the split steps do not fight path changes.
7. Publish to npm ([#25](https://github.com/pomodorozhong/wahwah/issues/25)).
8. Python and Swift, when a consumer needs them.
