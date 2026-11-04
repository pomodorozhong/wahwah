# Playground guide

The **Input mode** menu changes what drives the puppet. Switching modes stops
playback or capture. Your character, framing, and script drafts stay with you
during the visit.

## Shape a Mumble voice

In **Text to mumble**, choose a sample or enter up to 500 characters of
English. Play a question, then change its punctuation to a period and listen
to the ending. The word highlight follows the line during playback.

**Wah-wah trombone** is the default sound engine. In **Voice**, klattsch and
the wah-wah trombone share the same invented
syllables. Keep **Language style**, **Mood**, and **Seed** fixed to compare
the two instruments. Change the seed to give familiar words new sounds. The
syllable and stress guesses work best on ordinary English words.

- **klattsch formant voice** gives you control over pitch, speaking rate, and
  voice size. Set **Trombone color** to zero to hear the plain voice.
- **Wah-wah trombone** plays the syllables as brass notes. Increase
  **Plunger wah** to exaggerate how the mute opens on vowels.
- **Muted Horn** and **Trombone (Talking Instruments)** play sliding brass
  notes with a mute that opens and closes on each note. Talking Instruments'
  Trombone has its own low, wobbly phrasing, separate from Wah-wah trombone.
- **Ooh Choir** blends three soft voices on pentatonic pitches.
- **Kazoo** gives the notes a buzzing membrane and a nasal resonance.

The four Talking Instruments choices turn text into their own note score,
with a separate mouth movement for each note, including several notes inside
one word. Use **Pitch**, **Speaking speed**, **Expression**, and **Brightness**
to shape them. **Mood** and **Seed** also affect their phrasing. Their controls
remember edits when you switch between voices during the visit. Language style
applies to the klattsch and Wah-wah trombone syllable generator.

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

### Understand mouth analysis and the vowel map

**Voice → Mouth shape from** explains the selected analysis mode. **Your
voice profile** matches calibrated sounds; **uLipSync-style** smooths those
matches with a spring. **Formants** estimates vowel resonances without
calibration. **Brightness only** approximates wide or rounded lips from the
sound's brightness, while **Loudness only** moves just the jaw.

The **Analysis → Vowel map** circle and one-second trail need running input,
**Puppet output** enabled, and **Formants** selected. The map plots F1
(openness, down) and F2 (front, left). Other analysis modes do not measure
F1/F2, so the mouth can move while the map has no circle. Silence and unvoiced
sounds can also leave the map empty.

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

Under **Puppet → View**, choose **VRM model**. In **Model**, open a local
`.vrm` file or choose one of the models supplied at startup.
This option has been tested with pixiv’s `VRM1_Constraint_Twist_Sample`;
other VRM models may behave differently. The sample is supplied locally,
separately from the bundled Tofu puppet.

To offer characters in the menu on startup, place their files in this layout
before running or building the playground. Models are supplied locally.
Use assets you have permission to use.

```text
public/models/
  vrm/character.vrm
```

In the tofu and VRM views, drag to orbit, Shift-drag or right-drag to pan,
and scroll to zoom. On touchscreens, drag with one finger to orbit or use two
to pan and pinch. **Reset view** restores the initial framing.

To see exactly what an input sends, choose **Debug (instructions)** and replay
the line. The solid arrows show how fast each mouth control is changing. The
outlined arrows show its acceleration.
