//! Phoneme scripts to a timed score of synthesis targets.
//!
//! The script language and timing rules come from klattsch (see
//! THIRD_PARTY_NOTICES.md). Words are whitespace-separated: ARPABET phonemes
//! with optional stress and pitch marks, pause marks, `( )` syllable groups,
//! compact directives such as `b+10` or `p200`, and bracket directives such as
//! `[rate=90]`.

use crate::bank::{Phoneme, phoneme};

const STRESS_DURATION_FACTOR: f64 = 1.5;
const STRESS_F0_LIFT: f64 = 8.0;
const STOP_BURST_MS: f64 = 25.0;
const DEFAULT_TRANSITION_MS: f64 = 35.0;
const SILENCE_TRANSITION_MS: f64 = 30.0;
const FADE_OUT_MS: f64 = 100.0;
const TRAIL_OFF_MS: f64 = 150.0;

#[derive(Clone, Debug)]
pub struct ScoreOptions {
    pub base_f0: f64,
    /// Milliseconds per phoneme. Lower is faster.
    pub rate: f64,
    pub scale: f64,
    pub vibrato_depth: f64,
    pub vibrato_rate: f64,
    pub tremolo_depth: f64,
    pub tremolo_rate: f64,
    pub aspiration: f64,
    pub tilt: f64,
    pub effort: f64,
}

impl Default for ScoreOptions {
    fn default() -> Self {
        Self {
            base_f0: 120.0,
            rate: 110.0,
            scale: 1.0,
            vibrato_depth: 0.0,
            vibrato_rate: 5.0,
            tremolo_depth: 0.0,
            tremolo_rate: 5.0,
            aspiration: 0.0,
            tilt: 0.0,
            effort: 0.5,
        }
    }
}

/// What a sounding target sets. Silence fades the amplitudes and leaves these
/// at their previous values.
#[derive(Clone, Debug)]
pub struct Sound {
    pub f0: f64,
    pub voicing: f64,
    pub f1: f64,
    pub f2: f64,
    pub f3: f64,
    pub bw1: f64,
    pub bw2: f64,
    pub bw3: f64,
    pub is_stop: bool,
}

#[derive(Clone, Debug)]
pub struct Target {
    pub sound: Option<Sound>,
    pub a1: f64,
    pub a2: f64,
    pub a3: f64,
    pub vibrato_depth: f64,
    pub vibrato_rate: f64,
    pub tremolo_depth: f64,
    pub tremolo_rate: f64,
    pub aspiration: f64,
    pub tilt: f64,
    pub effort: f64,
}

#[derive(Clone, Debug)]
pub struct Event {
    pub at_ms: f64,
    pub transition_ms: f64,
    pub target: Target,
}

/// One audible sound or pause. Source offsets are UTF-8 byte ranges.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    /// ARPABET code, or `None` for a pause.
    pub phoneme: Option<String>,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub src_start: usize,
    pub src_end: usize,
}

#[derive(Clone, Debug)]
pub struct Score {
    pub events: Vec<Event>,
    pub total_ms: f64,
    pub segments: Vec<Segment>,
    pub warnings: Vec<String>,
}

