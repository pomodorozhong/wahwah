//! Fit a performance within a maximum duration.
//!
//! A line that is too long is first sped up, up to `MAX_SPEEDUP`, by scaling
//! every time on its score. Audio, timeline and mouth movement are all made from
//! the fitted score, so they cannot drift apart. Pitch is not changed. A line that
//! is still too long is cut at the cap with a short fade. Shorter lines are left
//! exactly as they were. The cap includes the synthesis tail: the audio is never
//! longer than `floor(cap * sample_rate)` samples. The fade into a cut can be
//! shaped with `CutFade`: its length, curve, bend and end volume. The speed-up
//! can be shaped with `SpeedUp`: how fast at most, and whether the speed is steady
//! or ramps up or down along the line. `Volume` shapes the volume along the line the
//! same way.

use crate::{Score, instruments::InstrumentScore};
use serde::{Deserialize, Serialize};

/// The default for the fastest a line is sped up before the rest is cut.
pub const MAX_SPEEDUP: f64 = 1.6;
/// The largest top speed that is accepted.
pub const MAX_SPEEDUP_LIMIT: f64 = 3.0;
/// The default fade into the cut, in milliseconds.
pub const CUT_FADE_MS: f64 = 80.0;
/// The longest fade that is accepted, in milliseconds.
pub const MAX_FADE_MS: f64 = 5000.0;
pub const MIN_CAP_SECONDS: f64 = 0.1;
pub const MAX_CAP_SECONDS: f64 = 600.0;

/// How the volume falls over the fade into a cut.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FadeCurve {
    /// No fade: the audio stops at the cap.
    None,
    /// Volume falls in a straight line.
    #[default]
    Linear,
    /// A half cosine: gentle at both ends.
    Smooth,
    /// Volume drops fast at first, then trails off.
    Quick,
    /// A straight line in decibels, down to -60 dB: it sounds even to the ear.
    Decibel,
}

/// The fade into a cut. Only a line that was cut is faded.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CutFade {
    /// Length of the fade, 0 to `MAX_FADE_MS`. It is held to the length of the audio.
    pub milliseconds: f64,
    pub curve: FadeCurve,
    /// Bends the curve. 1 leaves it as it is, above 1 holds the volume longer and
    /// then drops faster, below 1 drops sooner. 0.1 to 8.
    pub exponent: f64,
    /// The volume the fade ends at, 0 (silent) to 1 (no fade at all).
    pub end_volume: f64,
}

impl Default for CutFade {
    fn default() -> Self {
        Self {
            milliseconds: CUT_FADE_MS,
            curve: FadeCurve::Linear,
            exponent: 1.0,
            end_volume: 0.0,
        }
    }
}

impl CutFade {
    pub fn is_valid(&self) -> bool {
        self.milliseconds.is_finite()
            && (0.0..=MAX_FADE_MS).contains(&self.milliseconds)
            && self.exponent.is_finite()
            && (0.1..=8.0).contains(&self.exponent)
            && self.end_volume.is_finite()
            && (0.0..=1.0).contains(&self.end_volume)
    }

    /// Volume at `t`, where 0 is the start of the fade and 1 is the end.
    pub fn gain(&self, t: f32) -> f32 {
        let mut g = self.curve.gain(t);
        if self.exponent != 1.0 {
            g = g.powf(self.exponent as f32);
        }
        let end = self.end_volume as f32;
        if end > 0.0 { end + (1.0 - end) * g } else { g }
    }
}

impl FadeCurve {
    /// Gain at `t`, where 0 is the start of the fade and 1 is the end.
    fn gain(self, t: f32) -> f32 {
        match self {
            FadeCurve::None => 1.0,
            FadeCurve::Linear => 1.0 - t,
            FadeCurve::Smooth => 0.5 * (1.0 + (std::f32::consts::PI * t).cos()),
            FadeCurve::Quick => (1.0 - t) * (1.0 - t),
            FadeCurve::Decibel => {
                let floor = 0.001_f32;
                (10_f32.powf(-3.0 * t) - floor) / (1.0 - floor)
            }
        }
    }
}

