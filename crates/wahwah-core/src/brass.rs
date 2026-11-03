//! The formant voice with Trombone color. Up to `FULL_COLOR` the color only
//! reshapes the voice's resonances; beyond it, voiced sounds cross over to the
//! horn while consonants keep the voice's articulation.

use crate::formant;
use crate::score::{Event, Score};
use crate::trombone::{Phrasing, TromboneOptions, render_horn};

const FULL_COLOR: f64 = 0.75;

/// Change the resonances of voiced sounds. Pauses, bursts and noise consonants
/// keep their original articulation.
fn color_event(event: &Event, amount: f64) -> Event {
    let mut colored = event.clone();
    let target = &mut colored.target;
    let Some(sound) = target
        .sound
        .as_mut()
        .filter(|s| s.voicing != 0.0 && !s.is_stop)
    else {
        return colored;
    };
    let weight = amount * sound.voicing;
    let mix = |dry: f64, brass: f64| dry + weight * (brass - dry);
    // F1 rises as a vowel opens. That movement sweeps the mute above a broad
    // lower resonance that carries the body of the horn.
    let opening = ((sound.f1 - 200.0) / 600.0).clamp(0.0, 1.0);
    let bell = 360.0 + 1700.0 * opening;
    // Broader resonances pass more energy; keep vowels level with consonants.
    let level = 1.0 - 0.64 * weight;
    target.effort = mix(target.effort, 0.95);
    sound.f1 = mix(sound.f1, 1.7 * sound.f0 + 75.0);
    sound.bw1 = mix(sound.bw1, 250.0);
    sound.f2 = mix(sound.f2, bell);
    sound.bw2 = mix(sound.bw2, bell * 0.26);
    sound.f3 = mix(sound.f3, bell * 1.85);
    sound.bw3 = mix(sound.bw3, bell * 0.38);
    target.a1 *= level * (1.0 - weight * 0.30);
    target.a2 *= level;
    target.a3 *= level * (1.0 - weight * 0.50);
    colored
}

/// Hand voiced sounds to the horn, following each onset, closure and release.
fn mix_horn(score: &Score, speech: &mut [f32], sample_rate: f64, amount: f64) {
    let options = TromboneOptions {
        transpose: 0.0,
        ..TromboneOptions::default()
    };
    let horn = render_horn(score, sample_rate, &options, Phrasing::Speech);
    // Follow syllable loudness without imprinting individual pitch cycles.
    let smoothing = 1.0 - (-1.0 / (sample_rate * 0.012)).exp();
    let (mut voice_power, mut horn_power) = (0.0, 0.0);
    let (mut blend, mut target_blend, mut increment) = (0.0, 0.0, 0.0);
    let mut ramp_left = 0usize;
    let mut next = 0;
    for (i, (sample, brass)) in speech.iter_mut().zip(horn).enumerate() {
        while let Some(event) = score
            .events
            .get(next)
            .filter(|e| ((e.at_ms * sample_rate / 1000.0).floor() as usize) <= i)
        {
            next += 1;
            target_blend = match &event.target.sound {
                Some(sound) if !sound.is_stop => amount * sound.voicing,
                _ => 0.0,
            };
            ramp_left = ((event.transition_ms * sample_rate / 1000.0).floor() as usize).max(1);
            increment = (target_blend - blend) / ramp_left as f64;
        }
        if ramp_left > 0 {
            ramp_left -= 1;
            blend = if ramp_left == 0 {
                target_blend
            } else {
                blend + increment
            };
        }
        let voice = f64::from(*sample);
        let brass = f64::from(brass);
        voice_power += smoothing * (voice * voice - voice_power);
        horn_power += smoothing * (brass * brass - horn_power);
        let gain = (voice_power / horn_power.max(0.0016)).sqrt().min(3.5);
        *sample = (voice + blend * ((brass * gain).tanh() - voice)) as f32;
    }
}

/// Render the formant voice with an amount of Trombone color from 0 to 1.
pub fn render_formant(score: &Score, sample_rate: f64, brass_color: f64) -> Vec<f32> {
    let color = brass_color.clamp(0.0, 1.0);
    let mut speech = if color > 0.0 {
        let events: Vec<Event> = score.events.iter().map(|e| color_event(e, color)).collect();
        formant::render(&events, score.total_ms, sample_rate)
    } else {
        formant::render(&score.events, score.total_ms, sample_rate)
    };
    if color > FULL_COLOR {
        let amount = (color - FULL_COLOR) / (1.0 - FULL_COLOR);
        mix_horn(score, &mut speech, sample_rate, amount);
    }
    speech
}