impl Score {
    pub fn duration_seconds(&self) -> f64 {
        self.total_ms / 1000.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Key {
    Base,
    Rate,
    Pause,
    Scale,
    Vibrato,
    VibratoRate,
    Tremolo,
    TremoloRate,
    Aspiration,
    Tilt,
    Effort,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Change {
    Reset,
    Set(f64),
    Add(f64),
}

#[derive(Clone, Debug, PartialEq)]
enum Kind {
    SyllableOpen,
    SyllableClose,
    Pause(f64),
    StressMark,
    Directive(Key, Change),
    UnknownDirective(String),
    Phoneme {
        code: String,
        stressed: bool,
        pitch_delta: f64,
        transient: bool,
    },
    Unknown(String),
}

struct Token {
    kind: Kind,
    src_start: usize,
    src_end: usize,
}

/// Digits with an optional fraction, the only unsigned number form scripts use.
fn parse_number(text: &str) -> Option<f64> {
    let (whole, fraction) = match text.split_once('.') {
        Some((whole, fraction)) => (whole, Some(fraction)),
        None => (text, None),
    };
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    if !digits(whole) || !fraction.is_none_or(digits) {
        return None;
    }
    text.parse().ok()
}

fn parse_signed(text: &str) -> Option<(f64, Option<char>)> {
    let sign = text.chars().next().filter(|c| matches!(c, '+' | '-'));
    let unsigned = if sign.is_some() { &text[1..] } else { text };
    let value = parse_number(unsigned)?;
    Some((if sign == Some('-') { -value } else { value }, sign))
}

/// Note names such as `C4`, `C#5`, `Db3` or `A-1`, in Hz.
fn note_to_hz(name: &str) -> Option<f64> {
    let mut chars = name.chars();
    let semitone = match chars.next()? {
        'C' => 0,
        'D' => 2,
        'E' => 4,
        'F' => 5,
        'G' => 7,
        'A' => 9,
        'B' => 11,
        _ => return None,
    };
    let rest = chars.as_str();
    let (accidental, octave) = match rest.chars().next()? {
        '#' => (1, &rest[1..]),
        'b' => (-1, &rest[1..]),
        _ => (0, rest),
    };
    let octave: i32 = octave.parse().ok()?;
    let midi = (octave + 1) * 12 + semitone + accidental;
    Some(440.0 * 2f64.powf(f64::from(midi - 69) / 12.0))
}

fn letter_key(letter: char) -> Option<Key> {
    Some(match letter {
        'b' => Key::Base,
        'r' => Key::Rate,
        'p' => Key::Pause,
        's' => Key::Scale,
        'v' => Key::Vibrato,
        'w' => Key::VibratoRate,
        'm' => Key::Tremolo,
        'n' => Key::TremoloRate,
        'h' => Key::Aspiration,
        't' => Key::Tilt,
        'g' => Key::Effort,
        _ => return None,
    })
}

fn named_key(name: &str) -> Option<Key> {
    Some(match name {
        "base" | "pitch" => Key::Base,
        "rate" => Key::Rate,
        "pause" => Key::Pause,
        "scale" => Key::Scale,
        "vibrato" => Key::Vibrato,
        "vibratoRate" => Key::VibratoRate,
        "tremolo" => Key::Tremolo,
        "tremoloRate" => Key::TremoloRate,
        "aspiration" => Key::Aspiration,
        "tilt" => Key::Tilt,
        "effort" => Key::Effort,
        _ => return None,
    })
}

fn classify_bracket(part: &str) -> Option<Kind> {
    let inner = part.strip_prefix('[')?.strip_suffix(']')?;
    let (name, value) = inner.split_once('=')?;
    if name.is_empty() || !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return None;
    }
    let (value, sign) = parse_signed(value)?;
    if sign == Some('+') {
        return None;
    }
    Some(match named_key(name) {
        Some(key) => Kind::Directive(key, Change::Set(value)),
        None => Kind::UnknownDirective(name.to_string()),
    })
}

fn classify_note(part: &str) -> Option<Kind> {
    let name = part.strip_prefix('b')?;
    let name = name.strip_prefix('=').unwrap_or(name);
    Some(Kind::Directive(Key::Base, Change::Set(note_to_hz(name)?)))
}

/// `Ok(None)` is a word that says nothing: a bare `p` has no length to pause.
fn classify_compact(part: &str) -> Result<Option<Kind>, ()> {
    let mut chars = part.chars();
    let letter = chars.next().ok_or(())?;
    let key = letter_key(letter).ok_or(())?;
    let rest = chars.as_str();
    if rest.is_empty() {
        return Ok((key != Key::Pause).then_some(Kind::Directive(key, Change::Reset)));
    }
    let (equals, value) = match rest.strip_prefix('=') {
        Some(value) => (true, value),
        None => (false, rest),
    };
    let (value, sign) = parse_signed(value).ok_or(())?;
    let change = if !equals && sign.is_some() {
        Change::Add(value)
    } else {
        Change::Set(value)
    };
    Ok(Some(Kind::Directive(key, change)))
}

fn classify_phoneme(part: &str) -> Option<Kind> {
    let code_end = part
        .find(|c: char| !c.is_ascii_uppercase())
        .unwrap_or(part.len());
    if code_end == 0 {
        return None;
    }
    let (code, mut rest) = part.split_at(code_end);
    let stressed = rest.starts_with(['\'', '!']);
    if stressed {
        rest = &rest[1..];
    }
    let (pitch_delta, transient) = if rest.is_empty() {
        (0.0, false)
    } else if let Some(inner) = rest.strip_prefix('(').and_then(|r| r.strip_suffix(')')) {
        let (value, sign) = parse_signed(inner)?;
        sign?;
        (value, true)
    } else {
        let (value, sign) = parse_signed(rest)?;
        sign?;
        (value, false)
    };
    Some(Kind::Phoneme {
        code: code.to_string(),
        stressed,
        pitch_delta,
        transient,
    })
}

fn classify(part: &str) -> Option<Kind> {
    match part {
        "(" => return Some(Kind::SyllableOpen),
        ")" => return Some(Kind::SyllableClose),
        "," => return Some(Kind::Pause(100.0)),
        ";" => return Some(Kind::Pause(200.0)),
        "." => return Some(Kind::Pause(300.0)),
        "!" | "'" => return Some(Kind::StressMark),
        _ => {}
    }
    if let Some(kind) = classify_bracket(part).or_else(|| classify_note(part)) {
        return Some(kind);
    }
    if let Ok(kind) = classify_compact(part) {
        return kind;
    }
    Some(classify_phoneme(part).unwrap_or_else(|| Kind::Unknown(part.to_string())))
}

fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens: Vec<Token> = Vec::new();
    let block_end = |start: usize| {
        source[start + 2..]
            .find("*/")
            .map_or(source.len(), |end| start + 2 + end + 2)
    };
    let mut i = 0;
    while let Some(c) = source[i..].chars().next() {
        if c.is_whitespace() {
            i += c.len_utf8();
            continue;
        }
        let at_boundary = source[..i]
            .chars()
            .next_back()
            .is_none_or(char::is_whitespace);
        if c == '#' && at_boundary {
            i = source[i..].find('\n').map_or(source.len(), |end| i + end);
            continue;
        }
        if source[i..].starts_with("/*") {
            i = block_end(i);
            continue;
        }

        let src_start = i;
        let mut part = String::new();
        while let Some(c) = source[i..].chars().next() {
            if c.is_whitespace() {
                break;
            }
            if source[i..].starts_with("/*") {
                i = block_end(i);
                continue;
            }
            part.push(c);
            i += c.len_utf8();
        }
        if part.is_empty() {
            continue;
        }
        let Some(kind) = classify(&part) else {
            continue;
        };
        if kind == Kind::StressMark {
            let previous = tokens.iter_mut().rev().find_map(|t| match &mut t.kind {
                Kind::Phoneme { stressed, .. } => Some(stressed),
                _ => None,
            });
            if let Some(stressed) = previous {
                *stressed = true;
            }
            continue;
        }
        tokens.push(Token {
            kind,
            src_start,
            src_end: i,
        });
    }
    tokens
}

struct PhonemeToken<'a> {
    code: &'a str,
    stressed: bool,
    pitch_delta: f64,
    transient: bool,
    src_start: usize,
    src_end: usize,
}

