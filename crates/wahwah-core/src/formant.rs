//! Three parallel formant resonators driven by a glottal pulse and noise.
//! The synthesis design comes from klattsch (see THIRD_PARTY_NOTICES.md).

use crate::score::{Event, Target};
use std::f64::consts::{PI, TAU};

const OUTPUT_GAIN: f64 = 3.5;

/// Everything that moves in a straight line between targets.
#[derive(Clone, Copy, Default)]
struct Params {
    f0: f64,
    voicing: f64,
    f1: f64,
    bw1: f64,
    a1: f64,
    f2: f64,
    bw2: f64,
    a2: f64,
    f3: f64,
    bw3: f64,
    a3: f64,
    vibrato_depth: f64,
    vibrato_rate: f64,
    tremolo_depth: f64,
    tremolo_rate: f64,
    aspiration: f64,
    tilt: f64,
    effort: f64,
}

const PARAM_COUNT: usize = 18;

impl Params {
    fn initial() -> Self {
        Self {
            f0: 120.0,
            f1: 500.0,
            bw1: 80.0,
            f2: 1500.0,
            bw2: 120.0,
            f3: 2500.0,
            bw3: 160.0,
            vibrato_rate: 5.0,
            tremolo_rate: 5.0,
            effort: 0.5,
            ..Self::default()
        }
    }

    fn to_array(self) -> [f64; PARAM_COUNT] {
        [
            self.f0,
            self.voicing,
            self.f1,
            self.bw1,
            self.a1,
            self.f2,
            self.bw2,
            self.a2,
            self.f3,
            self.bw3,
            self.a3,
            self.vibrato_depth,
            self.vibrato_rate,
            self.tremolo_depth,
            self.tremolo_rate,
            self.aspiration,
            self.tilt,
            self.effort,
        ]
    }

    fn from_array(v: [f64; PARAM_COUNT]) -> Self {
        Self {
            f0: v[0],
            voicing: v[1],
            f1: v[2],
            bw1: v[3],
            a1: v[4],
            f2: v[5],
            bw2: v[6],
            a2: v[7],
            f3: v[8],
            bw3: v[9],
            a3: v[10],
            vibrato_depth: v[11],
            vibrato_rate: v[12],
            tremolo_depth: v[13],
            tremolo_rate: v[14],
            aspiration: v[15],
            tilt: v[16],
            effort: v[17],
        }
    }

    fn apply(&mut self, target: &Target) {
        if let Some(sound) = &target.sound {
            self.f0 = sound.f0;
            self.voicing = sound.voicing;
            self.f1 = sound.f1;
            self.bw1 = sound.bw1;
            self.f2 = sound.f2;
            self.bw2 = sound.bw2;
            self.f3 = sound.f3;
            self.bw3 = sound.bw3;
        }
        self.a1 = target.a1;
        self.a2 = target.a2;
        self.a3 = target.a3;
        self.vibrato_depth = target.vibrato_depth;
        self.vibrato_rate = target.vibrato_rate;
        self.tremolo_depth = target.tremolo_depth;
        self.tremolo_rate = target.tremolo_rate;
        self.aspiration = target.aspiration;
        self.tilt = target.tilt;
        self.effort = target.effort;
    }
}

/// Constant-skirt-gain bandpass biquad (RBJ Audio EQ Cookbook).
#[derive(Default)]
struct Bandpass {
    x1: f64,
    x2: f64,
    y1: f64,
    y2: f64,
    b0: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    last_f: f64,
    last_bw: f64,
}