/// How the speed changes along the line.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SpeedProfile {
    /// The same speed all the way.
    #[default]
    Constant,
    /// Starts at normal speed and speeds up toward the end.
    RampUp,
    /// Starts fast and slows to normal speed at the end.
    RampDown,
    /// Like `RampUp`, but eased at both ends.
    Smooth,
}

impl SpeedProfile {
    /// How far along the ramp the line is at `u`, 0 at its start and 1 at its end.
    pub fn shape(self, u: f64) -> f64 {
        match self {
            SpeedProfile::Constant => 1.0,
            SpeedProfile::RampUp => u,
            SpeedProfile::RampDown => 1.0 - u,
            SpeedProfile::Smooth => u * u * (3.0 - 2.0 * u),
        }
    }
}

/// How a long line is sped up before any of it is cut.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SpeedUp {
    pub profile: SpeedProfile,
    /// The fastest the line gets, 1 to `MAX_SPEEDUP_LIMIT`. 1 turns the speed-up off.
    pub max: f64,
}

impl Default for SpeedUp {
    fn default() -> Self {
        Self {
            profile: SpeedProfile::Constant,
            max: MAX_SPEEDUP,
        }
    }
}

impl SpeedUp {
    pub fn is_valid(&self) -> bool {
        self.max.is_finite() && (1.0..=MAX_SPEEDUP_LIMIT).contains(&self.max)
    }

    /// Speed at `u` along the line when the peak is `peak`.
    pub fn speed_at(&self, peak: f64, u: f64) -> f64 {
        1.0 + (peak - 1.0) * self.profile.shape(u)
    }
}

/// Where a line that is still too long is cut.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CutAt {
    /// At the cap, even in the middle of a word, with the fade.
    #[default]
    Anywhere,
    /// At the end of the last word that fits whole. The line ends there, and the fade
    /// shapes that ending. When not even the first word fits, it is cut at the cap.
    Word,
}

/// The volume along a fitted line. It uses the same shapes as the speed-up: `Constant`
/// holds `level` all the way, the ramps move between 1 and `level`.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Volume {
    pub profile: SpeedProfile,
    /// 0 to `MAX_VOLUME_LEVEL`. 1 is the volume the voice has.
    pub level: f64,
}

pub const MAX_VOLUME_LEVEL: f64 = 2.0;

impl Default for Volume {
    fn default() -> Self {
        Self {
            profile: SpeedProfile::Constant,
            level: 1.0,
        }
    }
}

impl Volume {
    pub fn is_valid(&self) -> bool {
        self.level.is_finite() && (0.0..=MAX_VOLUME_LEVEL).contains(&self.level)
    }

    /// The gain `u` of the way along the line, 0 to 1.
    pub fn gain(&self, u: f64) -> f32 {
        (1.0 + (self.level - 1.0) * self.profile.shape(u)) as f32
    }

    fn is_flat(&self) -> bool {
        self.profile == SpeedProfile::Constant && self.level == 1.0
    }
}

/// Everything that shapes how a long line is fitted.
#[derive(Clone, Copy, Debug, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FitOptions {
    pub cut_fade: CutFade,
    pub speed_up: SpeedUp,
    pub cut_at: CutAt,
    pub volume: Volume,
}

impl FitOptions {
    pub fn is_valid(&self) -> bool {
        self.cut_fade.is_valid() && self.speed_up.is_valid() && self.volume.is_valid()
    }
}

/// What fitting did, so a host can tell the caller.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fit {
    /// The duration the line would have had without a cap.
    pub natural_seconds: f64,
    /// The average speed over the line. 1 when the line was not sped up.
    pub speed: f64,
    /// The fastest the line got. It equals `speed` for a constant speed-up.
    pub peak_speed: f64,
    pub truncated: bool,
    /// When the line was cut, the time it was cut at on the fitted line.
    pub cut_seconds: Option<f64>,
    /// True when the cut fell between words.
    pub at_word: bool,
}

