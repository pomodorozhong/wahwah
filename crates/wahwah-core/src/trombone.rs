//! The wah-wah muted trombone: additive brass through a plunger low-pass that
//! opens on vowels and closes on consonants. Timing and pitch follow the score.

use crate::score::{Event, Score, Segment};
use std::f64::consts::TAU;

const STEP: f64 = 0.002;
const SONORANTS: [&str; 7] = ["M", "N", "NG", "L", "R", "W", "Y"];
const MAX_HARMONICS: usize = 48;
const BLOCK: usize = 32;

#[derive(Clone, Debug)]
pub struct TromboneOptions {
    /// 0 dark and muffled, 1 bright and brassy.
    pub brightness: f64,
    /// How far the plunger opens on open vowels, 0 to 1.
    pub wah: f64,
    /// Pitch shift in semitones applied to the speech contour.
    pub transpose: f64,
}

impl Default for TromboneOptions {
    fn default() -> Self {
        Self {
            brightness: 0.45,
            wah: 0.85,
            transpose: -5.0,
        }
    }
}

/// How the player follows the contour.
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Phrasing {
    /// Portamento and a lazy vibrato of the player's own.
    Player,
    /// The score's exact pitch and vibrato, for blending with a voice.
    Speech,
}

/// Mouth (jaw open, lip round) for a vowel. Only the trombone's plunger reads
/// these; the puppet's poses are separate for now.
fn vowel_shape(code: &str) -> Option<(f64, f64)> {
    Some(match code {
        "AA" | "AY" | "AW" => (0.9, 0.0),
        "AE" => (0.75, 0.0),
        "AH" => (0.6, 0.0),
        "AO" | "OY" => (0.7, 0.5),
        "EH" | "EY" => (0.5, 0.0),
        "ER" => (0.35, 0.45),
        "IH" => (0.3, 0.0),
        "IY" => (0.2, 0.0),
        "UH" => (0.3, 0.6),
        "UW" => (0.18, 1.0),
        "OW" => (0.55, 0.7),
        _ => return None,
    })
}

fn f0_curve(events: &[Event], duration: f64) -> Vec<f64> {
    let count = ((duration / STEP).ceil() as usize).max(1);
    let mut pitched = events
        .iter()
        .filter_map(|e| Some((e.at_ms, e.transition_ms, e.target.sound.as_ref()?.f0)))
        .peekable();
    let mut current = pitched.peek().map_or(120.0, |e| e.2);
    let (mut from, mut target) = (current, current);
    let (mut ramp_start, mut ramp_end) = (0.0, 0.0);
    (0..count)
        .map(|i| {
            let t_ms = i as f64 * STEP * 1000.0;
            while let Some((at_ms, transition_ms, f0)) = pitched.next_if(|e| e.0 <= t_ms) {
                from = current;
                target = f0;
                ramp_start = at_ms;
                ramp_end = at_ms + transition_ms.max(1.0);
            }
            current = if t_ms >= ramp_end {
                target
            } else {
                from + (target - from) * (t_ms - ramp_start) / (ramp_end - ramp_start)
            };
            current
        })
        .collect()
}

/// Loudness and plunger openness, 0 to 1, every `STEP` seconds.
fn articulation(segments: &[Segment], duration: f64, wah: f64) -> (Vec<f64>, Vec<f64>) {
    let count = ((duration / STEP).ceil() as usize).max(1);
    let mut amps = Vec::with_capacity(count);
    let mut opens = Vec::with_capacity(count);
    let (mut amp, mut open) = (0.0, 0.0);
    let mut index = 0;
    for i in 0..count {
        let t = i as f64 * STEP;
        while segments.get(index).is_some_and(|s| s.end_seconds <= t) {
            index += 1;
        }
        let code = segments
            .get(index)
            .filter(|s| t >= s.start_seconds)
            .and_then(|s| s.phoneme.as_deref());
        let (target_amp, target_open) = match code {
            None => (0.0, 0.05),
            Some(code) => match vowel_shape(code) {
                // Open vowels open the plunger most; rounded ones stay half-covered.
                Some((jaw, round)) => (1.0, (0.3 + 0.7 * jaw) * (1.0 - 0.35 * round)),
                None if SONORANTS.contains(&code) => (0.45, 0.1),
                None => (0.08, 0.05),
            },
        };
        // Fast attack, slower release; the plunger moves a little slower than the air.
        let attack = if target_amp > amp { 0.018 } else { 0.045 };
        amp += (target_amp - amp) * (1.0 - (-STEP / attack).exp());
        open += (target_open * wah - open) * (1.0 - (-STEP / 0.04f64).exp());
        amps.push(amp);
        opens.push(open);
    }
    (amps, opens)
}

