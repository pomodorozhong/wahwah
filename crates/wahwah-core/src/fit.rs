//! Fit a performance within a maximum duration.
//!
//! A line that is too long is first sped up, up to `MAX_SPEEDUP`, by scaling
//! every time on its score. Audio, timeline and mouth movement are all made from
//! the fitted score, so they cannot drift apart. Pitch is not changed. A line that
//! is still too long is cut at the cap with a short fade. Shorter lines are left
//! exactly as they were. The cap includes the synthesis tail: the audio is never
//! longer than `floor(cap * sample_rate)` samples.

use crate::{Score, instruments::InstrumentScore};
use serde::Serialize;

/// The fastest a line is sped up before the rest is cut.
pub const MAX_SPEEDUP: f64 = 1.6;
/// The fade into the cut, in milliseconds.
pub const CUT_FADE_MS: f64 = 80.0;
pub const MIN_CAP_SECONDS: f64 = 0.1;
pub const MAX_CAP_SECONDS: f64 = 600.0;

/// What fitting did, so a host can tell the caller.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fit {
    /// The duration the line would have had without a cap.
    pub natural_seconds: f64,
    /// 1 when the line was not sped up.
    pub speed: f64,
    pub truncated: bool,
}

pub fn valid_cap(seconds: f64) -> bool {
    seconds.is_finite() && (MIN_CAP_SECONDS..=MAX_CAP_SECONDS).contains(&seconds)
}

/// Speed and whether to cut. `None` when the line already fits.
fn plan(natural: f64, cap: f64) -> Option<(f64, Fit)> {
    if natural <= cap {
        return None;
    }
    let needed = natural / cap;
    let speed = needed.min(MAX_SPEEDUP);
    Some((
        speed,
        Fit {
            natural_seconds: natural,
            speed,
            truncated: needed > MAX_SPEEDUP,
        },
    ))
}

pub fn fit_score(score: &Score, cap_seconds: f64) -> Option<(Score, Fit)> {
    let (speed, fit) = plan(score.duration_seconds(), cap_seconds)?;
    let k = 1.0 / speed;
    let cap_ms = cap_seconds * 1000.0;
    let mut fitted = score.clone();
    for event in &mut fitted.events {
        event.at_ms *= k;
        event.transition_ms *= k;
    }
    fitted.events.retain(|e| e.at_ms < cap_ms || !fit.truncated);
    fitted.total_ms = (score.total_ms * k).min(cap_ms);
    for segment in &mut fitted.segments {
        segment.start_seconds *= k;
        segment.end_seconds *= k;
    }
    fitted
        .segments
        .retain(|s| s.start_seconds < cap_seconds || !fit.truncated);
    for segment in &mut fitted.segments {
        segment.end_seconds = segment.end_seconds.min(cap_seconds);
    }
    if fit.truncated {
        fitted.warnings.push(format!(
            "Cut at {cap_seconds} s: the line would take {:.2} s even sped up {MAX_SPEEDUP}×",
            score.duration_seconds() * k
        ));
    }
    Some((fitted, fit))
}

pub fn fit_instrument(score: &InstrumentScore, cap_seconds: f64) -> Option<(InstrumentScore, Fit)> {
    let (speed, fit) = plan(score.duration_seconds, cap_seconds)?;
    let k = 1.0 / speed;
    let mut fitted = score.clone();
    for note in &mut fitted.notes {
        note.start_seconds *= k;
        note.duration_seconds *= k;
    }
    if fit.truncated {
        fitted.notes.retain(|n| n.start_seconds < cap_seconds);
        for note in &mut fitted.notes {
            note.duration_seconds = note.duration_seconds.min(cap_seconds - note.start_seconds);
        }
    }
    fitted.duration_seconds = (score.duration_seconds * k).min(cap_seconds);
    Some((fitted, fit))
}

/// Make rendered audio obey the cap to the sample, and fade a cut.
pub fn settle_audio(audio: &mut Vec<f32>, sample_rate: f64, cap_seconds: f64, fit: &Fit) {
    audio.truncate((cap_seconds * sample_rate).floor() as usize);
    if fit.truncated {
        let fade = ((CUT_FADE_MS / 1000.0 * sample_rate) as usize).clamp(1, audio.len().max(1));
        let start = audio.len() - fade.min(audio.len());
        let tail = audio.len() - start;
        for (i, sample) in audio[start..].iter_mut().enumerate() {
            *sample *= 1.0 - (i + 1) as f32 / tail as f32;
        }
    }
}
