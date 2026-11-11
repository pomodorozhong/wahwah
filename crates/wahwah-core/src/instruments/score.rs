//! Word-level prosody becomes explicit notes, including glides and note tails.
use super::{Instrument, InstrumentOptions};
use crate::mumble::{TextToken, Tone, presets, tokenize_text};
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub start_seconds: f64,
    pub duration_seconds: f64,
    pub start_hz: f64,
    pub end_hz: f64,
    pub amplitude: f64,
    /// Original input word, as a UTF-8 byte range.
    pub src_start: usize,
    pub src_end: usize,
}

#[derive(Clone)]
pub struct InstrumentScore {
    pub instrument: Instrument,
    pub notes: Vec<Note>,
    pub duration_seconds: f64,
    pub brightness: f64,
    pub seed: u32,
    pub source_len: usize,
}

pub(super) fn hash(text: &str) -> u32 {
    text.bytes().fold(0x811c9dc5u32, |h, b| {
        (h ^ u32::from(b)).wrapping_mul(0x01000193)
    })
}

/// Pentatonic pitch quantization, including notes below the base octave.
fn quantize(semitones: f64) -> f64 {
    let octave = (semitones / 12.0).floor();
    let relative = semitones - octave * 12.0;
    let best = [0.0, 2.0, 4.0, 7.0, 9.0, 12.0]
        .into_iter()
        .min_by(|a, b| (a - relative).abs().total_cmp(&(b - relative).abs()))
        .unwrap();
    octave * 12.0 + best
}

fn phrase_words(tokens: &[TextToken<'_>]) -> Vec<(f64, bool, Tone)> {
    let mut result = vec![(0.0, false, Tone::None); tokens.len()];
    let mut words = Vec::new();
    let flush = |words: &mut Vec<usize>, result: &mut [(f64, bool, Tone)], tone| {
        let length = words.len();
        for (position, index) in words.drain(..).enumerate() {
            result[index] = (
                if length > 1 {
                    position as f64 / (length - 1) as f64
                } else {
                    0.0
                },
                position + 1 == length,
                tone,
            );
        }
    };
    for (i, token) in tokens.iter().enumerate() {
        match token {
            TextToken::Word { .. } => words.push(i),
            TextToken::Break { mark, tone } if *mark != ',' => {
                flush(&mut words, &mut result, *tone)
            }
            _ => (),
        }
    }
    flush(&mut words, &mut result, Tone::None);
    result
}

pub fn compile_instrument(source: &str, options: &InstrumentOptions) -> InstrumentScore {
    let tokens = tokenize_text(source);
    let phrases = phrase_words(&tokens);
    let mood = presets()
        .moods
        .iter()
        .find(|m| m.id == options.mood_id)
        .unwrap_or(&presets().moods[0]);
    let (expression_delta, amplitude) = match mood.id.as_str() {
        "happy" => (0.15, 1.05),
        "angry" => (0.1, 1.25),
        "sad" => (-0.15, 0.8),
        "surprised" => (0.2, 1.1),
        _ => (0.0, 1.0),
    };
    let expression = (options.expression + expression_delta).clamp(0.0, 1.0);
    let speed = options.speed.clamp(0.25, 4.0) / mood.rate_scale;
    let pitch = options.pitch_hz.clamp(40.0, 2000.0) * mood.pitch_scale;
    let mut notes = Vec::new();
    let mut time = 0.02;
    let mut previous_end = None;
    for (i, token) in tokens.iter().enumerate() {
        let TextToken::Word { text, start, end } = token else {
            if let TextToken::Break { mark, .. } = token {
                time += if *mark == ',' {
                    0.16 / speed
                } else {
                    0.34 / speed
                };
            }
            continue;
        };
        if previous_end
            .is_some_and(|previous| source[previous..*start].chars().any(char::is_whitespace))
        {
            time += 0.045 / speed;
        }
        previous_end = Some(*end);
        let n = ((text.chars().count() as f64 / 3.0).round() as usize).max(1);
        let (position, last, tone) = phrases[i];
        let jitter =
            f64::from(hash(&format!("{}|{}", text.to_lowercase(), options.seed)) % 1000) / 1000.0;
        let contour = match mood.id.as_str() {
            "happy" => 2.5 * (position * std::f64::consts::PI).sin(),
            "angry" => -5.0 * position,
            "sad" => -3.5 * position,
            "surprised" => 6.0 * position,
            _ => 0.0,
        };
        let mut semi_a = (jitter - 0.5) * 2.0 * expression * 5.0
            + (1.0 - position) * expression * 2.5
            - position * expression * 2.0
            + contour
            + expression * 2.2;
        if tone == Tone::Exclaim {
            semi_a += 3.0;
        }
        let mut semi_b = semi_a - 1.0 - (jitter - 0.5) * expression * 3.0;
        if last {
            semi_b = semi_a
                + match tone {
                    Tone::Question => 5.0 + expression * 5.0,
                    Tone::Statement => -4.0,
                    Tone::Exclaim => -2.0,
                    Tone::None => semi_b - semi_a,
                };
        }
        for j in 0..n {
            let x = if n > 1 {
                j as f64 / (n - 1) as f64
            } else {
                0.0
            };
            let step = if n > 1 {
                (if j % 2 == 1 { 1.0 } else { -1.0 }) * expression * 1.5
            } else {
                0.0
            };
            let raw = semi_a * (1.0 - x) + semi_b * x + step;
            let (from, to) = if options.instrument == Instrument::OohChoir {
                let pitch = quantize(raw);
                (pitch, pitch)
            } else {
                let x2 = if n > 1 {
                    ((j as f64 + 0.8) / (n - 1) as f64).min(1.0)
                } else {
                    1.0
                };
                (
                    raw,
                    semi_a * (1.0 - x2)
                        + semi_b * x2
                        + if j + 1 == n && last {
                            (semi_b - semi_a) * 0.4
                        } else {
                            0.0
                        },
                )
            };
            let duration = options.instrument.note_seconds() / speed
                * if j == 0 { 1.12 } else { 1.0 }
                * if last && j + 1 == n { 1.6 } else { 1.0 };
            let variation =
                0.92 + f64::from(hash(&format!("{text}{j}|{}", options.seed)) % 100) / 100.0 * 0.16;
            notes.push(Note {
                start_seconds: time,
                duration_seconds: duration,
                start_hz: pitch * 2f64.powf(from / 12.0),
                end_hz: pitch * 2f64.powf(to / 12.0),
                amplitude: 0.5
                    * if tone == Tone::Exclaim { 1.25 } else { 1.0 }
                    * amplitude
                    * 1.08
                    * if j == 0 { 1.08 } else { 0.92 }
                    * variation,
                src_start: *start,
                src_end: *end,
            });
            time += duration;
        }
    }
    // Match the reference's room for overlapping releases. Empty input is short silence.
    let duration = if notes.is_empty() { 0.15 } else { time + 1.2 };
    InstrumentScore {
        instrument: options.instrument,
        notes,
        duration_seconds: duration,
        brightness: options.brightness.clamp(0.0, 1.0),
        seed: options.seed,
        source_len: source.len(),
    }
}
