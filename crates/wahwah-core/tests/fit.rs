use wahwah_core::{
    ScoreOptions, Voice, compile_score,
    fit::{
        CutAt, CutFade, FadeCurve, FitOptions, MAX_SPEEDUP, SpeedProfile, SpeedUp, Volume,
        pause_separated_words,
    },
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
    let within = render_performance_within(
        &score,
        RATE,
        &voice(),
        Some(&track),
        60.0,
        FitOptions::default(),
        &[],
    );
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
    let p = render_performance_within(
        &score,
        RATE,
        &voice(),
        Some(&track),
        cap,
        FitOptions::default(),
        &[],
    );
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
    let p = render_performance_within(
        &score,
        RATE,
        &voice(),
        Some(&track),
        cap,
        FitOptions::default(),
        &[],
    );
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
    let p = render_performance_within(
        &score,
        RATE,
        &voice(),
        Some(&track),
        cap,
        FitOptions::default(),
        &[],
    );
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
        let (fitted, p) =
            render_instrument_within(&score, RATE, Some(&track), cap, FitOptions::default());
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
    let (same, p) =
        render_instrument_within(&score, RATE, Some(&track), 600.0, FitOptions::default());
    assert!(p.fit.is_none());
    assert_eq!(same.notes, score.notes);
}

fn cut_tail(fade: CutFade) -> Vec<f32> {
    let score = line(40);
    let options = FitOptions {
        cut_fade: fade,
        ..FitOptions::default()
    };
    let p = render_performance_within(&score, RATE, &voice(), None, 2.0, options, &[]);
    assert!(p.fit.expect("fitted").truncated);
    p.audio
}

#[test]
fn the_default_fade_is_80_ms_linear() {
    let audio = cut_tail(CutFade::default());
    let plain = cut_tail(CutFade {
        milliseconds: 80.0,
        curve: FadeCurve::Linear,
        ..CutFade::default()
    });
    assert_eq!(audio, plain);
}

#[test]
fn no_fade_leaves_the_cut_hard() {
    let hard = cut_tail(CutFade {
        milliseconds: 80.0,
        curve: FadeCurve::None,
        ..CutFade::default()
    });
    let zero = cut_tail(CutFade {
        milliseconds: 0.0,
        curve: FadeCurve::Smooth,
        ..CutFade::default()
    });
    assert_eq!(hard, zero);
    assert_eq!(hard.len(), (2.0 * RATE).floor() as usize);
    let faded = cut_tail(CutFade::default());
    assert_eq!(hard[..hard.len() - 2000], faded[..faded.len() - 2000]);
    assert!(
        hard.last().unwrap().abs() > 0.0 || hard[hard.len() - 50..].iter().any(|v| v.abs() > 0.0)
    );
}

#[test]
fn every_curve_ends_silent_and_a_longer_fade_starts_earlier() {
    for curve in [FadeCurve::Linear, FadeCurve::Smooth, FadeCurve::Quick] {
        let short = cut_tail(CutFade {
            milliseconds: 100.0,
            curve,
            ..CutFade::default()
        });
        let long = cut_tail(CutFade {
            milliseconds: 1000.0,
            curve,
            ..CutFade::default()
        });
        assert_eq!(*short.last().unwrap(), 0.0, "{curve:?}");
        assert_eq!(*long.last().unwrap(), 0.0, "{curve:?}");
        let hard = cut_tail(CutFade {
            milliseconds: 0.0,
            curve,
            ..CutFade::default()
        });
        let first_change = |a: &[f32]| a.iter().zip(&hard).position(|(x, y)| x != y).unwrap();
        assert!(first_change(&long) < first_change(&short), "{curve:?}");
    }
}

#[test]
fn a_fade_longer_than_the_audio_is_held_to_it() {
    let audio = cut_tail(CutFade {
        milliseconds: 5000.0,
        curve: FadeCurve::Linear,
        ..CutFade::default()
    });
    assert_eq!(audio.len(), (2.0 * RATE).floor() as usize);
    assert_eq!(*audio.last().unwrap(), 0.0);
}

#[test]
fn a_line_that_is_not_cut_is_never_faded() {
    let score = line(2);
    let fade = CutFade {
        milliseconds: 1000.0,
        curve: FadeCurve::Quick,
        ..CutFade::default()
    };
    let options = FitOptions {
        cut_fade: fade,
        ..FitOptions::default()
    };
    let a = render_performance_within(&score, RATE, &voice(), None, 60.0, options, &[]);
    let b = render_performance(&score, RATE, &voice(), None);
    assert_eq!(a.audio, b.audio);
}

