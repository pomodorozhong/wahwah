//! English rhythm with invented syllables. The same word, style and seed have
//! the same sounds; position and mood vary its melody. Source ranges are UTF-8
//! bytes, converted to UTF-16 only at the browser boundary.

use crate::ScoreOptions;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Style {
    pub id: String,
    pub name: String,
    pub onsets: Vec<(String, f64)>,
    pub vowels: Vec<(String, f64)>,
    pub codas: Vec<(String, f64)>,
    pub coda_chance: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mood {
    pub id: String,
    pub name: String,
    pub pitch_scale: f64,
    pub rate_scale: f64,
    pub liveliness: f64,
    pub stress_lift: f64,
    pub question_rise: f64,
    pub exclaim_rise: f64,
    pub statement_fall: f64,
    pub vibrato_depth: f64,
    pub aspiration: f64,
    pub effort: f64,
    pub tilt: f64,
}

impl Mood {
    pub fn voice(&self, base: &ScoreOptions) -> ScoreOptions {
        ScoreOptions {
            base_f0: base.base_f0 * self.pitch_scale,
            rate: base.rate * self.rate_scale,
            vibrato_depth: self.vibrato_depth,
            aspiration: self.aspiration,
            effort: self.effort,
            tilt: self.tilt,
            ..base.clone()
        }
    }
}

#[derive(Deserialize)]
pub struct Presets {
    pub styles: Vec<Style>,
    pub moods: Vec<Mood>,
}

pub fn presets() -> &'static Presets {
    static PRESETS: OnceLock<Presets> = OnceLock::new();
    PRESETS.get_or_init(|| {
        serde_json::from_str(include_str!("../../../data/mumble-presets.json"))
            .expect("checked-in Mumble presets are valid")
    })
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MumbleOptions {
    pub seed: u32,
    pub style_id: String,
    pub mood_id: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MumbleWord {
    pub text: String,
    pub src_start: usize,
    pub src_end: usize,
    pub out_start: usize,
    pub out_end: usize,
    pub spelled: String,
}

#[derive(Serialize)]
pub struct MumbleScript {
    pub phonemes: String,
    pub words: Vec<MumbleWord>,
    pub style: Style,
    pub mood: Mood,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TextToken<'a> {
    Word {
        text: &'a str,
        start: usize,
        end: usize,
    },
    Break {
        mark: char,
        tone: Tone,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Tone {
    None,
    Statement,
    Question,
    Exclaim,
}

pub fn tokenize_text(text: &str) -> Vec<TextToken<'_>> {
    let mut tokens = Vec::new();
    let mut i = 0;
    let bytes = text.as_bytes();
    while i < text.len() {
        let tail = &text[i..];
        if let Some(mark) = ["...", "…", "—", "–", "--"]
            .iter()
            .find(|mark| tail.starts_with(**mark))
        {
            tokens.push(TextToken::Break {
                mark: ';',
                tone: Tone::None,
            });
            i += mark.len();
        } else if bytes[i].is_ascii_alphanumeric() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_alphanumeric() {
                i += 1;
            }
            loop {
                let apostrophe = if text[i..].starts_with("’") {
                    3
                } else if text[i..].starts_with("'") {
                    1
                } else {
                    0
                };
                if apostrophe == 0
                    || !bytes
                        .get(i + apostrophe)
                        .is_some_and(u8::is_ascii_alphabetic)
                {
                    break;
                }
                i += apostrophe;
                while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
                    i += 1;
                }
            }
            tokens.push(TextToken::Word {
                text: &text[start..i],
                start,
                end: i,
            });
        } else if b".!?".contains(&bytes[i]) {
            let start = i;
            while i < bytes.len() && b".!?".contains(&bytes[i]) {
                i += 1;
            }
            let mark = &text[start..i];
            let tone = if mark.contains('?') {
                Tone::Question
            } else if mark.contains('!') {
                Tone::Exclaim
            } else {
                Tone::Statement
            };
            tokens.push(TextToken::Break { mark: '.', tone });
        } else if b",;:".contains(&bytes[i]) {
            i += 1;
            tokens.push(TextToken::Break {
                mark: ',',
                tone: Tone::None,
            });
        } else if bytes[i] == b'\n' {
            while i < bytes.len() && bytes[i] == b'\n' {
                i += 1;
            }
            tokens.push(TextToken::Break {
                mark: '.',
                tone: Tone::Statement,
            });
        } else {
            i += tail.chars().next().expect("nonempty tail").len_utf8();
        }
    }
    tokens
}

fn vowel(c: u8) -> bool {
    b"aeiouy".contains(&c)
}

/// English heuristics, deliberately independent of pronunciation dictionaries.
pub fn count_syllables(word: &str) -> usize {
    let letters: Vec<u8> = word
        .bytes()
        .filter(u8::is_ascii_alphabetic)
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let n = letters.len();
    if n == 0 {
        return word
            .bytes()
            .filter(u8::is_ascii_digit)
            .count()
            .div_ceil(2)
            .max(1);
    }
    if n <= 3 {
        return 1;
    }
    let mut count = 0i32;
    for (i, c) in letters.iter().enumerate() {
        if vowel(*c) && (i == 0 || !vowel(letters[i - 1])) {
            count += 1;
        }
    }
    if count == 0 {
        count = 1;
    }
    if letters.ends_with(b"e")
        && !vowel(letters[n - 2])
        && !(letters.ends_with(b"le") && !vowel(letters[n - 3]))
    {
        count -= 1;
    }
    if letters.ends_with(b"ed") && !vowel(letters[n - 3]) && !b"td".contains(&letters[n - 3]) {
        count -= 1;
    }
    if letters.ends_with(b"es")
        && !vowel(letters[n - 3])
        && !b"sxzh".contains(&letters[n - 3])
        && !letters.ends_with(b"ches")
        && !letters.ends_with(b"shes")
    {
        count -= 1;
    }
    count.max(1) as usize
}

pub fn stress_index(word: &str, syllables: usize) -> Option<usize> {
    let word = word.to_ascii_lowercase();
    let base = word.split(['\'', '’']).next().unwrap_or(&word);
    const FUNCTION_WORDS: &str = "a an the and or but so if of to in on at by for with from as is am are was were be been it its i me my you your he him his she her we us our they them their this that these those not no do does did has have had will would can could should shall may might must there here than then just";
    if FUNCTION_WORDS.split_whitespace().any(|w| w == base) {
        return None;
    }
    let suffix = |suffixes: &[&str]| suffixes.iter().any(|s| word.ends_with(s));
    Some(if syllables <= 2 {
        0
    } else if suffix(&["tion", "sion", "cian", "ic", "ics", "ial", "ian", "ious"]) {
        syllables - 2
    } else if suffix(&["ity", "ical", "ify", "ogy", "aphy"]) {
        syllables - 3
    } else if suffix(&["ee", "eer", "ese", "ette", "oon"]) {
        syllables - 1
    } else {
        0
    })
}

fn hash(text: &str) -> u32 {
    text.bytes().fold(0x811c9dc5u32, |h, b| {
        (h ^ u32::from(b)).wrapping_mul(0x01000193)
    })
}

struct Random(u32);
impl Random {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let mut t = (self.0 ^ (self.0 >> 15)).wrapping_mul(self.0 | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4294967296.0
    }
    fn pick<'a>(&mut self, items: &'a [(String, f64)], require_onset: bool) -> &'a str {
        let filtered = || {
            items
                .iter()
                .filter(|(s, _)| !require_onset || !s.is_empty())
        };
        let mut x = self.next() * filtered().map(|(_, w)| w).sum::<f64>();
        for (code, weight) in filtered() {
            x -= weight;
            if x < 0.0 {
                return code;
            }
        }
        &items.last().expect("nonempty inventory").0
    }
}

