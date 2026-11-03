//! One score supplies the audio, timeline, and optional mouth movement.
use crate::{
    Score, Segment, TromboneOptions,
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
    }
}
