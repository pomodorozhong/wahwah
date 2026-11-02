# Playground guide

The **Input mode** menu changes what drives the puppet. Switching modes stops
playback or capture. Your character, framing, and script drafts stay with you
during the visit.

## Shape a babble voice

In **Text to babble**, choose a sample or enter up to 500 characters of
English. Play a question, then change its punctuation to a period and listen
to the ending. The word highlight follows the line during playback.

In **Voice**, klattsch and the wah-wah trombone share the same invented
syllables. Keep **Language style**, **Mood**, and **Seed** fixed to compare
the two instruments. Change the seed to give familiar words new sounds. The
syllable and stress guesses work best on ordinary English words.

- **klattsch formant voice** gives you control over pitch, speaking rate, and
  voice size. Set **Trombone color** to zero to hear the plain voice.
- **Wah-wah trombone** plays the syllables as brass notes. Increase
  **Plunger wah** to exaggerate how the mute opens on vowels.
- **Babble Engine** generates its own syllables. Choose a style and voice to
  hear how it interprets the same text.

## Write a phoneme script

Choose **Phoneme script**, select the **Lip workout** preset, and press
**Play line**. The editor takes ARPABET sounds such as `HH EH L OW`.
Punctuation adds pauses. Try `AA . AA(+40)` to hear a pitch bend on the
second vowel. Inline pitch and rate settings such as `b140` and `r90`
override the voice sliders. The editor reports unrecognized tokens.

## Calibrate a microphone

1. Choose **Live microphone**. Under **Input**, select **Microphone**, press
   **Start**, and allow access. The puppet can already follow vowels using
   the resonances in your voice. Use headphones if you enable **Hear the
   microphone**.
2. Choose **Calibrate my voice** and begin the guided recording. Select
   **I'm quiet** to measure the room, then hold each prompted sound until the
   bar fills. You can pause, redo, or skip a sound.
3. Read the quality report for missed or easily confused sounds. Calibration
   selects **Your voice profile** under **Voice → Mouth shape from**. The
   profile stays in this browser. Use **Export**, **Import**, or **Forget**
   to manage it. Calibrate again if you change microphones or rooms.

For a rehearsal, select **Demo voice** as the input. It can answer the
calibration prompts itself.

### Compare timing on one recording

Open **Analysis → Delay test**. Choose **Record**, say a few spaced “ah”
sounds followed by a short sentence, then stop the recording. Use **Play
back** with **Audio delay** at zero. Choose **Match measured lag** and replay
the same clip. Positive delay holds the audio back while the mouth moves.

If timing improves but the shapes still look jumpy, compare **Your voice
profile** with **uLipSync-style** under **Voice**. Try the latter with
**uLipSync smoothness** at 50 ms and 20 ms. The clip is analysed again when
you change settings. The best tradeoff between smoothness and delay on a
physical microphone remains an open question.

## Load a character

The playground starts with **Tofu cube**, the white, clipped-corner puppet.
It follows the same mouth controls in text, phoneme, and microphone modes.
Choose **Preview face** under **Puppet → View** to use the procedural face.

Under **Puppet → View**, choose **VRM model** or **Live2D model**. In
**Model**, open a local `.vrm` file or select a Live2D model folder containing
its `.model3.json`, mesh, and textures. Include the Cubism Core runtime from
the Cubism SDK for Web in the selected folder or at the path below.

To offer characters in the menu on startup, place their files in this layout
before running or building the playground. Models and Cubism Core are supplied
locally. Use assets you have permission to use.

```text
public/models/
  vrm/character.vrm
  live2d/live2dcubismcore.min.js
  live2d/character/character.model3.json
```

In the tofu, preview, and VRM views, drag to orbit, Shift-drag or right-drag to pan,
and scroll to zoom. On touchscreens, drag with one finger to orbit or use two
to pan and pinch. **Reset view** restores the initial framing.

To see exactly what an input sends, choose **Debug (instructions)** and replay
the line. The solid arrows show how fast each mouth control is changing. The
outlined arrows show its acceleration.