fn cut_with(fade: CutFade) -> Vec<f32> {
    cut_tail(fade)
}

#[test]
fn the_end_volume_is_where_the_fade_stops() {
    let silent = cut_with(CutFade {
        milliseconds: 400.0,
        ..CutFade::default()
    });
    let held = cut_with(CutFade {
        milliseconds: 400.0,
        end_volume: 0.5,
        ..CutFade::default()
    });
    assert_eq!(*silent.last().unwrap(), 0.0);
    let n = held.len();
    let peak = |a: &[f32]| a[n - 200..].iter().fold(0.0_f32, |m, v| m.max(v.abs()));
    assert!(peak(&held) > 0.05, "a half-volume end is not silent");
    assert!(peak(&held) > peak(&silent) * 5.0);
    let full = cut_with(CutFade {
        milliseconds: 0.0,
        ..CutFade::default()
    });
    assert!(
        held.iter()
            .zip(&full)
            .all(|(h, f)| h.abs() <= f.abs() + 1e-6)
    );
}

#[test]
fn the_bend_moves_the_volume_at_the_middle_of_the_fade() {
    let at_middle = |exponent: f64| {
        let fade = CutFade {
            exponent,
            ..CutFade::default()
        };
        fade.gain(0.5)
    };
    assert_eq!(at_middle(1.0), 0.5);
    assert!(at_middle(2.0) < at_middle(1.0));
    assert!(at_middle(0.5) > at_middle(1.0));
    for curve in [
        FadeCurve::Linear,
        FadeCurve::Smooth,
        FadeCurve::Quick,
        FadeCurve::Decibel,
    ] {
        let fade = CutFade {
            curve,
            exponent: 3.0,
            end_volume: 0.2,
            ..CutFade::default()
        };
        assert!((fade.gain(0.0) - 1.0).abs() < 1e-6, "{curve:?}");
        assert!((fade.gain(1.0) - 0.2).abs() < 1e-6, "{curve:?}");
    }
}

#[test]
fn bad_fit_options_are_invalid() {
    assert!(FitOptions::default().is_valid());
    for bad in [
        FitOptions {
            cut_fade: CutFade {
                exponent: 0.0,
                ..CutFade::default()
            },
            ..FitOptions::default()
        },
        FitOptions {
            cut_fade: CutFade {
                end_volume: 1.5,
                ..CutFade::default()
            },
            ..FitOptions::default()
        },
        FitOptions {
            speed_up: SpeedUp {
                max: 0.5,
                ..SpeedUp::default()
            },
            ..FitOptions::default()
        },
        FitOptions {
            speed_up: SpeedUp {
                max: 9.0,
                ..SpeedUp::default()
            },
            ..FitOptions::default()
        },
    ] {
        assert!(!bad.is_valid());
    }
}

fn speed_options(profile: SpeedProfile, max: f64) -> FitOptions {
    FitOptions {
        speed_up: SpeedUp { profile, max },
        ..FitOptions::default()
    }
}

#[test]
fn every_speed_profile_lands_exactly_on_the_cap() {
    let score = line(6);
    let cap = score.duration_seconds() / 1.3;
    for profile in [
        SpeedProfile::RampUp,
        SpeedProfile::RampDown,
        SpeedProfile::Smooth,
    ] {
        let track = TrackOptions::default();
        let p = render_performance_within(
            &score,
            RATE,
            &voice(),
            Some(&track),
            cap,
            speed_options(profile, 2.0),
            &[],
        );
        let fit = p.fit.expect("fitted");
        assert!(!fit.truncated, "{profile:?}");
        assert!(
            fit.peak_speed > fit.speed && fit.speed > 1.0,
            "{profile:?} {fit:?}"
        );
        assert!(
            (p.timeline.duration_seconds - cap).abs() < 0.01,
            "{profile:?}"
        );
        assert!(p.audio.len() as f64 <= cap * RATE + 1.0);
        let end = p.timeline.segments.last().unwrap().end_seconds;
        assert!(end <= cap + 1e-6, "{profile:?}");
    }
}

