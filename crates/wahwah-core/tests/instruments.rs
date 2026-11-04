use wahwah_core::{
    instruments::{Instrument, InstrumentOptions, compile_instrument, render_instrument},
    mouth::{FaceControls, TrackOptions},
};

const KINDS: [Instrument; 4] = [
    Instrument::MutedHorn,
    Instrument::Trombone,
    Instrument::OohChoir,
    Instrument::Kazoo,
];
const SR: f64 = 24000.0;

#[test]
fn every_instrument_is_audible_finite_and_matches_its_timeline() {
    for kind in KINDS {
        let score = compile_instrument("Hello there!", &InstrumentOptions::new(kind));
        for sr in [8000.0, 24000.0, 44100.0, 48000.0] {
            let p = render_instrument(&score, sr, Some(&TrackOptions::default()));
            assert_eq!(p.audio.len(), (score.duration_seconds * sr).ceil() as usize);
            assert!(p.audio.iter().all(|v| v.is_finite() && v.abs() <= 1.0));
            let rms = (p.audio.iter().map(|v| f64::from(*v).powi(2)).sum::<f64>()
                / p.audio.len() as f64)
                .sqrt();
            assert!(rms > 0.01, "{kind:?} {sr}: {rms}");
            let track = p.track.unwrap();
            assert_eq!(track.duration_seconds, p.timeline.duration_seconds);
            assert_eq!(
                track.samples.last().unwrap().time_seconds,
                score.duration_seconds
            );
            let sounds: Vec<_> = p
                .timeline
                .segments
                .iter()
                .filter(|s| s.phoneme.is_some())
                .collect();
            assert_eq!(sounds.len(), score.notes.len());
            for (segment, note) in sounds.iter().zip(&score.notes) {
                assert_eq!(segment.start_seconds, note.start_seconds);
                assert_eq!(
                    segment.end_seconds,
                    note.start_seconds + note.duration_seconds
                );
            }
        }
    }
}

#[test]
fn rendering_is_repeatable_and_seed_changes_the_score() {
    for kind in KINDS {
        let mut options = InstrumentOptions::new(kind);
        let a = compile_instrument("Hello there?", &options);
        let b = compile_instrument("Hello there?", &options);
        assert_eq!(a.notes, b.notes);
        let a = render_instrument(&a, SR, Some(&TrackOptions::default()));
        let b = render_instrument(&b, SR, Some(&TrackOptions::default()));
        assert_eq!(a.audio, b.audio);
        assert_eq!(a.track, b.track);
        options.seed += 1;
        let c = compile_instrument("Hello there?", &options);
        assert_ne!(b.timeline.segments.len(), 0);
        assert_ne!(
            compile_instrument("Hello there?", &InstrumentOptions::new(kind)).notes,
            c.notes
        );
    }
}

#[test]
fn every_note_in_a_long_word_has_its_own_mouth_movement() {
    for kind in KINDS {
        let score = compile_instrument("information", &InstrumentOptions::new(kind));
        assert_eq!(score.notes.len(), 4);
        let p = render_instrument(
            &score,
            SR,
            Some(&TrackOptions {
                anticipation_seconds: 0.0,
                ..Default::default()
            }),
        );
        let track = p.track.unwrap();
        let magnitude = |time: f64| {
            let s = &track.samples[(time * track.sample_rate_hz).round() as usize];
            s.controls.jaw_open + s.controls.lip_width + s.controls.lip_round
        };
        for note in &score.notes {
            let onset = magnitude(note.start_seconds + 0.005);
            let middle = magnitude(note.start_seconds + note.duration_seconds * 0.5);
            let end = magnitude(note.start_seconds + note.duration_seconds - 0.005);
            assert!(
                middle > onset + 0.1,
                "{kind:?}: onset {onset}, middle {middle}"
            );
            assert!(middle > end + 0.1, "{kind:?}: middle {middle}, end {end}");
        }
    }
}

