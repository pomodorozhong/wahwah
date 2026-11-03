//! The browser boundary. Calls are stateless, so JavaScript never owns a Rust
//! object it would have to free.

use serde::{Deserialize, Serialize};
use wahwah_core::{Score, ScoreOptions, TromboneOptions, compile_score};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VoiceSettings {
    pitch_hz: f64,
    ms_per_phoneme: f64,
    formant_scale: f64,
    vibrato_depth: Option<f64>,
    aspiration: Option<f64>,
    effort: Option<f64>,
    tilt: Option<f64>,
}

#[derive(Deserialize)]
struct TromboneSettings {
    brightness: f64,
    wah: f64,
    transpose: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Segment<'a> {
    phoneme: Option<&'a str>,
    start_seconds: f64,
    end_seconds: f64,
    src_start: usize,
    src_end: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Timeline<'a> {
    duration_seconds: f64,
    segments: Vec<Segment<'a>>,
    warnings: &'a [String],
}

fn score(source: &str, settings: JsValue) -> Result<Score, JsError> {
    let settings: VoiceSettings = serde_wasm_bindgen::from_value(settings)?;
    let defaults = ScoreOptions::default();
    Ok(compile_score(
        source,
        &ScoreOptions {
            base_f0: settings.pitch_hz,
            rate: settings.ms_per_phoneme,
            scale: settings.formant_scale,
            vibrato_depth: settings.vibrato_depth.unwrap_or(defaults.vibrato_depth),
            aspiration: settings.aspiration.unwrap_or(defaults.aspiration),
            effort: settings.effort.unwrap_or(defaults.effort),
            tilt: settings.tilt.unwrap_or(defaults.tilt),
            ..defaults
        },
    ))
}

/// Compile a phoneme script to its timeline. Offsets are UTF-8 byte ranges.
#[wasm_bindgen]
pub fn compile(source: &str, settings: JsValue) -> Result<JsValue, JsError> {
    let score = score(source, settings)?;
    let timeline = Timeline {
        duration_seconds: score.duration_seconds(),
        segments: score
            .segments
            .iter()
            .map(|s| Segment {
                phoneme: s.phoneme.as_deref(),
                start_seconds: s.start_seconds,
                end_seconds: s.end_seconds,
                src_start: s.src_start,
                src_end: s.src_end,
            })
            .collect(),
        warnings: &score.warnings,
    };
    Ok(serde_wasm_bindgen::to_value(&timeline)?)
}

/// Render the formant voice with an amount of Trombone color from 0 to 1.
#[wasm_bindgen(js_name = renderFormant)]
pub fn render_formant(
    source: &str,
    settings: JsValue,
    sample_rate: f64,
    brass_color: f64,
) -> Result<Vec<f32>, JsError> {
    let score = score(source, settings)?;
    Ok(wahwah_core::render_formant(
        &score,
        sample_rate,
        brass_color,
    ))
}

/// Render the wah-wah trombone.
#[wasm_bindgen(js_name = renderTrombone)]
pub fn render_trombone(
    source: &str,
    settings: JsValue,
    sample_rate: f64,
    options: JsValue,
) -> Result<Vec<f32>, JsError> {
    let score = score(source, settings)?;
    let options: TromboneSettings = serde_wasm_bindgen::from_value(options)?;
    Ok(wahwah_core::render_trombone(
        &score,
        sample_rate,
        &TromboneOptions {
            brightness: options.brightness,
            wah: options.wah,
            transpose: options.transpose,
        },
    ))
}