struct Syllable {
    onset: String,
    vowel: String,
    coda: String,
    stressed: bool,
    glide: f64,
}
struct Word<'a> {
    text: &'a str,
    start: usize,
    end: usize,
    syllables: Vec<Syllable>,
}
enum Item<'a> {
    Word(Word<'a>),
    Pause(char),
}

fn invent_word(word: &str, style: &Style, seed: u32) -> Vec<Syllable> {
    let n = count_syllables(word);
    let stress = stress_index(word, n);
    let mut rng = Random(hash(&format!(
        "{seed}|{}|{}",
        style.id,
        word.to_lowercase()
    )));
    let mut syllables: Vec<Syllable> = Vec::with_capacity(n);
    for i in 0..n {
        let mut onset = rng.pick(&style.onsets, false).to_owned();
        if onset.is_empty() && syllables.last().is_some_and(|s| s.coda.is_empty()) {
            onset = rng.pick(&style.onsets, true).to_owned();
        }
        let vowel = rng.pick(&style.vowels, false).to_owned();
        let coda = if rng.next() < style.coda_chance {
            rng.pick(&style.codas, false).to_owned()
        } else {
            String::new()
        };
        syllables.push(Syllable {
            onset,
            vowel,
            coda,
            stressed: stress == Some(i),
            glide: 0.0,
        });
    }
    syllables
}

