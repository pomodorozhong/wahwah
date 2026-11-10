use wahwah_core::{
    ScoreOptions, Voice, compile_score,
    fit::MAX_SPEEDUP,
    instruments::{InstrumentOptions, compile_instrument, render_instrument_within},
    mouth::TrackOptions,
    render_performance, render_performance_within,
};

const RATE: f64 = 24000.0;

fn line(words: usize) -> wahwah_core::Score {
    compile_score(&"HH EH L OW ".repeat(words), &ScoreOptions::default())
}
fn voice() -> Voice {
    Voice::Formant { brass_color: 0.0 }
}

#[test]
fn a_line_that_fits_is_unchanged() {
    let score = line(3);
    let track = TrackOptions::default();
    let plain = render_performance(&score, RATE, &voice(), Some(&track));
    let within = render_performance_within(&score, RATE, &voice(), Some(&track), 60.0);
    assert_eq!(plain.audio, within.audio);
    assert_eq!(plain.timeline.segments, within.timeline.segments);
    assert!(within.fit.is_none());
}

#[test]
fn a_slightly_long_line_speeds_up_to_exactly_the_cap() {
    let score = line(6);
    let natural = score.duration_seconds();
    let cap = natural / 1.3;
    let track = TrackOptions::default();
    let p = render_performance_within(&score, RATE, &voice(), Some(&track), cap);
    let fit = p.fit.expect("fitted");
    assert!(!fit.truncated);
    assert!((fit.speed - 1.3).abs() < 1e-9);
    assert!((p.timeline.duration_seconds - cap).abs() < 1e-9);
    assert!(p.audio.len() as f64 <= cap * RATE);
    assert!(
        p.audio.len() as f64 > cap * RATE - 2.0,
        "audio fills the cap to the sample"
    );
    assert!(p.warnings.len() == score.warnings.len());
    // Every segment keeps its proportional place.
    for (a, b) in score.segments.iter().zip(&p.timeline.segments) {
        assert!((b.start_seconds - a.start_seconds / 1.3).abs() < 1e-9);
        assert_eq!(a.phoneme, b.phoneme);
    }
}

#[test]
fn a_very_long_line_is_sped_up_then_cut_with_a_fade() {
    let score = line(40);
    let cap = 2.0;
    assert!(score.duration_seconds() / MAX_SPEEDUP > cap);
    let track = TrackOptions::default();
    let p = render_performance_within(&score, RATE, &voice(), Some(&track), cap);
    let fit = p.fit.expect("fitted");
    assert!(fit.truncated);
    assert_eq!(fit.speed, MAX_SPEEDUP);
    assert!(p.audio.len() as f64 <= cap * RATE);
    assert_eq!(p.audio.len(), (cap * RATE).floor() as usize);
    assert_eq!(*p.audio.last().unwrap(), 0.0);
    assert!(
        p.audio[..p.audio.len() - 3000]
            .iter()
            .any(|v| v.abs() > 0.01)
    );
    assert!(p.timeline.duration_seconds <= cap);
    assert!(
        p.timeline
            .segments
            .iter()
            .all(|s| s.end_seconds <= cap && s.start_seconds < cap)
    );
    let track = p.track.expect("track");
    assert!((track.duration_seconds - p.timeline.duration_seconds).abs() < 1e-9);
    assert!(track.samples.last().unwrap().time_seconds <= cap);
    let end = track.samples.last().unwrap().controls;
    assert_eq!(
        (end.jaw_open, end.lip_width, end.lip_round),
        (0.0, 0.0, 0.0)
    );
    assert!(p.warnings.iter().any(|w| w.starts_with("Cut at")));
}

#[test]
fn the_mouth_follows_the_fitted_timeline_and_ends_neutral() {
    let score = line(10);
    let cap = score.duration_seconds() / 1.5;
    let track = TrackOptions::default();
    let p = render_performance_within(&score, RATE, &voice(), Some(&track), cap);
    let segments = &p.timeline.segments;
    let end = segments.last().expect("segments").end_seconds;
    let track = p.track.expect("track");
    assert!((end - cap).abs() < 1e-9);
    assert!((track.duration_seconds - end).abs() < 1e-9);
    assert!(track.samples.iter().all(|s| s.time_seconds <= cap + 1e-9));
    assert!(
        track
            .samples
            .windows(2)
            .all(|w| w[0].time_seconds <= w[1].time_seconds)
    );
    // The mouth opens during the first vowel, at its fitted time, not its natural one.
    let vowel = segments
        .iter()
        .find(|s| s.phoneme.as_deref() == Some("EH"))
        .expect("a vowel");
    let middle = (vowel.start_seconds + vowel.end_seconds) / 2.0;
    let open = track
        .samples
        .iter()
        .min_by(|a, b| {
            (a.time_seconds - middle)
                .abs()
                .total_cmp(&(b.time_seconds - middle).abs())
        })
        .unwrap();
    assert!(open.controls.jaw_open > 0.1, "{open:?}");
    let last = track.samples.last().unwrap().controls;
    assert_eq!(
        (last.jaw_open, last.lip_width, last.lip_round),
        (0.0, 0.0, 0.0)
    );
}

#[test]
fn talking_instruments_fit_the_same_way() {
    let options = InstrumentOptions::new(wahwah_core::instruments::Instrument::Kazoo);
    let text = "one two three four five six seven eight nine ten eleven twelve ".repeat(3);
    let score = compile_instrument(&text, &options);
    let track = TrackOptions::default();
    for cap in [score.duration_seconds / 1.2, 1.5] {
        let (fitted, p) = render_instrument_within(&score, RATE, Some(&track), cap);
        assert!(p.fit.is_some());
        assert!(p.audio.len() as f64 <= cap * RATE);
        assert!(p.timeline.duration_seconds <= cap + 1e-9);
        assert!(
            fitted
                .notes
                .iter()
                .all(|n| n.start_seconds + n.duration_seconds <= cap + 1e-9)
        );
        assert!(p.track.unwrap().duration_seconds <= cap + 1e-9);
    }
    let (same, p) = render_instrument_within(&score, RATE, Some(&track), 600.0);
    assert!(p.fit.is_none());
    assert_eq!(same.notes, score.notes);
}