#[test]
fn pauses_and_edges_return_to_neutral_and_controls_stay_bounded() {
    for kind in KINDS {
        let score = compile_instrument("hello. hello", &InstrumentOptions::new(kind));
        let track = render_instrument(&score, SR, Some(&TrackOptions::default()))
            .track
            .unwrap();
        assert_eq!(
            track.samples.first().unwrap().controls,
            FaceControls::default()
        );
        assert_eq!(
            track.samples.last().unwrap().controls,
            FaceControls::default()
        );
        let first_word = &score.notes[1];
        let pause = first_word.start_seconds + first_word.duration_seconds + 0.15;
        assert_eq!(
            track.samples[(pause * track.sample_rate_hz).round() as usize].controls,
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
    }
}

#[test]
fn choir_quantizes_notes_while_brass_and_kazoo_glide() {
    for kind in KINDS {
        let options = InstrumentOptions::new(kind);
        let score = compile_instrument("Are you there? You are there.", &options);
        if kind == Instrument::OohChoir {
            for note in &score.notes {
                let semi = 12.0 * (note.start_hz / options.pitch_hz).log2();
                let pitch_class = semi.round().rem_euclid(12.0);
                assert!((semi - semi.round()).abs() < 1e-9);
                assert!([0.0, 2.0, 4.0, 7.0, 9.0].contains(&pitch_class));
                assert_eq!(note.start_hz, note.end_hz);
            }
        } else {
            assert!(
                score
                    .notes
                    .iter()
                    .any(|n| (n.start_hz - n.end_hz).abs() > 1.0)
            );
            let question = compile_instrument("there?", &options);
            let statement = compile_instrument("there.", &options);
            let q = question.notes.last().unwrap();
            let s = statement.notes.last().unwrap();
            assert!(q.end_hz > q.start_hz);
            assert!(s.end_hz < s.start_hz);
        }
    }
}

#[test]
fn pitch_speed_mood_expression_and_brightness_respond() {
    for kind in KINDS {
        let options = InstrumentOptions::new(kind);
        let base = compile_instrument("Hello there.", &options);
        let higher = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                pitch_hz: options.pitch_hz * 2.0,
                ..options.clone()
            },
        );
        assert!((higher.notes[0].start_hz / base.notes[0].start_hz - 2.0).abs() < 1e-9);
        let faster = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                speed: options.speed * 2.0,
                ..options.clone()
            },
        );
        assert!(faster.duration_seconds < base.duration_seconds);
        assert!(
            (faster.notes[0].duration_seconds / base.notes[0].duration_seconds - 0.5).abs() < 1e-9
        );
        let happy = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                mood_id: "happy".into(),
                ..options.clone()
            },
        );
        let sad = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                mood_id: "sad".into(),
                ..options.clone()
            },
        );
        assert!(happy.duration_seconds < sad.duration_seconds);
        assert!(happy.notes[0].start_hz > sad.notes[0].start_hz);
        let flat = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                expression: 0.0,
                ..options.clone()
            },
        );
        assert_ne!(flat.notes, base.notes);
        let dark = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                brightness: 0.0,
                ..options.clone()
            },
        );
        let bright = compile_instrument(
            "Hello there.",
            &InstrumentOptions {
                brightness: 1.0,
                ..options
            },
        );
        assert_ne!(
            render_instrument(&dark, SR, None).audio,
            render_instrument(&bright, SR, None).audio
        );
    }
}

#[test]
fn instruments_keep_distinct_timbres_at_the_same_pitch_and_speed() {
    let sounds: Vec<_> = KINDS
        .iter()
        .map(|kind| {
            let options = InstrumentOptions {
                pitch_hz: 200.0,
                speed: 1.0,
                ..InstrumentOptions::new(*kind)
            };
            render_instrument(&compile_instrument("Hi", &options), SR, None).audio
        })
        .collect();
    for i in 0..sounds.len() {
        for j in i + 1..sounds.len() {
            let n = sounds[i].len().min(sounds[j].len());
            let difference = (sounds[i][..n]
                .iter()
                .zip(&sounds[j])
                .map(|(a, b)| f64::from(a - b).powi(2))
                .sum::<f64>()
                / n as f64)
                .sqrt();
            assert!(difference > 0.02, "{i} / {j}: {difference}");
        }
    }
}

#[test]
fn puppet_off_preserves_audio_and_empty_input_is_silent() {
    for kind in KINDS {
        let options = InstrumentOptions::new(kind);
        let score = compile_instrument("Hi!", &options);
        let on = render_instrument(&score, SR, Some(&TrackOptions::default()));
        let off = render_instrument(&score, SR, None);
        assert!(off.track.is_none());
        assert_eq!(on.audio, off.audio);
        for text in ["", "  ", "?!…"] {
            let score = compile_instrument(text, &options);
            assert!(score.notes.is_empty());
            let p = render_instrument(&score, SR, Some(&TrackOptions::default()));
            assert!(p.audio.iter().all(|v| *v == 0.0));
            assert!(
                p.track
                    .unwrap()
                    .samples
                    .iter()
                    .all(|s| s.controls == FaceControls::default())
            );
        }
    }
}

#[test]
fn note_ranges_are_original_input_bytes() {
    let text = "🧊 It’s fine — hello!";
    let score = compile_instrument(text, &InstrumentOptions::new(Instrument::MutedHorn));
    assert_eq!(score.notes[0].src_start, 5);
    for note in &score.notes {
        assert!(["It’s", "fine", "hello"].contains(&&text[note.src_start..note.src_end]));
    }
}
