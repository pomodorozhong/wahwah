# Changelog

## 0.1.0

First release of the `wahwah` package. It replaces the unpublished split into `@wahwah/performance` and `@wahwah/voice`.

- `wahwah/performance`: the mouth controls, the timed face track, the rendered utterance types and their sampling helpers. No WASM is involved.
- `wahwah`: the Rust/WASM voice engine (`loadVoices`, `renderMumble`, `renderPhonemes`, `renderInstrument`), the voice presets, and everything from `wahwah/performance`.
- `wahwah/mumble`: the Mumble generator and tokenizer. Unstable, and may change in any release.

The format may still change in 0.x releases. Additions are not breaking. Renaming or removing a field is, and bumps the minor version until 1.0.
