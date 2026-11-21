# Agents

wahwah, the mumble voice playgrounds: invented, stylized speech (klattsch, Babble Engine, a wah-wah trombone synth) with a host-agnostic 3D puppet control format, plus a live microphone mode. TypeScript + Vite + Three.js + Web Audio, managed with npm, with voices moving to Rust/WASM under `crates/`. See `README.md` to run the playground and `docs/` for architecture, decisions, and development notes.

Checks before committing: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run typecheck`, `npm test`, `npm run build`.