struct Compiler {
    options: ScoreOptions,
    f0: f64,
    rate: f64,
    scale: f64,
    vibrato: f64,
    vibrato_rate: f64,
    tremolo: f64,
    tremolo_rate: f64,
    aspiration: f64,
    tilt: f64,
    effort: f64,
    time_ms: f64,
    segment_start_ms: f64,
    events: Vec<Event>,
    segments: Vec<Segment>,
    warnings: Vec<String>,
}

impl Compiler {
    fn new(options: &ScoreOptions) -> Self {
        Self {
            options: options.clone(),
            f0: options.base_f0,
            rate: options.rate,
            scale: options.scale,
            vibrato: options.vibrato_depth,
            vibrato_rate: options.vibrato_rate,
            tremolo: options.tremolo_depth,
            tremolo_rate: options.tremolo_rate,
            aspiration: options.aspiration,
            tilt: options.tilt,
            effort: options.effort,
            time_ms: 0.0,
            segment_start_ms: 0.0,
            events: Vec::new(),
            segments: Vec::new(),
            warnings: Vec::new(),
        }
    }

    fn emit(&mut self, sound: Option<Sound>, amps: (f64, f64, f64), transition_ms: f64) {
        self.events.push(Event {
            at_ms: self.time_ms,
            transition_ms,
            target: Target {
                sound,
                a1: amps.0,
                a2: amps.1,
                a3: amps.2,
                vibrato_depth: self.vibrato,
                vibrato_rate: self.vibrato_rate,
                tremolo_depth: self.tremolo,
                tremolo_rate: self.tremolo_rate,
                aspiration: self.aspiration,
                tilt: self.tilt,
                effort: self.effort,
            },
        });
    }