pub fn valid_cap(seconds: f64) -> bool {
    seconds.is_finite() && (MIN_CAP_SECONDS..=MAX_CAP_SECONDS).contains(&seconds)
}

/// Maps a time on the natural line to a time on the sped-up line.
struct Warp {
    constant: Option<f64>,
    natural: f64,
    /// Sped-up seconds at evenly spaced natural times, for a changing speed.
    table: Vec<f64>,
    end_speed: f64,
}

const WARP_STEPS: usize = 2048;

impl Warp {
    fn constant(speed: f64, natural: f64) -> Self {
        Self {
            constant: Some(1.0 / speed),
            natural,
            table: Vec::new(),
            end_speed: speed,
        }
    }

    fn ramped(speed_up: &SpeedUp, peak: f64, natural: f64) -> Self {
        let mut table = Vec::with_capacity(WARP_STEPS + 1);
        let mut at = 0.0;
        table.push(at);
        for i in 0..WARP_STEPS {
            let u = (i as f64 + 0.5) / WARP_STEPS as f64;
            at += natural / WARP_STEPS as f64 / speed_up.speed_at(peak, u);
            table.push(at);
        }
        Self {
            constant: None,
            natural,
            table,
            end_speed: speed_up.speed_at(peak, 1.0),
        }
    }

    /// Seconds in, seconds out.
    fn map(&self, seconds: f64) -> f64 {
        if let Some(k) = self.constant {
            return seconds * k;
        }
        if seconds >= self.natural {
            return self.table[WARP_STEPS] + (seconds - self.natural) / self.end_speed;
        }
        let x = seconds.max(0.0) / self.natural * WARP_STEPS as f64;
        let i = (x as usize).min(WARP_STEPS - 1);
        self.table[i] + (self.table[i + 1] - self.table[i]) * (x - i as f64)
    }

    /// The sped-up start and length of something that starts at `start` and lasts `length`.
    fn span(&self, start: f64, length: f64) -> (f64, f64) {
        match self.constant {
            Some(k) => (start * k, length * k),
            None => {
                let from = self.map(start);
                (from, self.map(start + length) - from)
            }
        }
    }

    fn ms(&self, ms: f64) -> f64 {
        match self.constant {
            Some(k) => ms * k,
            None => self.map(ms / 1000.0) * 1000.0,
        }
    }
}

/// The line's duration at a given peak speed.
fn ramped_duration(speed_up: &SpeedUp, peak: f64, natural: f64) -> f64 {
    let mut at = 0.0;
    for i in 0..WARP_STEPS {
        let u = (i as f64 + 0.5) / WARP_STEPS as f64;
        at += natural / WARP_STEPS as f64 / speed_up.speed_at(peak, u);
    }
    at
}

/// The warp and what it did. `None` when the line already fits.
fn plan(natural: f64, cap: f64, speed_up: &SpeedUp) -> Option<(Warp, Fit)> {
    if natural <= cap {
        return None;
    }
    let max = speed_up.max;
    if speed_up.profile == SpeedProfile::Constant {
        let needed = natural / cap;
        let speed = needed.min(max);
        return Some((
            Warp::constant(speed, natural),
            Fit {
                natural_seconds: natural,
                speed,
                peak_speed: speed,
                truncated: needed > max,
                cut_seconds: None,
                at_word: false,
            },
        ));
    }
    let truncated = ramped_duration(speed_up, max, natural) > cap;
    let peak = if truncated {
        max
    } else {
        // The duration falls as the peak rises, so bisect for the peak that lands on the cap.
        let (mut low, mut high) = (1.0, max);
        for _ in 0..60 {
            let mid = 0.5 * (low + high);
            if ramped_duration(speed_up, mid, natural) > cap {
                low = mid;
            } else {
                high = mid;
            }
        }
        high
    };
    let warp = Warp::ramped(speed_up, peak, natural);
    Some((
        warp,
        Fit {
            natural_seconds: natural,
            speed: natural / ramped_duration(speed_up, peak, natural),
            peak_speed: peak,
            truncated,
            cut_seconds: None,
            at_word: false,
        },
    ))
}

