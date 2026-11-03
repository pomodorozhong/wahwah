//! Stateless browser boundary: one render call returns a complete performance.
//! Rust uses UTF-8 byte ranges; JavaScript receives UTF-16 string positions.

use serde::{Deserialize, Serialize};
use wahwah_core::{
    ScoreOptions, TromboneOptions, Voice, compile_score,
    instruments::{
        InstrumentOptions, Note, compile_instrument, render_instrument as render_instrument_score,
    },
    mouth::TrackOptions,
    mumble::{self, MumbleOptions, MumbleScript, TextToken},
    render_performance,
};
use wasm_bindgen::prelude::*;

fn to_js(value: &impl Serialize) -> Result<JsValue, JsError> {
    Ok(value.serialize(
        &serde_wasm_bindgen::Serializer::new()
            .serialize_missing_as_null(true)
            .serialize_maps_as_objects(true),
    )?)
}

fn validate_sample_rate(sample_rate: f64) -> Result<(), JsError> {
    if sample_rate.is_finite() && (8000.0..=192000.0).contains(&sample_rate) {
        Ok(())
    } else {
        Err(JsError::new(
            "Sample rate must be between 8000 and 192000 Hz",
        ))
    }
}

fn with_audio(metadata: &impl Serialize, audio: &[f32]) -> Result<JsValue, JsError> {
    let result = to_js(metadata)?;
    let audio = js_sys::Float32Array::from(audio);
    js_sys::Reflect::set(&result, &JsValue::from_str("audio"), &audio)
        .map_err(|_| JsError::new("Could not attach performance audio"))?;
    Ok(result)
}

/// Original text becomes a note score, audio and per-note mouth movement.
#[wasm_bindgen(js_name = renderInstrument)]
pub fn render_instrument(
    source: &str,
    options: JsValue,
    sample_rate: f64,
    puppet: bool,
) -> Result<JsValue, JsError> {
    validate_sample_rate(sample_rate)?;
    let options: InstrumentOptions = serde_wasm_bindgen::from_value(options)?;
    if [
        options.pitch_hz,
        options.speed,
        options.expression,
        options.brightness,
    ]
    .iter()
    .any(|v| !v.is_finite())
        || !(40.0..=2000.0).contains(&options.pitch_hz)
        || !(0.25..=4.0).contains(&options.speed)
    {
        return Err(JsError::new(
            "Instrument settings must be finite; pitch 40–2000 Hz and speed 0.25–4",
        ));
    }
    let mut score = compile_instrument(source, &options);
    let track_options = TrackOptions::default();
    let mut performance =
        render_instrument_score(&score, sample_rate, puppet.then_some(&track_options));
    for note in &mut score.notes {
        note.src_start = js_offset(source, note.src_start);
        note.src_end = js_offset(source, note.src_end);
    }
    for segment in &mut performance.timeline.segments {
        segment.src_start = js_offset(source, segment.src_start);
        segment.src_end = js_offset(source, segment.src_end);
    }
    #[derive(Serialize)]
    struct InstrumentMetadata<'a> {
        #[serde(flatten)]
        performance: &'a wahwah_core::Performance,
        notes: &'a [Note],
    }
    with_audio(
        &InstrumentMetadata {
            performance: &performance,
            notes: &score.notes,
        },
        &performance.audio,
    )
}

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

impl VoiceSettings {
    fn score_options(self) -> Result<ScoreOptions, JsError> {
        if !self.pitch_hz.is_finite()
            || self.pitch_hz <= 0.0
            || !self.ms_per_phoneme.is_finite()
            || self.ms_per_phoneme <= 0.0
            || !self.formant_scale.is_finite()
            || self.formant_scale <= 0.0
        {
            return Err(JsError::new(
                "Pitch, phoneme duration and formant scale must be finite and positive",
            ));
        }
        let defaults = ScoreOptions::default();
        let result = ScoreOptions {
            base_f0: self.pitch_hz,
            rate: self.ms_per_phoneme,
            scale: self.formant_scale,
            vibrato_depth: self.vibrato_depth.unwrap_or(defaults.vibrato_depth),
            aspiration: self.aspiration.unwrap_or(defaults.aspiration),
            effort: self.effort.unwrap_or(defaults.effort),
            tilt: self.tilt.unwrap_or(defaults.tilt),
            ..defaults
        };
        if [
            result.vibrato_depth,
            result.aspiration,
            result.effort,
            result.tilt,
        ]
        .iter()
        .any(|v| !v.is_finite())
        {
            return Err(JsError::new("Voice expression values must be finite"));
        }
        Ok(result)
    }
}

