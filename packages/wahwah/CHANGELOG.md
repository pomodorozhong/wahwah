# Changelog

## Unreleased

- `deriveVoice(hash, mapping)` and `VOICE_MAPPING_V1`: repeatable character voices from a caller-provided hash of at least 16 bytes. Adding them is not breaking.
- Multilingual Mumble input: Chinese, Japanese and Korean text gets an even syllable per character, accented Latin words stay whole, other scripts get a rough fallback, and fullwidth punctuation shapes pauses and pitch. English output is unchanged.
- An optional `maxDurationSeconds` argument on `renderMumble`, `renderPhonemes` and `renderInstrument`, and `RenderedUtterance.fit`: a longer line is sped up, then cut with a fade, with audio, timeline and face track fitted together. An optional `fit` argument shapes the fitting: `speedUp` (profile and top speed), `cutFade` (length, curve, bend and end volume), `volume` (a shape and a level along the line), and `cutAt` (`'word'` ends the line at the last whole word instead of inside one). The audio never runs past `floor(cap × sampleRate)` samples, and after a cut `script.words` lists only the words that still play.

## 0.1.0

First release of the `wahwah` package. It replaces the unpublished split into `@wahwah/performance` and `@wahwah/voice`.

- `wahwah/performance`: the mouth controls, the timed face track, the rendered utterance types and their sampling helpers. No WASM is involved.
- `wahwah`: the Rust/WASM voice engine (`loadVoices`, `renderMumble`, `renderPhonemes`, `renderInstrument`), the voice presets, and everything from `wahwah/performance`.
- `wahwah/mumble`: the Mumble generator and tokenizer. Unstable, and may change in any release.

The format may still change in 0.x releases. Additions are not breaking. Renaming or removing a field is, and bumps the minor version until 1.0.
