//! One score supplies the audio, timeline, and optional mouth movement.
use crate::{
    Score, Segment, TromboneOptions,
    fit::{Fit, fit_score, settle_audio},
    mouth::{FaceTrack, TrackOptions, generate_face_track},
    render_formant, render_trombone,
};
use serde::Serialize;

pub enum Voice {
    Formant { brass_color: f64 },
    Trombone(TromboneOptions),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub duration_seconds: f64,
    pub segments: Vec<Segment>,
}

#[derive(Serialize)]
pub struct Performance {
    #[serde(skip)]
    pub audio: Vec<f32>,
    pub timeline: Timeline,
    pub warnings: Vec<String>,
    pub track: Option<FaceTrack>,
    /// Set when a maximum duration shortened the line.
    pub fit: Option<Fit>,
}

/// The puppet can be disabled without running the track generator.
pub fn render_performance(
    score: &Score,
    sample_rate: f64,
    voice: &Voice,
    track: Option<&TrackOptions>,
) -> Performance {
    Performance {
        audio: match voice {
            Voice::Formant { brass_color } => render_formant(score, sample_rate, *brass_color),
            Voice::Trombone(options) => render_trombone(score, sample_rate, options),
        },
        timeline: Timeline {
            duration_seconds: score.duration_seconds(),
            segments: score.segments.clone(),
        },
        warnings: score.warnings.clone(),
        track: track
            .map(|options| generate_face_track(&score.segments, score.duration_seconds(), options)),
        fit: None,
    }
}

/// Render within a maximum duration. A line that already fits renders exactly
/// as `render_performance` would; a longer one is fitted first, so audio, timeline
/// and mouth movement come from the same fitted score.
pub fn render_performance_within(
    score: &Score,
    sample_rate: f64,
    voice: &Voice,
    track: Option<&TrackOptions>,
    max_seconds: f64,
) -> Performance {
    let Some((fitted, fit)) = fit_score(score, max_seconds) else {
        return render_performance(score, sample_rate, voice, track);
    };
    let mut performance = render_performance(&fitted, sample_rate, voice, track);
    settle_audio(&mut performance.audio, sample_rate, max_seconds, &fit);
    performance.fit = Some(fit);
    performance
}
