# wahwah

Type “Hello there! How are you today?” and a white tofu puppet answers with a cartoon *wah-wah* voice. A muted trombone follows the rhythm of invented syllables and the rise at the end of a question. You can switch to synthetic speech or drive the mouth with your microphone.

[Open the playground](https://pomodorozhong.github.io/wahwah/).

![The default white tofu puppet with its mouth open mid-syllable](docs/face.jpg)

![Tofu mouth poses for neutral, AA, IY, UW and M](docs/poses.jpg)

## Run the playground

You need Node.js 24 or 26 with npm, and Rust for the voices. If you don't have Rust, install `rustup` and the WASM binding generator from the repository directory, which also installs the pinned Rust toolchain:

```sh
brew install rustup
"$(brew --prefix rustup)/bin/cargo" install wasm-bindgen-cli --version 0.2.130 --locked
```

Then run these commands from the repository directory:

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. In **Text to mumble**, press **Play line** to hear the sample, then type a line of your own. Use **Engine → Sound engine** to compare Wah-wah trombone, klattsch, Muted Horn, Trombone (Talking Instruments), Ooh Choir, and Kazoo. All six voices run in Rust/WASM.

Use **Input mode** to try the same puppet with another source.

- **Phoneme script** lets you write the sounds yourself. Try `M AA . IY . UW` and compare the small, open, wide, and rounded mouth shapes.
- **Live microphone** follows your voice as you speak. Choose **Microphone** or **Demo voice** under **Input**, then press **Start**. Allow microphone access if you chose the mic.

## Explore further

- [Playground guide](docs/playground.md) — shape a voice, calibrate your microphone, or compare playback delays.
- [Architecture](docs/architecture.md) — follow a syllable from the audio timeline to the three controls that move the mouth.
- [Project goals and decisions](docs/goals.md) — visual influences and plans for a reusable puppet SDK.
- [Development notes](docs/development-notes.md) — run the checks and measure voice-to-mouth timing.

## License

MIT — see [LICENSE](LICENSE). Upstream voice and browser-library notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