impl Bandpass {
    fn tune(&mut self, f: f64, bw: f64, sample_rate: f64) {
        if f == self.last_f && bw == self.last_bw {
            return;
        }
        self.last_f = f;
        self.last_bw = bw;
        let f = f.min(sample_rate * 0.45).max(40.0);
        let bw = bw.max(20.0);
        let w0 = TAU * f / sample_rate;
        let alpha = w0.sin() / (2.0 * f / bw);
        let a0 = 1.0 + alpha;
        self.b0 = alpha / a0;
        self.b2 = -alpha / a0;
        self.a1 = -2.0 * w0.cos() / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    fn process(&mut self, x: f64) -> f64 {
        let y = self.b0 * x + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        y
    }
}

/// Derivative of a Rosenberg glottal pulse, phase in [0, 1). Low effort is lax
/// and breathy; high effort closes sharply.
fn glottal_pulse(phase: f64, effort: f64) -> f64 {
    let effort = effort.clamp(0.0, 1.0);
    let open = 0.5 - effort * 0.2;
    let closing = 0.25 - effort * 0.17;
    const NORMALIZE: f64 = 0.1;
    if phase < open {
        NORMALIZE * 0.5 * (PI / open) * (PI * phase / open).sin()
    } else if phase < open + closing {
        -NORMALIZE * (PI / (2.0 * closing)) * (PI * (phase - open) / (2.0 * closing)).sin()
    } else {
        0.0
    }
}

/// Linear up to ±0.85, then a smooth knee that never reaches ±1.
fn soft_clip(x: f64) -> f64 {
    const KNEE: f64 = 0.85;
    let size = x.abs();
    if size <= KNEE {
        return x;
    }
    let excess = size - KNEE;
    x.signum() * (KNEE + (1.0 - KNEE) * excess / (excess + 1.0))
}

fn wrap(phase: f64, period: f64) -> f64 {
    phase - period * (phase / period).floor()
}

/// Render `total_ms` of audio from time-ordered events.
pub(crate) fn render(events: &[Event], total_ms: f64, sample_rate: f64) -> Vec<f32> {
    let length = (total_ms * sample_rate / 1000.0).ceil() as usize;
    let mut out = Vec::with_capacity(length);
    let mut current = Params::initial();
    let mut target = current;
    let mut increment = [0.0; PARAM_COUNT];
    let mut transition_left = 0usize;
    let mut next = 0;
    let mut glottal_phase = 0.0;
    let mut vibrato_phase = 0.0;
    let mut tremolo_phase = 0.0;
    let mut tilt_previous = 0.0;
    let mut noise_state: u32 = 0xACE1_ACE1;
    let mut bands = [
        Bandpass::default(),
        Bandpass::default(),
        Bandpass::default(),
    ];

    for sample in 0..length {
        while let Some(event) = events
            .get(next)
            .filter(|e| ((e.at_ms * sample_rate / 1000.0).floor() as usize) <= sample)
        {
            next += 1;
            let steps = ((event.transition_ms * sample_rate / 1000.0).floor() as usize).max(1);
            transition_left = steps;
            target.apply(&event.target);
            let (from, to) = (current.to_array(), target.to_array());
            for i in 0..PARAM_COUNT {
                increment[i] = (to[i] - from[i]) / steps as f64;
            }
        }

        if transition_left > 0 {
            transition_left -= 1;
            if transition_left == 0 {
                current = target;
            } else {
                let mut values = current.to_array();
                for (value, step) in values.iter_mut().zip(increment) {
                    *value += step;
                }
                current = Params::from_array(values);
            }
        }

        vibrato_phase = wrap(
            vibrato_phase + TAU * current.vibrato_rate / sample_rate,
            TAU,
        );
        let f0 = current.f0 + current.vibrato_depth * vibrato_phase.sin();
        tremolo_phase = wrap(
            tremolo_phase + TAU * current.tremolo_rate / sample_rate,
            TAU,
        );
        let tremolo = 1.0 - current.tremolo_depth * (0.5 + 0.5 * tremolo_phase.sin());

        noise_state ^= noise_state << 13;
        noise_state ^= noise_state >> 17;
        noise_state ^= noise_state << 5;
        let noise = f64::from(noise_state as i32) / 2_147_483_648.0;

        let voicing = current.voicing.clamp(0.0, 1.0);
        let excitation = voicing
            * glottal_pulse(glottal_phase, current.effort)
            * (1.0 - current.aspiration * 0.85)
            + (1.0 - voicing) * noise * 0.35
            + current.aspiration * noise * 0.5;
        glottal_phase = wrap(glottal_phase + f0 / sample_rate, 1.0);

        bands[0].tune(current.f1, current.bw1, sample_rate);
        bands[1].tune(current.f2, current.bw2, sample_rate);
        bands[2].tune(current.f3, current.bw3, sample_rate);
        let voiced = (bands[0].process(excitation) * current.a1
            + bands[1].process(excitation) * current.a2
            + bands[2].process(excitation) * current.a3)
            * OUTPUT_GAIN
            * tremolo;
        let tilted = voiced - current.tilt * tilt_previous;
        tilt_previous = voiced;
        out.push(soft_clip(tilted) as f32);
    }
    out
}
