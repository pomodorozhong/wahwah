use wahwah_core::{
    ScoreOptions, Voice, compile_score,
    mouth::{FaceControls, TrackOptions, generate_face_track, viseme},
    mumble::{
        MumbleOptions, TextToken, Tone, count_syllables, generate_mumble, presets, stress_index,
        tokenize_text,
    },
    render_performance,
};

fn options(seed: u32) -> MumbleOptions {
    MumbleOptions {
        seed,
        ..Default::default()
    }
}

#[test]
fn english_rhythm_and_stress_need_no_dictionary() {
    for (word, expected) in [
        ("cat", 1),
        ("make", 1),
        ("jumped", 1),
        ("table", 2),
        ("wanted", 2),
        ("boxes", 2),
        ("banana", 3),
        ("beautiful", 3),
        ("information", 4),
        ("I", 1),
        ("42", 1),
        ("2026", 2),
    ] {
        assert_eq!(count_syllables(word), expected, "{word}");
    }
    assert_eq!(stress_index("the", 1), None);
    assert_eq!(stress_index("information", 4), Some(2));
    assert_eq!(stress_index("cat", 1), Some(0));
}

#[test]
fn tokenization_keeps_byte_offsets_and_classifies_breaks() {
    let text = "🧊 Wait, what?! It’s fine… really.";
    let tokens = tokenize_text(text);
    assert!(tokens.contains(&TextToken::Break {
        mark: ',',
        tone: Tone::None
    }));
    assert!(tokens.contains(&TextToken::Break {
        mark: '.',
        tone: Tone::Question
    }));
    assert!(tokens.contains(&TextToken::Break {
        mark: ';',
        tone: Tone::None
    }));
    for token in tokens {
        if let TextToken::Word {
            text: word,
            start,
            end,
        } = token
        {
            assert_eq!(&text[start..end], word);
        }
    }
}

#[test]
fn seed_and_style_choose_repeatable_sounds() {
    let text = "Hello there! How are you today?";
    let a = generate_mumble(text, &options(7));
    let b = generate_mumble(text, &options(7));
    assert_eq!(a.phonemes, b.phonemes);
    assert_eq!(a.words, b.words);
    assert_ne!(a.phonemes, generate_mumble(text, &options(8)).phonemes);
    let other = generate_mumble(
        text,
        &MumbleOptions {
            style_id: "chirpy".into(),
            ..options(7)
        },
    );
    assert_ne!(a.phonemes, other.phonemes);
    let repeated = generate_mumble("Banana, I said banana!", &options(3));
    assert_eq!(repeated.words[0].spelled, repeated.words[3].spelled);
}

#[test]
fn punctuation_gives_pauses_and_final_pitch() {
    let q = generate_mumble("Are you there?", &options(1));
    let statement = generate_mumble("Are you there.", &options(1));
    assert!(q.phonemes.contains("(+45)"));
    assert!(statement.phonemes.contains("(-12)"));
    let s = generate_mumble("Wait, what?! Fine.", &options(1));
    assert_eq!(
        s.phonemes
            .split_whitespace()
            .filter(|s| [",", ";", "."].contains(s))
            .collect::<Vec<_>>(),
        vec![",", ".", "."]
    );
    assert_eq!(generate_mumble("?!...", &options(1)).phonemes, "");
}

#[test]
fn every_style_and_mood_make_a_valid_score() {
    for style in &presets().styles {
        for mood in &presets().moods {
            let script = generate_mumble(
                "Hello there! How are you today?",
                &MumbleOptions {
                    seed: 9,
                    style_id: style.id.clone(),
                    mood_id: mood.id.clone(),
                },
            );
            let score = compile_score(&script.phonemes, &mood.voice(&ScoreOptions::default()));
            assert!(
                score.warnings.is_empty(),
                "{} / {}: {:?}",
                style.id,
                mood.id,
                score.warnings
            );
            assert!(score.duration_seconds() > 0.0);
            for segment in &score.segments {
                if let Some(code) = &segment.phoneme {
                    assert!(script.phonemes[segment.src_start..segment.src_end].contains(code));
                    assert!(
                        script
                            .words
                            .iter()
                            .any(|w| w.out_start <= segment.src_start
                                && segment.src_start < w.out_end)
                    );
                }
            }
        }
    }
}

#[test]
fn mood_changes_timing_and_pitch_in_rust() {
    let render = |mood_id: &str| {
        let script = generate_mumble(
            "Hello there.",
            &MumbleOptions {
                mood_id: mood_id.into(),
                ..options(1)
            },
        );
        let settings = script.mood.voice(&ScoreOptions::default());
        (compile_score(&script.phonemes, &settings), settings)
    };
    let (happy, happy_settings) = render("happy");
    let (sad, sad_settings) = render("sad");
    assert!(happy.duration_seconds() < sad.duration_seconds());
    assert!(happy_settings.base_f0 > sad_settings.base_f0);
}

