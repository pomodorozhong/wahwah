//! Talking Instruments rewritten from Babble Engine's `instr` style, at the
//! revision recorded in THIRD_PARTY_NOTICES.md. Note timing is explicit, so the
//! puppet follows every note rather than inferring syllables from the audio.
mod score;
mod synth;

use crate::{
    Performance, Segment, Timeline,
    fit::{FitOptions, apply_volume, fit_instrument, settle_audio, trim_to_cap},
    mouth::{FaceControls, FaceSample, FaceTrack, TrackOptions, viseme},
};
pub use score::{InstrumentScore, Note, compile_instrument};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
pub use synth::render_notes;
pub(crate) use synth::sounding_end;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub enum Instrument {
    #[serde(rename = "muted-horn")]
    MutedHorn,
    #[serde(rename = "talking-trombone")]
    Trombone,
    #[serde(rename = "ooh-choir")]
    OohChoir,
    #[serde(rename = "kazoo")]
    Kazoo,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentPreset {
    pub id: Instrument,
    pub name: String,
    pub pitch_hz: f64,
    pub speed: f64,
    pub expression: f64,
    pub brightness: f64,
}

impl Instrument {
    pub fn preset(self) -> &'static InstrumentPreset {
        static PRESETS: OnceLock<Vec<InstrumentPreset>> = OnceLock::new();
        PRESETS
            .get_or_init(|| {
                serde_json::from_str(include_str!("../../../../data/instrument-presets.json"))
                    .expect("valid instrument presets")
            })
            .iter()
            .find(|p| p.id == self)
            .expect("every instrument has a preset")
    }
    pub(crate) fn note_seconds(self) -> f64 {
        match self {
            Self::MutedHorn | Self::Kazoo => 0.15,
            Self::Trombone => 0.17,
            Self::OohChoir => 0.22,
        }
    }
    pub(crate) fn attack_seconds(self) -> f64 {
        match self {
            Self::OohChoir => 0.09,
            Self::Kazoo => 0.02,
            _ => 0.025,
        }
    }
    pub(crate) fn release_seconds(self) -> f64 {
        if self == Self::OohChoir { 0.25 } else { 0.08 }
    }
    pub(crate) fn mouth_code(self) -> &'static str {
        if self == Self::OohChoir { "UW" } else { "AA" }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstrumentOptions {
    pub instrument: Instrument,
    pub pitch_hz: f64,
    pub speed: f64,
    pub expression: f64,
    pub brightness: f64,
    pub seed: u32,
    pub mood_id: String,
}

impl InstrumentOptions {
    pub fn new(instrument: Instrument) -> Self {
        let p = instrument.preset();
        Self {
            instrument,
            pitch_hz: p.pitch_hz,
            speed: p.speed,
            expression: p.expression,
            brightness: p.brightness,
            seed: 1,
            mood_id: "neutral".into(),
        }
    }
}

fn timeline(score: &InstrumentScore) -> Timeline {
    let mut segments = Vec::new();
    let mut previous = 0.0;
    for note in &score.notes {
        if note.start_seconds > previous {
            segments.push(Segment {
                phoneme: None,
                start_seconds: previous,
                end_seconds: note.start_seconds,
                src_start: note.src_start,
                src_end: note.src_start,
            });
        }
        let end = note.start_seconds + note.duration_seconds;
        segments.push(Segment {
            phoneme: Some(score.instrument.mouth_code().into()),
            start_seconds: note.start_seconds,
            end_seconds: end,
            src_start: note.src_start,
            src_end: note.src_end,
        });
        previous = end;
    }
    if previous < score.duration_seconds {
        segments.push(Segment {
            phoneme: None,
            start_seconds: previous,
            end_seconds: score.duration_seconds,
            src_start: score.source_len,
            src_end: score.source_len,
        });
    }
    Timeline {
        duration_seconds: score.duration_seconds,
        segments,
    }
}

fn note_track(score: &InstrumentScore, options: &TrackOptions) -> FaceTrack {
    let rate = if options.sample_rate_hz.is_finite() && options.sample_rate_hz > 0.0 {
        options.sample_rate_hz.min(1000.0)
    } else {
        100.0
    };
    let anticipation = if options.anticipation_seconds.is_finite() {
        options.anticipation_seconds.max(0.0)
    } else {
        0.02
    };
    let count = ((score.duration_seconds * rate).ceil() as usize + 1).max(2);
    let mut samples = Vec::with_capacity(count);
    let mut index = 0;
    let smooth = |t: f64| {
        let t = t.clamp(0.0, 1.0);
        t * t * (3.0 - 2.0 * t)
    };
    let pose = viseme(score.instrument.mouth_code()).pose;
    for i in 0..count {
        let time = (i as f64 / rate).min(score.duration_seconds);
        let mouth_time = time + anticipation;
        while index < score.notes.len()
            && score.notes[index].start_seconds + score.notes[index].duration_seconds <= mouth_time
        {
            index += 1;
        }
        let active = score
            .notes
            .get(index)
            .filter(|n| mouth_time >= n.start_seconds);
        let strength = active.map_or(0.0, |n| {
            let elapsed = mouth_time - n.start_seconds;
            // Each onset articulates separately, even inside a multi-note word.
            // The release closes before the next attack; audio tails may overlap.
            smooth(elapsed / score.instrument.attack_seconds())
                * smooth((n.duration_seconds - elapsed) / (n.duration_seconds * 0.28).max(0.02))
        });
        let controls = if i == 0 || i == count - 1 {
            FaceControls::default()
        } else {
            FaceControls {
                jaw_open: pose.jaw_open * strength,
                lip_width: pose.lip_width * strength,
                lip_round: pose.lip_round * strength,
            }
        };
        samples.push(FaceSample {
            time_seconds: time,
            phoneme: active.map(|_| score.instrument.mouth_code().into()),
            controls,
        });
    }
    FaceTrack {
        sample_rate_hz: rate,
        duration_seconds: score.duration_seconds,
        samples,
    }
}

pub fn render_instrument(
    score: &InstrumentScore,
    sample_rate: f64,
    track: Option<&TrackOptions>,
) -> Performance {
    Performance {
        audio: render_notes(score, sample_rate),
        timeline: timeline(score),
        warnings: Vec::new(),
        track: track.map(|o| note_track(score, o)),
        fit: None,
    }
}

/// Fit the notes within a maximum duration, then render them. A line that already
/// fits is not fitted, but `fit_options.volume` still shapes its volume. Returns the notes
/// that were actually rendered, which differ from `score` when the line was fitted.
pub fn render_instrument_within(
    score: &InstrumentScore,
    sample_rate: f64,
    track: Option<&TrackOptions>,
    max_seconds: f64,
    fit_options: FitOptions,
) -> (InstrumentScore, Performance) {
    let Some((fitted, fit)) = fit_instrument(score, max_seconds, &fit_options) else {
        let mut performance = render_instrument(score, sample_rate, track);
        trim_to_cap(&mut performance.audio, sample_rate, max_seconds);
        apply_volume(&mut performance.audio, &fit_options.volume);
        return (score.clone(), performance);
    };
    let mut performance = render_instrument(&fitted, sample_rate, track);
    settle_audio(
        &mut performance.audio,
        sample_rate,
        max_seconds,
        &fit,
        &fit_options,
    );
    performance.fit = Some(fit);
    (fitted, performance)
}