#[test]
fn a_ramp_up_starts_slower_than_it_ends() {
    let score = line(6);
    let cap = score.duration_seconds() / 1.3;
    let constant = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        speed_options(SpeedProfile::Constant, 2.0),
        &[],
    );
    let ramp_up = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        speed_options(SpeedProfile::RampUp, 2.0),
        &[],
    );
    let first = |p: &wahwah_core::Performance| p.timeline.segments[1].end_seconds;
    // The same number of sounds, so the ramp-up's early sounds are longer than the steady ones.
    assert!(first(&ramp_up) > first(&constant));
    assert_eq!(
        constant.timeline.segments.len(),
        ramp_up.timeline.segments.len()
    );
}

#[test]
fn a_lower_top_speed_cuts_sooner() {
    let score = line(10);
    let cap = score.duration_seconds() / 1.4;
    let slow = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        speed_options(SpeedProfile::Constant, 1.2),
        &[],
    );
    let fast = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        speed_options(SpeedProfile::Constant, 2.0),
        &[],
    );
    assert!(slow.fit.unwrap().truncated);
    assert!(!fast.fit.unwrap().truncated);
    let off = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        speed_options(SpeedProfile::RampUp, 1.0),
        &[],
    );
    assert_eq!(off.fit.unwrap().peak_speed, 1.0);
    assert!(off.fit.unwrap().truncated);
}

const PHONEMES: &str = "HH EH L OW ";

fn word_options() -> FitOptions {
    FitOptions {
        cut_at: CutAt::Word,
        ..FitOptions::default()
    }
}

/// Words of four sounds each, as a Mumble script would report them.
fn four_sound_words(score: &wahwah_core::Score) -> Vec<(usize, usize)> {
    score
        .segments
        .chunks(4)
        .map(|c| (c[0].src_start, c[c.len() - 1].src_end))
        .collect()
}

#[test]
fn a_phoneme_script_word_is_a_run_of_sounds_between_pauses() {
    let src = "HH EH . OW L . AA";
    let score = compile_score(src, &ScoreOptions::default());
    let words = pause_separated_words(&score);
    let text: Vec<&str> = words.iter().map(|&(a, b)| &src[a..b]).collect();
    assert_eq!(text, ["HH EH", "OW L", "AA"]);
}

#[test]
fn a_word_cut_keeps_every_word_whole() {
    let src = PHONEMES.repeat(40);
    let score = compile_score(&src, &ScoreOptions::default());
    let words = four_sound_words(&score);
    let cap = 2.0;
    let track = TrackOptions::default();
    let p = render_performance_within(
        &score,
        RATE,
        &voice(),
        Some(&track),
        cap,
        word_options(),
        &words,
    );
    let fit = p.fit.expect("fitted");
    assert!(fit.truncated && fit.at_word);
    let cut = fit.cut_seconds.unwrap();
    assert!(cut <= cap && cut > cap - 1.0, "cut {cut}");
    let sounds = p
        .timeline
        .segments
        .iter()
        .filter(|s| s.phoneme.is_some())
        .count();
    assert!(
        sounds > 0 && sounds % 4 == 0,
        "{sounds} sounds is not a whole number of words"
    );
    assert!(
        p.timeline
            .segments
            .iter()
            .all(|s| s.end_seconds <= cut + 1e-9)
    );
    assert!(p.audio.len() as f64 <= cap * RATE);
    assert!(
        p.audio[p.audio.len() - 40..].iter().all(|v| v.abs() < 0.02),
        "the fade brings the end to silence"
    );
    assert_eq!(*p.audio.last().unwrap(), 0.0);
    assert!(p.warnings.iter().any(|w| w.contains("whole word")));
    // The kept words sound exactly like the start of the unbroken line.
    let anywhere = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        cap,
        FitOptions::default(),
        &words,
    );
    let n = ((cut - 0.08) * RATE) as usize - 200;
    assert_eq!(p.audio[..n], anywhere.audio[..n]);
}

#[test]
fn when_no_word_fits_the_cut_falls_back_to_mid_word() {
    let src = PHONEMES.repeat(40);
    let score = compile_score(&src, &ScoreOptions::default());
    let words = four_sound_words(&score);
    let p = render_performance_within(&score, RATE, &voice(), None, 0.2, word_options(), &words);
    let fit = p.fit.expect("fitted");
    assert!(fit.truncated && !fit.at_word);
    assert_eq!(fit.cut_seconds, Some(0.2));
    assert!(p.warnings.iter().any(|w| w.contains("No whole word fits")));
    assert_eq!(*p.audio.last().unwrap(), 0.0, "the fade still applies");
}