#[derive(Deserialize)]
struct TromboneSettings {
    brightness: f64,
    wah: f64,
    transpose: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Input {
    Mumble,
    Phonemes,
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Engine {
    Formant,
    Trombone,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderOptions {
    input: Input,
    engine: Engine,
    #[serde(default)]
    mumble: MumbleOptions,
    brass_color: Option<f64>,
    trombone: Option<TromboneSettings>,
    puppet: bool,
}

fn js_offset(source: &str, byte: usize) -> usize {
    source[..byte].encode_utf16().count()
}

fn script_offsets(source: &str, script: &mut MumbleScript) {
    for word in &mut script.words {
        word.src_start = js_offset(source, word.src_start);
        word.src_end = js_offset(source, word.src_end);
        word.out_start = js_offset(&script.phonemes, word.out_start);
        word.out_end = js_offset(&script.phonemes, word.out_end);
    }
}

/// Generate a script without audio, for legacy live-demo synthesis until the
/// dependency-cleanup step moves that synthesis to WASM as well.
#[wasm_bindgen(js_name = generateMumble)]
pub fn generate_mumble(source: &str, options: JsValue) -> Result<JsValue, JsError> {
    let mut script = mumble::generate_mumble(source, &serde_wasm_bindgen::from_value(options)?);
    script_offsets(source, &mut script);
    to_js(&script)
}

#[wasm_bindgen(js_name = countSyllables)]
pub fn count_syllables(word: &str) -> usize {
    mumble::count_syllables(word)
}
#[wasm_bindgen(js_name = stressIndex)]
pub fn stress_index(word: &str, syllables: usize) -> i32 {
    mumble::stress_index(word, syllables).map_or(-1, |i| i as i32)
}
#[wasm_bindgen(js_name = tokenizeText)]
pub fn tokenize_text(source: &str) -> Result<JsValue, JsError> {
    let mut tokens = mumble::tokenize_text(source);
    for token in &mut tokens {
        if let TextToken::Word { start, end, .. } = token {
            *start = js_offset(source, *start);
            *end = js_offset(source, *end);
        }
    }
    to_js(&tokens)
}

#[wasm_bindgen(js_name = renderPerformance)]
pub fn render(
    source: &str,
    settings: JsValue,
    sample_rate: f64,
    options: JsValue,
) -> Result<JsValue, JsError> {
    validate_sample_rate(sample_rate)?;
    let base = serde_wasm_bindgen::from_value::<VoiceSettings>(settings)?.score_options()?;
    let options: RenderOptions = serde_wasm_bindgen::from_value(options)?;
    let mut script = match options.input {
        Input::Mumble => Some(mumble::generate_mumble(source, &options.mumble)),
        Input::Phonemes => None,
    };
    let phonemes = script.as_ref().map_or(source, |s| &s.phonemes);
    let voice_settings = script
        .as_ref()
        .map_or_else(|| base.clone(), |s| s.mood.voice(&base));
    let score = compile_score(phonemes, &voice_settings);
    let voice = match options.engine {
        Engine::Formant => {
            let color = options.brass_color.unwrap_or(0.0);
            if !color.is_finite() {
                return Err(JsError::new("Trombone color must be finite"));
            }
            Voice::Formant {
                brass_color: color.clamp(0.0, 1.0),
            }
        }
        Engine::Trombone => {
            let defaults = TromboneOptions::default();
            let settings = options.trombone.map_or(defaults, |s| TromboneOptions {
                brightness: s.brightness,
                wah: s.wah,
                transpose: s.transpose,
            });
            if [settings.brightness, settings.wah, settings.transpose]
                .iter()
                .any(|v| !v.is_finite())
            {
                return Err(JsError::new("Trombone settings must be finite"));
            }
            Voice::Trombone(settings)
        }
    };
    let track_options = TrackOptions::default();
    let mut performance = render_performance(
        &score,
        sample_rate,
        &voice,
        options.puppet.then_some(&track_options),
    );
    for segment in &mut performance.timeline.segments {
        segment.src_start = js_offset(phonemes, segment.src_start);
        segment.src_end = js_offset(phonemes, segment.src_end);
    }
    if let Some(script) = &mut script {
        script_offsets(source, script);
    }
    #[derive(Serialize)]
    struct ResultMetadata<'a> {
        #[serde(flatten)]
        performance: &'a wahwah_core::Performance,
        script: &'a Option<MumbleScript>,
    }
    with_audio(
        &ResultMetadata {
            performance: &performance,
            script: &script,
        },
        &performance.audio,
    )
}