    fn silence(&mut self, transition_ms: f64) {
        self.emit(None, (0.0, 0.0, 0.0), transition_ms);
    }

    fn emit_phoneme(&mut self, p: &Phoneme, f0: f64, glide: bool, transition_ms: f64) {
        let [f1, f2, f3] = match (glide, p.glide_to) {
            (true, Some(end)) => end,
            _ => p.formants,
        };
        let sound = Sound {
            f0,
            voicing: p.voicing,
            f1: f1 * self.scale,
            f2: f2 * self.scale,
            f3: f3 * self.scale,
            bw1: p.bandwidths[0] * self.scale,
            bw2: p.bandwidths[1] * self.scale,
            bw3: p.bandwidths[2] * self.scale,
            is_stop: p.is_stop,
        };
        let [a1, a2, a3] = p.amplitudes;
        self.emit(Some(sound), (a1, a2, a3), transition_ms);
    }

    fn end_segment(&mut self, phoneme: Option<&str>, src_start: usize, src_end: usize) {
        self.segments.push(Segment {
            phoneme: phoneme.map(str::to_string),
            start_seconds: self.segment_start_ms / 1000.0,
            end_seconds: self.time_ms / 1000.0,
            src_start,
            src_end,
        });
        self.segment_start_ms = self.time_ms;
    }

    fn render_phoneme(&mut self, token: &PhonemeToken, slot_ms: f64) {
        if let Some(p) = phoneme(token.code) {
            let start_f0 = if token.stressed {
                self.f0 + STRESS_F0_LIFT
            } else {
                self.f0
            };
            let end_f0 = start_f0 + token.pitch_delta;
            if p.is_stop {
                let burst = STOP_BURST_MS.min(slot_ms * 0.3);
                let closure = slot_ms - burst;
                self.silence(20f64.min(closure * 0.4));
                self.time_ms += closure;
                self.emit_phoneme(p, start_f0, false, 5f64.min(burst * 0.2));
                self.time_ms += burst;
            } else if p.glide_to.is_some() {
                self.emit_phoneme(p, start_f0, false, 20f64.min(slot_ms * 0.25));
                self.time_ms += slot_ms * 0.25;
                self.emit_phoneme(p, end_f0, true, slot_ms * 0.5);
                self.time_ms += slot_ms * 0.75;
            } else if token.pitch_delta != 0.0 {
                self.emit_phoneme(p, start_f0, false, 25f64.min(slot_ms * 0.25));
                self.time_ms += slot_ms * 0.25;
                self.emit_phoneme(p, end_f0, false, slot_ms * 0.6);
                self.time_ms += slot_ms * 0.75;
            } else {
                self.emit_phoneme(p, start_f0, false, DEFAULT_TRANSITION_MS.min(slot_ms * 0.4));
                self.time_ms += slot_ms;
            }
            self.end_segment(Some(token.code), token.src_start, token.src_end);
        } else {
            self.warnings
                .push(format!("unknown phoneme: {}", token.code));
        }
        if !token.transient {
            self.f0 += token.pitch_delta;
        }
    }