fn close_phrase(items: &mut [Item<'_>], tone: Tone, mood: &Mood) {
    let Some(Item::Word(word)) = items.last_mut() else {
        return;
    };
    let last = word.syllables.len() - 1;
    let index = if tone == Tone::Exclaim {
        word.syllables
            .iter()
            .position(|s| s.stressed)
            .unwrap_or(last)
    } else {
        last
    };
    let glide = match tone {
        Tone::Question => mood.question_rise,
        Tone::Statement => mood.statement_fall,
        Tone::Exclaim => mood.exclaim_rise,
        Tone::None => return,
    };
    word.syllables[index].glide = glide;
}

fn spelling(code: &str) -> String {
    match code {
        "AA" | "AE" => "a",
        "AH" | "UW" => "u",
        "AO" => "aw",
        "AW" => "ow",
        "AY" => "ai",
        "EH" => "e",
        "ER" => "er",
        "EY" => "ay",
        "IH" => "i",
        "IY" => "ee",
        "OW" => "o",
        "OY" => "oy",
        "UH" => "oo",
        "CH" => "ch",
        "HH" => "h",
        "JH" => "j",
        "NG" => "ng",
        "SH" => "sh",
        "TH" | "DH" => "th",
        "ZH" => "zh",
        "Y" => "y",
        _ => return code.to_lowercase(),
    }
    .into()
}

pub fn generate_mumble(text: &str, options: &MumbleOptions) -> MumbleScript {
    let presets = presets();
    let style = presets
        .styles
        .iter()
        .find(|s| s.id == options.style_id)
        .unwrap_or(&presets.styles[0]);
    let mood = presets
        .moods
        .iter()
        .find(|m| m.id == options.mood_id)
        .unwrap_or(&presets.moods[0]);
    let mut items = Vec::new();
    let mut word_count = 0;
    for token in tokenize_text(text) {
        match token {
            TextToken::Word { text, start, end } => {
                let mut syllables = invent_word(text, style, options.seed);
                let mut wobble = Random(hash(&format!("{}|melody|{word_count}", options.seed)));
                for s in &mut syllables {
                    s.glide = (wobble.next() * 2.0 - 1.0) * mood.liveliness
                        + if s.stressed { mood.stress_lift } else { 0.0 };
                }
                items.push(Item::Word(Word {
                    text,
                    start,
                    end,
                    syllables,
                }));
                word_count += 1;
            }
            TextToken::Break { mark, tone } => {
                close_phrase(&mut items, tone, mood);
                match items.last_mut() {
                    Some(Item::Pause(previous))
                        if *previous == ',' || (*previous == ';' && mark == '.') =>
                    {
                        *previous = mark
                    }
                    Some(Item::Pause(_)) | None => (),
                    _ => items.push(Item::Pause(mark)),
                }
            }
        }
    }
    close_phrase(&mut items, Tone::Statement, mood);
    let mut script = MumbleScript {
        phonemes: String::new(),
        words: Vec::new(),
        style: style.clone(),
        mood: mood.clone(),
    };
    for item in items {
        if !script.phonemes.is_empty() {
            script.phonemes.push(' ');
        }
        match item {
            Item::Pause(mark) => script.phonemes.push(mark),
            Item::Word(word) => {
                let start = script.phonemes.len();
                let mut tokens = Vec::new();
                let mut spelled = Vec::new();
                for s in word.syllables {
                    if !s.onset.is_empty() {
                        tokens.push(s.onset.clone());
                    }
                    // Round once, so the script is easy to inspect and repeatable.
                    let glide = s.glide.round() as i32;
                    tokens.push(format!(
                        "{}{}{}",
                        s.vowel,
                        if s.stressed { "'" } else { "" },
                        if glide == 0 {
                            String::new()
                        } else {
                            format!("({glide:+})")
                        }
                    ));
                    if !s.coda.is_empty() {
                        tokens.push(s.coda.clone());
                    }
                    let letters = format!(
                        "{}{}{}",
                        spelling(&s.onset),
                        spelling(&s.vowel),
                        spelling(&s.coda)
                    );
                    spelled.push(if s.stressed {
                        letters.to_uppercase()
                    } else {
                        letters
                    });
                }
                script.phonemes.push_str(&tokens.join(" "));
                script.words.push(MumbleWord {
                    text: word.text.into(),
                    src_start: word.start,
                    src_end: word.end,
                    out_start: start,
                    out_end: script.phonemes.len(),
                    spelled: spelled.join("-"),
                });
            }
        }
    }
    script
}
