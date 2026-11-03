use wahwah_core::{
    Score, ScoreOptions, TromboneOptions, compile_score, render_formant, render_trombone,
};

const SAMPLE_RATE: f64 = 24_000.0;

fn score(source: &str) -> Score {
    compile_score(source, &ScoreOptions::default())
}

fn rms(samples: &[f32]) -> f64 {
    let sum: f64 = samples.iter().map(|&v| f64::from(v) * f64::from(v)).sum();
    (sum / samples.len().max(1) as f64).sqrt()
}

fn window(samples: &[f32], start_seconds: f64, end_seconds: f64) -> &[f32] {
    let at = |t: f64| ((t * SAMPLE_RATE) as usize).min(samples.len());
    &samples[at(start_seconds)..at(end_seconds)]
}

/// Fundamental in Hz, by the strongest autocorrelation lag between 60 and 500 Hz.
fn fundamental(samples: &[f32]) -> f64 {
    let lags = (SAMPLE_RATE / 500.0) as usize..(SAMPLE_RATE / 60.0) as usize;
    let correlation = |lag: usize| -> f64 {
        samples
            .iter()
            .zip(&samples[lag..])
            .map(|(&a, &b)| f64::from(a) * f64::from(b))
            .sum()
    };
    let best = lags
        .max_by(|&a, &b| correlation(a).total_cmp(&correlation(b)))
        .unwrap();
    SAMPLE_RATE / best as f64
}

fn voices(score: &Score) -> Vec<Vec<f32>> {
    vec![
        render_formant(score, SAMPLE_RATE, 0.0),
        render_formant(score, SAMPLE_RATE, 0.75),
        render_formant(score, SAMPLE_RATE, 1.0),
        render_trombone(score, SAMPLE_RATE, &TromboneOptions::default()),
    ]
}