    fn directive(&mut self, key: Key, change: Change, token: &Token) {
        if key == Key::Pause {
            if let Change::Set(ms) | Change::Add(ms) = change {
                self.silence(SILENCE_TRANSITION_MS);
                self.time_ms += ms.abs();
                self.end_segment(None, token.src_start, token.src_end);
            }
            return;
        }
        let options = &self.options;
        let (value, initial) = match key {
            Key::Base => (&mut self.f0, options.base_f0),
            Key::Rate => (&mut self.rate, options.rate),
            Key::Scale => (&mut self.scale, options.scale),
            Key::Vibrato => (&mut self.vibrato, options.vibrato_depth),
            Key::VibratoRate => (&mut self.vibrato_rate, options.vibrato_rate),
            Key::Tremolo => (&mut self.tremolo, options.tremolo_depth),
            Key::TremoloRate => (&mut self.tremolo_rate, options.tremolo_rate),
            Key::Aspiration => (&mut self.aspiration, options.aspiration),
            Key::Tilt => (&mut self.tilt, options.tilt),
            Key::Effort => (&mut self.effort, options.effort),
            Key::Pause => unreachable!("handled above"),
        };
        match change {
            Change::Reset => *value = initial,
            Change::Set(v) => *value = v,
            Change::Add(v) => *value += v,
        }
    }

    fn flush_syllable(&mut self, syllable: &mut Vec<PhonemeToken>) {
        if syllable.is_empty() {
            return;
        }
        // A group shares one phoneme's time.
        let slot = self.rate / syllable.len() as f64;
        for token in syllable.drain(..) {
            self.render_phoneme(&token, slot);
        }
    }
}

/// Compile a phoneme script. Problems become warnings, so any text produces a
/// score that can be played.
pub fn compile_score(source: &str, options: &ScoreOptions) -> Score {
    let tokens = tokenize(source);
    let mut compiler = Compiler::new(options);
    let mut in_syllable = false;
    let mut syllable: Vec<PhonemeToken> = Vec::new();

    for token in &tokens {
        match &token.kind {
            Kind::Unknown(text) => compiler.warnings.push(format!("unknown token: {text}")),
            Kind::UnknownDirective(name) => {
                compiler.warnings.push(format!("unknown directive: {name}"));
            }
            Kind::SyllableOpen if in_syllable => compiler.warnings.push("nested ( ignored".into()),
            Kind::SyllableOpen => in_syllable = true,
            Kind::SyllableClose if !in_syllable => compiler.warnings.push("unmatched )".into()),
            Kind::SyllableClose => {
                compiler.flush_syllable(&mut syllable);
                in_syllable = false;
            }
            Kind::Directive(key, change) => compiler.directive(*key, *change, token),
            Kind::Pause(ms) => {
                compiler.silence(SILENCE_TRANSITION_MS);
                compiler.time_ms += ms;
                compiler.end_segment(None, token.src_start, token.src_end);
            }
            Kind::StressMark => unreachable!("applied while tokenizing"),
            Kind::Phoneme {
                code,
                stressed,
                pitch_delta,
                transient,
            } => {
                let phoneme = PhonemeToken {
                    code,
                    stressed: *stressed,
                    pitch_delta: *pitch_delta,
                    transient: *transient,
                    src_start: token.src_start,
                    src_end: token.src_end,
                };
                if in_syllable {
                    syllable.push(phoneme);
                } else {
                    let slot = if *stressed {
                        compiler.rate * STRESS_DURATION_FACTOR
                    } else {
                        compiler.rate
                    };
                    compiler.render_phoneme(&phoneme, slot);
                }
            }
        }
    }
    if in_syllable {
        compiler.warnings.push("unclosed (".into());
        compiler.flush_syllable(&mut syllable);
    }

    compiler.silence(FADE_OUT_MS);
    compiler.time_ms += TRAIL_OFF_MS;
    // The last sound stays current through the fade.
    if let Some(last) = compiler.segments.last_mut() {
        last.end_seconds = compiler.time_ms / 1000.0;
    }

    Score {
        events: compiler.events,
        total_ms: compiler.time_ms,
        segments: compiler.segments,
        warnings: compiler.warnings,
    }
}