#[test]
fn source_ranges_are_bytes_even_after_smart_punctuation() {
    let text = "🧊 It’s fine — hello!";
    let script = generate_mumble(text, &options(1));
    assert_eq!(script.words[0].src_start, 5);
    for word in &script.words {
        assert_eq!(&text[word.src_start..word.src_end], word.text);
        assert!(!script.phonemes[word.out_start..word.out_end].is_empty());
    }
}

#[test]
fn unknown_presets_fall_back_and_empty_input_is_silent() {
    let script = generate_mumble(
        "",
        &MumbleOptions {
            seed: 0,
            style_id: "missing".into(),
            mood_id: "missing".into(),
        },
    );
    assert_eq!(script.style.id, "bubbly");
    assert_eq!(script.mood.id, "neutral");
    let score = compile_score(&script.phonemes, &ScoreOptions::default());
    let p = render_performance(
        &score,
        24000.0,
        &Voice::Formant { brass_color: 0.0 },
        Some(&TrackOptions::default()),
    );
    assert!(p.audio.iter().all(|v| *v == 0.0));
    assert!(
        p.track
            .unwrap()
            .samples
            .iter()
            .all(|s| s.controls == FaceControls::default())
    );
}

#[test]
fn combined_render_has_one_duration_and_optional_track() {
    let score = compile_score("M AA . IY UW P", &ScoreOptions::default());
    for sample_rate in [22050.0, 24000.0, 44100.0, 48000.0] {
        for voice in [
            Voice::Formant { brass_color: 0.75 },
            Voice::Trombone(Default::default()),
        ] {
            let p = render_performance(&score, sample_rate, &voice, Some(&TrackOptions::default()));
            assert_eq!(
                p.audio.len(),
                (p.timeline.duration_seconds * sample_rate).ceil() as usize
            );
            assert!(p.audio.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
            assert!(p.audio.iter().any(|v| v.abs() > 0.05));
            let track = p.track.unwrap();
            assert_eq!(track.duration_seconds, p.timeline.duration_seconds);
            assert_eq!(
                track.samples.last().unwrap().time_seconds,
                p.timeline.duration_seconds
            );
            let off = render_performance(&score, sample_rate, &voice, None);
            assert!(off.track.is_none());
            assert_eq!(off.audio, p.audio);
        }
    }
}

#[test]
fn poses_close_bilabials_and_keep_vowels_distinct() {
    let score = compile_score(
        "AA M AA . IY UW B P",
        &ScoreOptions {
            rate: 250.0,
            ..Default::default()
        },
    );
    let track = generate_face_track(
        &score.segments,
        score.duration_seconds(),
        &TrackOptions::default(),
    );
    let middle = |index: usize| {
        let s = &score.segments[index];
        let time = (s.start_seconds + s.end_seconds) / 2.0;
        track
            .samples
            .iter()
            .min_by(|a, b| {
                (a.time_seconds - time)
                    .abs()
                    .total_cmp(&(b.time_seconds - time).abs())
            })
            .unwrap()
            .controls
    };
    assert!(middle(0).jaw_open > 0.7);
    for index in [1, 3, 6, 7] {
        assert!(middle(index).jaw_open < 0.1, "index {index}");
    }
    assert!(middle(4).lip_width > 0.7);
    assert!(middle(5).lip_round > 0.8);
}

#[test]
fn tracks_are_bounded_smooth_and_neutral_at_the_edges() {
    let score = compile_score(
        "AA . IY . UW . M . AY",
        &ScoreOptions {
            rate: 250.0,
            ..Default::default()
        },
    );
    let track = generate_face_track(
        &score.segments,
        score.duration_seconds(),
        &TrackOptions::default(),
    );
    assert_eq!(
        track.samples.first().unwrap().controls,
        FaceControls::default()
    );
    assert_eq!(
        track.samples.last().unwrap().controls,
        FaceControls::default()
    );
    for s in &track.samples {
        let c = s.controls;
        assert!(
            [c.jaw_open, c.lip_width, c.lip_round]
                .iter()
                .all(|v| v.is_finite() && (0.0..=1.0).contains(v))
        );
        assert!(c.lip_width + c.lip_round <= 1.0 + 1e-9);
    }
    for pair in track.samples.windows(2) {
        assert!(pair[0].time_seconds <= pair[1].time_seconds);
        assert!((pair[0].controls.jaw_open - pair[1].controls.jaw_open).abs() < 0.15);
    }
}

#[test]
fn diphthongs_glide_and_weak_consonants_borrow_context() {
    let score = compile_score(
        "AY",
        &ScoreOptions {
            rate: 600.0,
            ..Default::default()
        },
    );
    let track = generate_face_track(
        &score.segments,
        score.duration_seconds(),
        &TrackOptions::default(),
    );
    assert!(track.samples[15].controls.jaw_open > track.samples[45].controls.jaw_open);
    let score = compile_score(
        "AA T AA",
        &ScoreOptions {
            rate: 200.0,
            ..Default::default()
        },
    );
    let track = generate_face_track(
        &score.segments,
        score.duration_seconds(),
        &TrackOptions::default(),
    );
    assert!(track.samples[28].controls.jaw_open > viseme("T").pose.jaw_open);
}