pub(crate) fn render_horn(
    score: &Score,
    sample_rate: f64,
    options: &TromboneOptions,
    phrasing: Phrasing,
) -> Vec<f32> {
    let duration = score.duration_seconds();
    let total = (duration * sample_rate).ceil() as usize;
    let mut out = vec![0f32; total];
    if total == 0 {
        return out;
    }
    let mut f0 = f0_curve(&score.events, duration);
    if phrasing == Phrasing::Speech {
        // The score's vibrato directives ride on top of its pitch bends.
        let (mut phase, mut depth, mut rate, mut next) = (0.0, 0.0, 5.0, 0);
        for (i, value) in f0.iter_mut().enumerate() {
            while let Some(event) = score
                .events
                .get(next)
                .filter(|e| e.at_ms <= i as f64 * STEP * 1000.0)
            {
                depth = event.target.vibrato_depth;
                rate = event.target.vibrato_rate;
                next += 1;
            }
            *value += depth * f64::sin(phase);
            phase += TAU * rate * STEP;
        }
    }
    let (amps, opens) = articulation(&score.segments, duration, options.wah);
    let shift = 2f64.powf(options.transpose / 12.0);
    let mut phases = [0.0; MAX_HARMONICS + 1];
    let mut gains = [0.0; MAX_HARMONICS + 1];
    let mut re = [0.0; MAX_HARMONICS + 1];
    let mut im = [0.0; MAX_HARMONICS + 1];
    let mut step_re = [0.0; MAX_HARMONICS + 1];
    let mut step_im = [0.0; MAX_HARMONICS + 1];
    let mut noise_state: u32 = 0x7b0b;
    let mut breath = 0.0;
    let mut pitch = f0[0] * shift;
    let highest = 6000f64.min(sample_rate / 2.2);

    for start in (0..total).step_by(BLOCK) {
        let t = start as f64 / sample_rate;
        let control = ((t / STEP).floor() as usize).min(f0.len() - 1);
        match phrasing {
            Phrasing::Player => {
                let target = f0[control] * shift * (1.0 + 0.006 * (TAU * 5.2 * t).sin());
                pitch += (target - pitch) * (1.0 - (-(BLOCK as f64 / sample_rate) / 0.03).exp());
            }
            Phrasing::Speech => pitch = f0[control] * shift,
        }
        let amp = amps[control];
        // Plunger: the corner moves with openness; louder notes get brassier.
        let corner = 260.0
            + 2600.0
                * opens[control].powf(1.3)
                * (0.75 + 0.5 * amp)
                * (0.6 + 0.8 * options.brightness);
        let mut harmonics = 0;
        while harmonics < MAX_HARMONICS && (harmonics + 1) as f64 * pitch < highest {
            harmonics += 1;
            let k = harmonics as f64;
            let f = k * pitch;
            let brass = k.powf(-0.65 + 0.35 * options.brightness);
            let lowpass = 1.0 / (1.0 + (f / corner).powi(4)).sqrt();
            let resonance = 1.0 + 0.9 * (-((f - corner) / (0.3 * corner)).powi(2)).exp();
            gains[harmonics] = brass * lowpass * resonance;
        }
        let end = total.min(start + BLOCK);
        let phase_step = TAU * pitch / sample_rate;
        // Each harmonic is a rotating phasor: one complex multiply per sample
        // instead of a sine call. Phases are re-anchored every block.
        for h in 1..=harmonics {
            re[h] = f64::cos(phases[h]);
            im[h] = f64::sin(phases[h]);
            step_re[h] = (phase_step * h as f64).cos();
            step_im[h] = (phase_step * h as f64).sin();
        }
        for sample in &mut out[start..end] {
            let mut sum = 0.0;
            for h in 1..=harmonics {
                let rotated = re[h] * step_re[h] - im[h] * step_im[h];
                im[h] = re[h] * step_im[h] + im[h] * step_re[h];
                re[h] = rotated;
                sum += gains[h] * im[h];
            }
            noise_state ^= noise_state << 13;
            noise_state ^= noise_state >> 17;
            noise_state ^= noise_state << 5;
            let noise = f64::from(noise_state) / 2_147_483_648.0 - 1.0;
            breath += (noise - breath) * 0.15;
            *sample = (amp * (sum + 0.25 * breath)) as f32;
        }
        let elapsed = (end - start) as f64;
        for (h, phase) in phases.iter_mut().enumerate().take(harmonics + 1) {
            *phase = (*phase + phase_step * h as f64 * elapsed) % TAU;
        }
    }

    // Normalize to a comfortable peak.
    let peak = out.iter().fold(0f32, |peak, v| peak.max(v.abs()));
    if peak > 0.0 {
        for sample in &mut out {
            *sample *= 0.7 / peak;
        }
    }
    out
}

/// Render the wah-wah trombone.
pub fn render_trombone(score: &Score, sample_rate: f64, options: &TromboneOptions) -> Vec<f32> {
    render_horn(score, sample_rate, options, Phrasing::Player)
}