/// The words of a phoneme script: runs of sounds with a pause on each side. A script
/// has no other notion of a word. Each range is a byte range of the script.
pub fn pause_separated_words(score: &Score) -> Vec<(usize, usize)> {
    let mut words: Vec<(usize, usize)> = Vec::new();
    let mut open = false;
    for segment in &score.segments {
        if segment.phoneme.is_none() {
            open = false;
        } else if open {
            if let Some(word) = words.last_mut() {
                word.1 = segment.src_end;
            }
        } else {
            words.push((segment.src_start, segment.src_end));
            open = true;
        }
    }
    words
}

/// The end of the last word that finishes by `limit`, given each word's end time.
fn last_whole_word(ends: impl Iterator<Item = f64>, limit: f64) -> Option<f64> {
    ends.filter(|end| *end <= limit).fold(None, |best, end| {
        Some(best.map_or(end, |b: f64| b.max(end)))
    })
}

/// Fit a score. `words` are the byte ranges of its words in the phoneme source; they
/// are used only to cut between words.
pub fn fit_score(
    score: &Score,
    cap_seconds: f64,
    options: &FitOptions,
    words: &[(usize, usize)],
) -> Option<(Score, Fit)> {
    let speed_up = &options.speed_up;
    let (warp, mut fit) = plan(score.duration_seconds(), cap_seconds, speed_up)?;
    let cap_ms = cap_seconds * 1000.0;
    let mut fitted = score.clone();
    for event in &mut fitted.events {
        let (at, transition) = warp.span(event.at_ms / 1000.0, event.transition_ms / 1000.0);
        (event.at_ms, event.transition_ms) = match warp.constant {
            // A steady speed-up keeps the original arithmetic, so its output does not change.
            Some(k) => (event.at_ms * k, event.transition_ms * k),
            None => (at * 1000.0, transition * 1000.0),
        };
    }
    for segment in &mut fitted.segments {
        match warp.constant {
            Some(k) => {
                segment.start_seconds *= k;
                segment.end_seconds *= k;
            }
            None => {
                segment.start_seconds = warp.map(segment.start_seconds);
                segment.end_seconds = warp.map(segment.end_seconds);
            }
        }
    }
    let would_take = warp.map(score.duration_seconds());
    let word_cut = (fit.truncated && options.cut_at == CutAt::Word)
        .then(|| {
            let ends = words.iter().filter_map(|&(from, to)| {
                fitted
                    .segments
                    .iter()
                    .filter(|s| s.phoneme.is_some() && (from..to).contains(&s.src_start))
                    .map(|s| s.end_seconds)
                    .reduce(f64::max)
            });
            last_whole_word(ends, cap_seconds)
        })
        .flatten();
    fitted.total_ms = warp.ms(score.total_ms).min(cap_ms);
    match word_cut {
        Some(cut) => {
            // The line ends where the last whole word ends; the fade then shapes that ending.
            let cut_ms = cut * 1000.0;
            fitted.events.retain(|e| e.at_ms + 1e-6 < cut_ms);
            fitted.total_ms = cut_ms.min(cap_ms);
            fitted.segments.retain(|s| s.start_seconds + 1e-9 < cut);
            for segment in &mut fitted.segments {
                segment.end_seconds = segment.end_seconds.min(cut);
            }
            fit.cut_seconds = Some(cut);
            fit.at_word = true;
            fitted.warnings.push(format!(
                "Cut after a whole word at {cut:.2} s to fit {cap_seconds} s: the line would take {would_take:.2} s even sped up {}×",
                speed_up.max
            ));
        }
        None => {
            fitted.events.retain(|e| e.at_ms < cap_ms || !fit.truncated);
            fitted
                .segments
                .retain(|s| s.start_seconds < cap_seconds || !fit.truncated);
            for segment in &mut fitted.segments {
                segment.end_seconds = segment.end_seconds.min(cap_seconds);
            }
            if fit.truncated {
                fit.cut_seconds = Some(cap_seconds);
                let reason = if options.cut_at == CutAt::Word {
                    format!(
                        "No whole word fits within {cap_seconds} s, so the line is cut mid-word. "
                    )
                } else {
                    String::new()
                };
                fitted.warnings.push(format!(
                    "{reason}Cut at {cap_seconds} s: the line would take {would_take:.2} s even sped up {}×",
                    speed_up.max
                ));
            }
        }
    }
    Some((fitted, fit))
}