#[test]
fn a_cut_anywhere_is_still_the_default() {
    let src = PHONEMES.repeat(40);
    let score = compile_score(&src, &ScoreOptions::default());
    let words = four_sound_words(&score);
    let p = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        FitOptions::default(),
        &words,
    );
    let fit = p.fit.unwrap();
    assert!(!fit.at_word);
    assert_eq!(fit.cut_seconds, Some(2.0));
}

#[test]
fn an_instrument_word_cut_keeps_whole_words() {
    let text = "hello there my good friend ".repeat(12);
    let score = compile_instrument(
        &text,
        &InstrumentOptions::new(wahwah_core::instruments::Instrument::Kazoo),
    );
    let track = TrackOptions::default();
    let cap = 3.0;
    let (fitted, p) = render_instrument_within(&score, RATE, Some(&track), cap, word_options());
    let fit = p.fit.expect("fitted");
    assert!(fit.truncated && fit.at_word);
    let end = fitted
        .notes
        .iter()
        .map(|n| n.start_seconds + n.duration_seconds)
        .fold(0.0, f64::max);
    assert!(end <= cap + 1e-9);
    assert_eq!(fit.cut_seconds.unwrap(), end);
    let last = fitted.notes.last().unwrap();
    let word_notes = fitted
        .notes
        .iter()
        .filter(|n| n.src_start == last.src_start)
        .count();
    let original = score
        .notes
        .iter()
        .filter(|n| n.src_start == last.src_start)
        .count();
    assert_eq!(word_notes, original, "the last word keeps all its notes");
}

fn volume_options(profile: SpeedProfile, level: f64) -> FitOptions {
    FitOptions {
        volume: Volume { profile, level },
        cut_fade: CutFade {
            curve: FadeCurve::None,
            ..CutFade::default()
        },
        ..FitOptions::default()
    }
}

#[test]
fn the_default_volume_changes_nothing() {
    assert!(Volume::default().level == 1.0 && Volume::default().profile == SpeedProfile::Constant);
    let score = line(40);
    let a = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        FitOptions::default(),
        &[],
    );
    let b = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        FitOptions {
            volume: Volume::default(),
            ..FitOptions::default()
        },
        &[],
    );
    assert_eq!(a.audio, b.audio);
}

#[test]
fn a_constant_volume_level_scales_the_whole_line() {
    let score = line(40);
    let flat = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::Constant, 1.0),
        &[],
    );
    let half = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::Constant, 0.5),
        &[],
    );
    assert_eq!(flat.audio.len(), half.audio.len());
    assert!(
        flat.audio
            .iter()
            .zip(&half.audio)
            .all(|(f, h)| (f * 0.5 - h).abs() < 1e-6)
    );
    let silent = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::Constant, 0.0),
        &[],
    );
    assert!(silent.audio.iter().all(|v| *v == 0.0));
}

#[test]
fn a_ramp_moves_the_volume_between_one_and_the_level() {
    let v = Volume {
        profile: SpeedProfile::RampUp,
        level: 0.0,
    };
    assert!((v.gain(0.0) - 1.0).abs() < 1e-6 && v.gain(1.0).abs() < 1e-6);
    let down = Volume {
        profile: SpeedProfile::RampDown,
        level: 0.2,
    };
    assert!((down.gain(0.0) - 0.2).abs() < 1e-6 && (down.gain(1.0) - 1.0).abs() < 1e-6);
    let score = line(40);
    let flat = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::Constant, 1.0),
        &[],
    );
    let ramp = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::RampUp, 0.0),
        &[],
    );
    let peak =
        |a: &[f32], from: usize, to: usize| a[from..to].iter().fold(0.0_f32, |m, v| m.max(v.abs()));
    let n = flat.audio.len();
    assert!(peak(&ramp.audio, 0, n / 10) > 0.8 * peak(&flat.audio, 0, n / 10));
    assert!(peak(&ramp.audio, n * 9 / 10, n) < 0.3 * peak(&flat.audio, n * 9 / 10, n));
}

#[test]
fn a_boost_never_clips_past_full_scale() {
    let score = line(40);
    let loud = render_performance_within(
        &score,
        RATE,
        &voice(),
        None,
        2.0,
        volume_options(SpeedProfile::Constant, 2.0),
        &[],
    );
    assert!(loud.audio.iter().all(|v| v.abs() <= 1.0));
    assert!(
        !FitOptions {
            volume: Volume {
                level: 2.5,
                ..Volume::default()
            },
            ..FitOptions::default()
        }
        .is_valid()
    );
}
