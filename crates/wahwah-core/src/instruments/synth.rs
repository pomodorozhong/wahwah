//! Muted brass, a three-voice ooh choir and a clipped membrane buzz.
//! The note envelopes and pitch curves follow Talking Instruments' renderTone.
use super::{Instrument, InstrumentScore};
use std::f64::consts::{PI, TAU};

struct Random(u32);
impl Random {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let mut t = (self.0 ^ (self.0 >> 15)).wrapping_mul(self.0 | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4294967296.0 * 2.0 - 1.0
    }
}

#[derive(Default)]
struct Mute {
    low: f64,
    band: f64,
}
impl Mute {
    fn filter(&mut self, sample: f64, cutoff: f64, damping: f64, sample_rate: f64) -> f64 {
        let f = 2.0 * (PI * cutoff.min(sample_rate / 6.0) / sample_rate).sin();
        self.low += f * self.band;
        self.band += f * (sample - self.low - damping * self.band);
        self.band
    }
}

pub fn render_notes(score: &InstrumentScore, sample_rate: f64) -> Vec<f32> {
    let mut out = vec![0.0f32; (score.duration_seconds * sample_rate).ceil() as usize];
    let kind = score.instrument;
    let mut noise = Random(score.seed);
    for note in &score.notes {
        let start = (note.start_seconds * sample_rate).floor() as usize;
        let sustain = note.duration_seconds * 1.08;
        let length = ((sustain + kind.release_seconds()) * sample_rate).floor() as usize;
        let mut mute = Mute::default();
        let (mut phase, mut body, mut breath) = (0.0, 0.0, 0.0);
        for i in 0..length.min(out.len().saturating_sub(start)) {
            let time = i as f64 / sample_rate;
            let p = (time / sustain.max(0.02)).min(1.0);
            let smooth = p * p * (3.0 - 2.0 * p);
            let decay = if kind == Instrument::OohChoir {
                0.12
            } else {
                0.03
            };
            let env = (time / kind.attack_seconds()).min(1.0)
                * if time > sustain {
                    (-(time - sustain) / decay).exp()
                } else {
                    1.0
                };
            let sample = if kind == Instrument::OohChoir {
                let mut sum = 0.0;
                for (multiple, gain, offset) in
                    [(1.0, 1.0, 0.0), (1.122, 0.55, 1.7), (0.5, 0.45, 3.1)]
                {
                    let frequency = note.start_hz
                        * multiple
                        * (1.0 + 0.005 * (TAU * (4.8 + offset * 0.3) * time + offset).sin());
                    for h in 1..=8 {
                        let f = frequency * f64::from(h);
                        if f > 5000.0f64.min(sample_rate * 0.45) {
                            break;
                        }
                        let weight = (-((f - 330.0) / 180.0).powi(2)).exp()
                            + 0.5 * (-((f - 720.0) / 260.0).powi(2)).exp()
                            + 0.08 * (-((f - 2300.0) / 500.0).powi(2)).exp();
                        sum += gain * weight * (TAU * f * time + offset * f64::from(h)).sin();
                    }
                }
                breath += (noise.next() - breath) * 0.06;
                (sum * 0.5 + breath * 0.05) * env
            } else {
                let kazoo = kind == Instrument::Kazoo;
                let vibrato_start = if kazoo { 0.06 } else { 0.08 };
                let vibrato = if time > vibrato_start {
                    (if kazoo { 0.012 } else { 0.006 })
                        * (TAU * (if kazoo { 6.0 } else { 5.5 }) * time).sin()
                } else {
                    0.0
                };
                let f =
                    note.start_hz * (note.end_hz / note.start_hz).powf(smooth) * (1.0 + vibrato);
                phase = (phase + f / sample_rate).fract();
                let harmonics = (6000.0f64.min(sample_rate * 0.45) / f)
                    .floor()
                    .clamp(0.0, 14.0) as usize;
                let sum: f64 = (1..=harmonics)
                    .map(|h| (TAU * h as f64 * phase).sin() / h as f64)
                    .sum();
                if kazoo {
                    let buzz = (sum * 3.2).tanh();
                    let nasal = mute.filter(buzz, 1150.0, 0.5, sample_rate);
                    (buzz * 0.35 + nasal * 0.8) * env * 0.5
                } else {
                    let (low, high) = if kind == Instrument::MutedHorn {
                        (480.0, 1500.0)
                    } else {
                        (300.0, 950.0)
                    };
                    let cutoff = low + (high - low) * (PI * (p * 1.1).min(1.0)).sin();
                    let band = mute.filter(sum * 0.6, cutoff, 0.35, sample_rate);
                    body += 0.08 * (mute.low - body);
                    (band * 0.9 + body * 0.5) * env * 0.55
                }
            };
            let tail = ((length - i) as f64 / (sample_rate * 0.004)).min(1.0);
            out[start + i] += (sample * note.amplitude * tail) as f32;
        }
    }
    finish(&mut out, score.brightness, sample_rate);
    out
}

fn finish(out: &mut [f32], brightness: f64, sample_rate: f64) {
    // Gentle brightness low-pass followed by the reference's broad 3 kHz cut.
    let cutoff =
        (1500.0 + ((brightness - 0.15) / 0.75).clamp(0.0, 1.0) * 8000.0).min(sample_rate * 0.45);
    let alpha = 1.0 - (-TAU * cutoff / sample_rate).exp();
    let (mut low, mut low2) = (0.0, 0.0);
    let a = 10f64.powf(-6.0 / 40.0);
    let w = TAU * 3000.0f64.min(sample_rate * 0.4) / sample_rate;
    let al = w.sin() / (2.0 * 0.9);
    let (b0, b1, b2) = (1.0 + al * a, -2.0 * w.cos(), 1.0 - al * a);
    let (a0, a1, a2) = (1.0 + al / a, -2.0 * w.cos(), 1.0 - al / a);
    let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0);
    let mut peak = 0.0f32;
    for sample in out.iter_mut() {
        low += alpha * (f64::from(*sample) - low);
        low2 += alpha * (low - low2);
        let y = (b0 * low2 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        x2 = x1;
        x1 = low2;
        y2 = y1;
        y1 = y;
        *sample = if y.is_finite() { y as f32 } else { 0.0 };
        peak = peak.max(sample.abs());
    }
    if peak > 0.0 {
        for sample in out {
            *sample *= 0.8 / peak;
        }
    }
}