pub fn fit_instrument(
    score: &InstrumentScore,
    cap_seconds: f64,
    options: &FitOptions,
) -> Option<(InstrumentScore, Fit)> {
    let (warp, mut fit) = plan(score.duration_seconds, cap_seconds, &options.speed_up)?;
    let mut fitted = score.clone();
    for note in &mut fitted.notes {
        (note.start_seconds, note.duration_seconds) =
            warp.span(note.start_seconds, note.duration_seconds);
    }
    fitted.duration_seconds = warp.map(score.duration_seconds).min(cap_seconds);
    if !fit.truncated {
        return Some((fitted, fit));
    }
    // Consecutive notes with the same source range are one word.
    let mut words: Vec<(usize, usize, f64)> = Vec::new();
    for (i, note) in fitted.notes.iter().enumerate() {
        let end = note.start_seconds + note.duration_seconds;
        match words.last_mut() {
            Some(word) if fitted.notes[word.0].src_start == note.src_start => {
                word.1 = i;
                word.2 = word.2.max(end);
            }
            _ => words.push((i, i, end)),
        }
    }
    let whole = (options.cut_at == CutAt::Word)
        .then(|| {
            words
                .iter()
                .rfind(|w| w.2 <= cap_seconds)
                .map(|w| (w.1, w.2))
        })
        .flatten();
    match whole {
        Some((last_note, cut)) => {
            fitted.notes.truncate(last_note + 1);
            fitted.duration_seconds = cut;
            fit.cut_seconds = Some(cut);
            fit.at_word = true;
        }
        None => {
            fitted.notes.retain(|n| n.start_seconds < cap_seconds);
            for note in &mut fitted.notes {
                note.duration_seconds = note.duration_seconds.min(cap_seconds - note.start_seconds);
            }
            fit.cut_seconds = Some(cap_seconds);
        }
    }
    Some((fitted, fit))
}

/// Drop any audio past `floor(cap * sample_rate)` samples. A line that fits in
/// seconds can still round up to one sample more.
pub fn trim_to_cap(audio: &mut Vec<f32>, sample_rate: f64, cap_seconds: f64) {
    audio.truncate((cap_seconds * sample_rate).floor() as usize);
}

/// Make rendered audio obey the cap to the sample, and fade a cut.
pub fn settle_audio(
    audio: &mut Vec<f32>,
    sample_rate: f64,
    cap_seconds: f64,
    fit: &Fit,
    options: &FitOptions,
) {
    let fade = &options.cut_fade;
    let end = fit
        .cut_seconds
        .map_or(cap_seconds, |cut| cut.min(cap_seconds));
    trim_to_cap(audio, sample_rate, end);
    if !options.volume.is_flat() {
        let n = audio.len().max(1) as f64;
        for (i, sample) in audio.iter_mut().enumerate() {
            let gain = options.volume.gain((i as f64 + 0.5) / n);
            *sample = (*sample * gain).clamp(-1.0, 1.0);
        }
    }
    if fit.truncated && fade.curve != FadeCurve::None && fade.milliseconds > 0.0 {
        let length = (fade.milliseconds / 1000.0 * sample_rate) as usize;
        let start = audio.len() - length.clamp(1, audio.len().max(1)).min(audio.len());
        let tail = audio.len() - start;
        for (i, sample) in audio[start..].iter_mut().enumerate() {
            *sample *= fade.gain((i + 1) as f32 / tail as f32);
        }
    }
}
