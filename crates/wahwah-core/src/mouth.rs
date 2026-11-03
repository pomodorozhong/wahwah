//! Renderer-independent mouth poses and a sampled performance track.
//! The JSON is embedded in Rust and imported directly by TypeScript, including
//! the audio worklet. Live analysis never needs WASM to read a mouth pose.

use crate::Segment;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::OnceLock};

#[derive(Clone, Copy, Debug, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FaceControls {
    pub jaw_open: f64,
    pub lip_width: f64,
    pub lip_round: f64,
}

impl FaceControls {
    fn lerp(self, other: Self, t: f64) -> Self {
        Self {
            jaw_open: self.jaw_open + (other.jaw_open - self.jaw_open) * t,
            lip_width: self.lip_width + (other.lip_width - self.lip_width) * t,
            lip_round: self.lip_round + (other.lip_round - self.lip_round) * t,
        }
    }

    fn normalized(self) -> Self {
        let lip_round = self.lip_round.clamp(0.0, 1.0);
        Self {
            jaw_open: self.jaw_open.clamp(0.0, 1.0),
            lip_width: self.lip_width.clamp(0.0, 1.0).min(1.0 - lip_round),
            lip_round,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Viseme {
    pub pose: FaceControls,
    pub glide_to: Option<FaceControls>,
    pub dominance: f64,
}

#[derive(Deserialize)]
struct MouthPoses {
    visemes: BTreeMap<String, Viseme>,
    unknown: Viseme,
}

pub fn viseme(code: &str) -> &'static Viseme {
    static POSES: OnceLock<MouthPoses> = OnceLock::new();
    let poses = POSES.get_or_init(|| {
        serde_json::from_str(include_str!("../../../data/mouth-poses.json"))
            .expect("checked-in mouth poses are valid")
    });
    poses.visemes.get(code).unwrap_or(&poses.unknown)
}

#[derive(Clone, Copy, Debug)]
pub struct TrackOptions {
    pub sample_rate_hz: f64,
    pub anticipation_seconds: f64,
    pub rest_seconds: f64,
}

impl Default for TrackOptions {
    fn default() -> Self {
        Self {
            sample_rate_hz: 100.0,
            anticipation_seconds: 0.02,
            rest_seconds: 0.06,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FaceSample {
    pub time_seconds: f64,
    pub phoneme: Option<String>,
    #[serde(flatten)]
    pub controls: FaceControls,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FaceTrack {
    pub sample_rate_hz: f64,
    pub duration_seconds: f64,
    pub samples: Vec<FaceSample>,
}

#[derive(Clone, Copy)]
struct Keyframe {
    time: f64,
    pose: FaceControls,
    dominance: f64,
}

impl Keyframe {
    fn neutral(time: f64) -> Self {
        Self {
            time,
            pose: FaceControls::default(),
            dominance: 1.0,
        }
    }
}

/// Generate mouth movement from the same timeline as the audio. Vowels and
/// bilabials hold their pose; weak tongue consonants borrow neighbouring poses.
/// Invalid track options fall back to defaults rather than creating NaNs.
pub fn generate_face_track(
    segments: &[Segment],
    duration: f64,
    options: &TrackOptions,
) -> FaceTrack {
    let defaults = TrackOptions::default();
    let positive = |v: f64, fallback| {
        if v.is_finite() && v > 0.0 {
            v
        } else {
            fallback
        }
    };
    let rate = positive(options.sample_rate_hz, defaults.sample_rate_hz).min(1000.0);
    let rest = positive(options.rest_seconds, defaults.rest_seconds);
    let anticipation = if options.anticipation_seconds.is_finite() {
        options.anticipation_seconds.max(0.0)
    } else {
        defaults.anticipation_seconds
    };
    let mut keys = vec![Keyframe::neutral(0.0)];
    for segment in segments {
        let length = segment.end_seconds - segment.start_seconds;
        match segment.phoneme.as_deref() {
            None if length > rest * 2.0 => {
                keys.push(Keyframe::neutral(segment.start_seconds + rest));
                keys.push(Keyframe::neutral(segment.end_seconds - rest));
            }
            None => (),
            Some(code) => {
                let v = viseme(code);
                let key = |fraction, pose| Keyframe {
                    time: segment.start_seconds + length * fraction - anticipation,
                    pose,
                    dominance: v.dominance,
                };
                if let Some(glide) = v.glide_to {
                    keys.push(key(0.3, v.pose));
                    keys.push(key(0.8, glide));
                } else {
                    keys.push(key(0.5, v.pose));
                }
            }
        }
    }
    keys.push(Keyframe::neutral(duration));
    // Read the original neighbours so blending does not depend on traversal order.
    let mut blended = keys.clone();
    for i in 1..keys.len() - 1 {
        if keys[i].dominance < 1.0 {
            let context = keys[i - 1].pose.lerp(keys[i + 1].pose, 0.5);
            blended[i].pose = context.lerp(keys[i].pose, keys[i].dominance);
        }
    }
    for i in 1..blended.len() {
        blended[i].time = blended[i].time.max(blended[i - 1].time).min(duration);
    }
    let count = ((duration * rate).ceil() as usize + 1).max(2);
    let mut samples = Vec::with_capacity(count);
    let (mut key, mut segment) = (1, 0);
    for i in 0..count {
        let time = (i as f64 / rate).min(duration);
        while key < blended.len() - 1 && time > blended[key].time {
            key += 1;
        }
        let (a, b) = (blended[key - 1], blended[key]);
        let span = b.time - a.time;
        let t = if span > 0.0 {
            ((time - a.time) / span).clamp(0.0, 1.0)
        } else {
            1.0
        };
        let controls = if i == 0 || i == count - 1 {
            FaceControls::default()
        } else {
            a.pose.lerp(b.pose, t * t * (3.0 - 2.0 * t)).normalized()
        };
        while segment < segments.len() && segments[segment].end_seconds <= time {
            segment += 1;
        }
        let phoneme = segments
            .get(segment)
            .filter(|s| time >= s.start_seconds)
            .and_then(|s| s.phoneme.clone());
        samples.push(FaceSample {
            time_seconds: time,
            phoneme,
            controls,
        });
    }
    FaceTrack {
        sample_rate_hz: rate,
        duration_seconds: duration,
        samples,
    }
}
