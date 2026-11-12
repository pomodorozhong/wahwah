# Playground guide

The switch at the top right chooses what drives the puppet: **Text to wahwah**, a line you write, or the **Live microphone**. A line is either **Text** or **Phonemes**, chosen with the switch at the start of the line. Switching stops playback or capture. Your character, framing, and drafts stay with you during the visit. The GitHub mark at the far right opens the project's repository.

On a wide screen, the puppet stays in view at the top left, with **Voice** and **Character** in a list under it that scrolls on its own. The right side holds the examples, the line, the playback monitor and **Length**. In **Live microphone**, the list holds **Voice profile** and the analysis tools instead, and **Response** takes Length's place. On a tablet the same two columns stay and the page scrolls. On a phone, the **Script** and **Voice** tabs show one group at a time. The length controls sit in **Script** under the line, and the diagnostics and analysis tools sit in a closed **Diagnostics** section at the bottom of **Voice**.

## Shape a Mumble voice

In **Text**, choose an example card above the line or enter up to 500 characters of text in any language, including Chinese and lines that mix languages. Each card shows its text and what it is good for, and choosing one replaces your line. Play a question, then change its punctuation to a period and listen to the ending. The word highlight follows the line during playback.

**Wah-wah trombone** is the default sound engine, chosen at the top of the **Voice** card. klattsch and the wah-wah trombone share the same invented syllables. Keep **Language style**, **Mood**, and **Seed** fixed to compare the two instruments. Change the seed to give familiar words new sounds. The syllable and stress guesses are tuned for English. Chinese, Japanese and Korean get one even syllable per character, and other scripts get a rough guess.

**Length** caps the line. All its settings are always shown, and they are disabled until you turn on **Cap the length of the line**. Then set **Maximum duration**: longer lines are sped up first, then cut, and a status line says which happened: under the cap on a phone, or at the right end of the playback monitor's chips. **Cut between words** ends the line where the last word that fits ends, and the fade shapes that ending. **Speed-up** (**Speed-up shape** and **Top speed**) chooses how a long line is sped up first, steadily or ramping up or down. **Volume** (**Volume shape** and **Volume level**) changes the volume along the line with the same shapes as the speed-up. **Fade at the cut** (**Fade shape**, **Fade length**, **Fade bend** and **End volume**) shapes the end of a cut line, from a hard cut to a two-second fade.

While the cap is on, the **Playback monitor** adds the fit to its plot: **Speed**, how much of the original line has been **Reached**, and the **Fade** volume, with dashed lines where the fade starts and where the line is cut. A cut line also shows, faintly, the part of the original line that the cut removed. The chips above the plot turn each signal on or off. Phones hide the playback monitor.

**Character → Derive the voice from a hash** derives pitch, rate, voice size, style, seed and trombone settings from a hex hash of at least 16 bytes, so the same hash always sounds the same. It applies to the klattsch and Wah-wah trombone voices, and the mood stays yours. While it is on, the voice settings, language style and seed show the values from the hash and are locked, and your own values come back when you turn it off. Use **Random hash** to hear a new character.

- **klattsch formant voice** gives you control over pitch, speaking rate, and voice size. Set **Trombone color** to zero to hear the plain voice.
- **Wah-wah trombone** plays the syllables as brass notes. Increase **Plunger wah** to exaggerate how the mute opens on vowels.
- **Muted Horn** and **Trombone (Talking Instruments)** play sliding brass notes with a mute that opens and closes on each note. Talking Instruments' Trombone has its own low, wobbly phrasing, separate from Wah-wah trombone.
- **Ooh Choir** blends three soft voices on pentatonic pitches.
- **Kazoo** gives the notes a buzzing membrane and a nasal resonance.

The four Talking Instruments choices turn text into their own note score, with a separate mouth movement for each note, including several notes inside one word. Use **Pitch**, **Speaking speed**, **Expression**, and **Brightness** to shape them. **Mood** and **Seed** also affect their phrasing. Their controls remember edits when you switch between voices during the visit. Language style applies to the klattsch and Wah-wah trombone syllable generator.

## Write a phoneme script

Choose **Phonemes** at the start of the line, select the **Lip workout** example, and press **Play line**. Phoneme scripts always play on the klattsch formant voice. **Length** works the same way as for text, and its settings carry over when you switch between Text and Phonemes. The editor takes ARPABET sounds such as `HH EH L OW`. Punctuation adds pauses. Try `AA . AA(+40)` to hear a pitch bend on the second vowel. Inline pitch and rate settings such as `b140` and `r90` override the voice sliders. The editor reports unrecognized tokens.

## Calibrate a microphone

1. Choose **Live microphone**. Under **Input**, select **Microphone**, press **Start**, and allow access. The puppet can already follow vowels using the resonances in your voice. Use headphones if you enable **Hear the microphone**.
2. Choose **Calibrate my voice** and begin the guided recording. Select **I'm quiet** to measure the room, then hold each prompted sound until the bar fills. You can pause, redo, or skip a sound.
3. Read the quality report for missed or easily confused sounds. Calibration selects **Your voice profile** under **Response → Mouth shape from**. The profile stays in this browser. Use **Export**, **Import**, or **Forget** to manage it. Calibrate again if you change microphones or rooms.

For a rehearsal, select **Demo voice** as the input. It can answer the calibration prompts itself.

### Understand mouth analysis and the vowel map

**Response → Mouth shape from** explains the selected analysis mode. **Your voice profile** matches calibrated sounds; **uLipSync-style** smooths those matches with a spring. **Formants** estimates vowel resonances without calibration. **Brightness only** approximates wide or rounded lips from the sound's brightness, while **Loudness only** moves just the jaw.

The **Vowel map** circle, in the list under the puppet, and one-second trail need running input, **Puppet output** enabled, and **Formants** selected. The map plots F1 (openness, down) and F2 (front, left). Other analysis modes do not measure F1/F2, so the mouth can move while the map has no circle. Silence and unvoiced sounds can also leave the map empty.

### Compare timing on one recording

Scroll the list under the puppet to **Delay test**. Choose **Record**, say a few spaced “ah” sounds followed by a short sentence, then stop the recording. Use **Play back** with **Audio delay** at zero. Choose **Match measured lag** and replay the same clip. Positive delay holds the audio back while the mouth moves.

If timing improves but the shapes still look jumpy, compare **Your voice profile** with **uLipSync-style** under **Response**. Try the latter with **uLipSync smoothness** at 50 ms and 20 ms. The clip is analysed again when you change settings. The best tradeoff between smoothness and delay on a physical microphone remains an open question.

## Watch the puppet

The playground starts with **Tofu cube**, the white, clipped-corner puppet. It follows the same mouth controls in text, phoneme, and microphone modes. The controls sit on the stage: **Tofu** or **Debug**, the **Puppet** menu with **Puppet output** and **Idle motion**, and **Reset view**.

To drive other characters, use [`wahwah-avatar`](https://github.com/pomodorozhong/wahwah-avatar), which plays the same performance on your own VRM models.

In the Tofu view, drag to orbit, Shift-drag or right-drag to pan, and scroll to zoom. On touchscreens, drag with one finger to orbit or use two to pan and pinch. **Reset view** restores the initial framing.

To see exactly what an input sends, choose **Debug** and replay the line. The solid arrows show how fast each mouth control is changing. The outlined arrows show its acceleration.