#[test]
fn every_voice_is_finite_audible_and_in_range() {
    let score = score("HH EH L OW , M IY B AA DH UW . S AA T IY");
    for audio in voices(&score) {
        assert!(audio.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
        assert!(rms(&audio) > 0.01);
    }
}

#[test]
fn every_voice_matches_the_timeline_length_at_any_sample_rate() {
    let score = score("M AA L IY");
    for sample_rate in [22_050.0, 44_100.0, 48_000.0] {
        let expected = (score.duration_seconds() * sample_rate).ceil() as usize;
        assert_eq!(render_formant(&score, sample_rate, 1.0).len(), expected);
        assert_eq!(
            render_trombone(&score, sample_rate, &TromboneOptions::default()).len(),
            expected
        );
    }
}

#[test]
fn the_same_input_gives_the_same_audio() {
    let score = score("S AA SH IY");
    assert_eq!(voices(&score), voices(&score));
}

#[test]
fn empty_text_is_short_silence() {
    let score = score("");
    assert!(score.segments.is_empty());
    assert!(score.warnings.is_empty());
    assert_eq!(rms(&render_formant(&score, SAMPLE_RATE, 0.0)), 0.0);
}

#[test]
fn rate_and_stress_change_duration() {
    let at_rate = |rate: f64| {
        compile_score(
            "M AA L IY",
            &ScoreOptions {
                rate,
                ..ScoreOptions::default()
            },
        )
        .total_ms
    };
    assert!(at_rate(200.0) > at_rate(80.0));
    assert!(score("AA'").total_ms > score("AA").total_ms);
    assert!(score("AA !").total_ms == score("AA'").total_ms);
}

#[test]
fn base_pitch_sets_the_heard_pitch() {
    let at_pitch = |base_f0: f64| {
        let score = compile_score(
            "AA",
            &ScoreOptions {
                base_f0,
                rate: 600.0,
                ..ScoreOptions::default()
            },
        );
        let audio = render_formant(&score, SAMPLE_RATE, 0.0);
        fundamental(window(&audio, 0.1, 0.5))
    };
    assert!((at_pitch(120.0) - 120.0).abs() < 5.0);
    assert!((at_pitch(240.0) - 240.0).abs() < 10.0);
}

#[test]
fn pitch_marks_bend_once_or_stick() {
    let pitches = |source: &str| -> Vec<f64> {
        score(source)
            .events
            .iter()
            .filter_map(|e| Some(e.target.sound.as_ref()?.f0))
            .collect()
    };
    // A parenthesized bend applies to one sound; a bare one carries forward.
    assert_eq!(pitches("AA(+40) AH"), [120.0, 160.0, 120.0]);
    assert_eq!(pitches("AA+40 AH"), [120.0, 160.0, 160.0]);
}

#[test]
fn directives_change_later_sounds() {
    let first_pitch = |source: &str| {
        score(source)
            .events
            .iter()
            .find_map(|e| Some(e.target.sound.as_ref()?.f0))
            .unwrap()
    };
    assert_eq!(first_pitch("b200 AH"), 200.0);
    assert_eq!(first_pitch("b+10 AH"), 130.0);
    assert_eq!(first_pitch("b=+10 AH"), 10.0);
    assert_eq!(first_pitch("[pitch=90] AH"), 90.0);
    assert_eq!(first_pitch("b200 b AH"), 120.0);
    assert!((first_pitch("bA4 AH") - 440.0).abs() < 1e-9);
    assert!((first_pitch("b=C#5 AH") - 554.365).abs() < 0.01);
    assert_eq!(score("r200 AA").total_ms, score("[rate=200] AA").total_ms);
    assert_eq!(score("AA p500").total_ms, score("AA").total_ms + 500.0);
}

#[test]
fn a_syllable_group_shares_one_phoneme_slot() {
    assert_eq!(score("( M AA )").total_ms, score("AA").total_ms);
    assert!(score("( M AA )").warnings.is_empty());
}

#[test]
fn problems_become_warnings() {
    let warnings = |source: &str| score(source).warnings;
    assert_eq!(warnings("QQ"), ["unknown phoneme: QQ"]);
    assert_eq!(warnings("hello"), ["unknown token: hello"]);
    assert_eq!(warnings("[nope=1]"), ["unknown directive: nope"]);
    assert_eq!(warnings(")"), ["unmatched )"]);
    assert_eq!(warnings("( ("), ["nested ( ignored", "unclosed ("]);
}

#[test]
fn comments_are_skipped_and_offsets_are_utf8_bytes() {
    let comments = "# é line\n/* é */ ";
    let score = score(&format!("{comments}AA , UW/* x */"));
    assert!(score.warnings.is_empty());
    let found: Vec<_> = score
        .segments
        .iter()
        .map(|s| (s.phoneme.as_deref(), s.src_start, s.src_end))
        .collect();
    let aa = comments.len();
    assert_eq!(
        found,
        [
            (Some("AA"), aa, aa + 2),
            (None, aa + 3, aa + 4),
            (Some("UW"), aa + 5, aa + 5 + "UW/* x */".len()),
        ]
    );
}

#[test]
fn segments_cover_sounds_and_pauses_in_order() {
    let score = score("M AA , T p100 IY");
    let codes: Vec<_> = score
        .segments
        .iter()
        .map(|s| s.phoneme.as_deref())
        .collect();
    assert_eq!(
        codes,
        [Some("M"), Some("AA"), None, Some("T"), None, Some("IY")]
    );
    for pair in score.segments.windows(2) {
        assert_eq!(pair[0].end_seconds, pair[1].start_seconds);
    }
    assert_eq!(
        score.segments.last().unwrap().end_seconds,
        score.duration_seconds()
    );
}

#[test]
fn pauses_are_quieter_than_the_vowels_around_them() {
    let score = compile_score(
        "AA p600 AA",
        &ScoreOptions {
            rate: 400.0,
            ..ScoreOptions::default()
        },
    );
    let [first, pause, second, ..] = score.segments.as_slice() else {
        panic!("expected three segments");
    };
    for audio in voices(&score) {
        let sound = rms(window(&audio, first.start_seconds + 0.1, first.end_seconds));
        let later = rms(window(
            &audio,
            second.start_seconds + 0.1,
            second.end_seconds - 0.2,
        ));
        // Leave the voice's and the horn's release at the start of the pause.
        let quiet = rms(window(&audio, pause.start_seconds + 0.3, pause.end_seconds));
        assert!(quiet < sound * 0.1, "{quiet} vs {sound}");
        assert!(quiet < later * 0.1, "{quiet} vs {later}");
    }
}

#[test]
fn trombone_color_keeps_consonants_and_changes_vowels() {
    let score = compile_score(
        "SH AA",
        &ScoreOptions {
            rate: 300.0,
            ..ScoreOptions::default()
        },
    );
    let [sh, aa] = score.segments.as_slice() else {
        panic!("expected two segments");
    };
    let dry = render_formant(&score, SAMPLE_RATE, 0.0);
    for color in [0.75, 1.0] {
        let brass = render_formant(&score, SAMPLE_RATE, color);
        assert_eq!(brass.len(), dry.len());
        let consonant = |audio| rms(window(audio, sh.start_seconds + 0.1, sh.end_seconds - 0.1));
        assert!((consonant(&brass) / consonant(&dry) - 1.0).abs() < 0.05);
        let vowel = |audio| window(audio, aa.start_seconds + 0.1, aa.start_seconds + 0.25);
        assert_ne!(vowel(&brass), vowel(&dry));
        assert!((fundamental(vowel(&brass)) - 120.0).abs() < 5.0);
    }
}

#[test]
fn the_trombone_plunger_and_transpose_respond() {
    let score = compile_score(
        "AA",
        &ScoreOptions {
            rate: 600.0,
            ..ScoreOptions::default()
        },
    );
    let render = |options: &TromboneOptions| render_trombone(&score, SAMPLE_RATE, options);
    let pitch = fundamental(window(
        &render(&TromboneOptions {
            transpose: 0.0,
            ..TromboneOptions::default()
        }),
        0.2,
        0.5,
    ));
    let low = fundamental(window(&render(&TromboneOptions::default()), 0.2, 0.5));
    assert!((pitch - 120.0).abs() < 6.0);
    assert!((low - 120.0 * 2f64.powf(-5.0 / 12.0)).abs() < 5.0);

    let closed = render(&TromboneOptions {
        wah: 0.0,
        ..TromboneOptions::default()
    });
    assert_ne!(closed, render(&TromboneOptions::default()));
}
