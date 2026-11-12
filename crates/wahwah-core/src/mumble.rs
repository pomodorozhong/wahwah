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

/// How a character is spoken. Scripts without spaces get a word per sound.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Script {
    /// ASCII, plus accented Latin letters.
    Latin,
    /// One Chinese character, one syllable.
    Han,
    /// A Hangul syllable block, or a run of conjoining jamo that spells one, one
    /// syllable.
    Hangul,
    /// A kana, one mora.
    Kana,
    /// Any other letter or digit: Cyrillic, Greek, Arabic, Thai and the rest.
    Other,
}

fn is_latin_letter(c: char) -> bool {
    c.is_ascii_alphabetic()
        || (c.is_alphabetic() && matches!(c as u32, 0xC0..=0x24F | 0x1E00..=0x1EFF))
}

fn script_of(c: char) -> Option<Script> {
    // A mark only joins a word. Some, such as Arabic harakat, count as alphabetic,
    // and would otherwise start a word of their own.
    if is_combining(c) {
        return None;
    }
    if c.is_ascii_digit() || is_latin_letter(c) {
        return Some(Script::Latin);
    }
    Some(match c as u32 {
        0x3400..=0x4DBF
        | 0x4E00..=0x9FFF
        | 0xF900..=0xFAFF
        | 0x20000..=0x323AF
        | 0x3005
        | 0x3007 => Script::Han,
        0x3041..=0x3096 | 0x30A1..=0x30FA | 0x31F0..=0x31FF | 0xFF66..=0xFF9D => Script::Kana,
        0x1100..=0x11FF | 0x3131..=0x318E | 0xAC00..=0xD7AF => Script::Hangul,
        _ if c.is_alphanumeric() => Script::Other,
        _ => return None,
    })
}

/// Conjoining jamo: a leading consonant, a vowel, or a trailing consonant.
fn is_leading_jamo(c: char) -> bool {
    matches!(c as u32, 0x1100..=0x115F)
}

fn is_vowel_jamo(c: char) -> bool {
    matches!(c as u32, 0x1160..=0x11A7)
}

fn is_trailing_jamo(c: char) -> bool {
    matches!(c as u32, 0x11A8..=0x11FF)
}

/// The length in bytes of the Hangul syllable at the start of `text`. One or more
/// leading consonants, then one or more vowels, then any trailing consonants spell
/// one syllable, the same as the precomposed block. Anything else, such as a
/// precomposed block or a stray jamo, is one character.
fn hangul_syllable_len(text: &str) -> usize {
    let first = text.chars().next().map_or(0, char::len_utf8);
    let mut chars = text.char_indices().peekable();
    let mut take = |is: fn(char) -> bool| {
        let mut taken = 0;
        while chars.next_if(|(_, c)| is(*c)).is_some() {
            taken += 1;
        }
        taken
    };
    if take(is_leading_jamo) == 0 || take(is_vowel_jamo) == 0 {
        return first;
    }
    take(is_trailing_jamo);
    chars.peek().map_or(text.len(), |(i, _)| *i)
}

/// Small kana and the long-vowel mark join the mora before them. The sokuon `っ`
/// is a mora of its own.
fn extends_kana(c: char) -> bool {
    matches!(
        c,
        'ゃ' | 'ゅ'
            | 'ょ'
            | 'ャ'
            | 'ュ'
            | 'ョ'
            | 'ぁ'
            | 'ぃ'
            | 'ぅ'
            | 'ぇ'
            | 'ぉ'
            | 'ァ'
            | 'ィ'
            | 'ゥ'
            | 'ェ'
            | 'ォ'
            | 'ー'
            | 'ｰ'
    )
}

/// Marks that attach to the letter before them: accents, Hebrew points, Arabic
/// harakat, and the vowel signs and viragas of the Indic scripts.
fn is_combining(c: char) -> bool {
    matches!(
        c as u32,
        0x0300..=0x036F | 0x0483..=0x0489 | 0x0591..=0x05BD | 0x064B..=0x065F | 0x0670
            | 0x1AB0..=0x1AFF | 0x1DC0..=0x1DFF | 0x20D0..=0x20FF | 0xFE20..=0xFE2F
    ) || (matches!(c as u32, 0x0900..=0x0DFF)
        && !c.is_alphanumeric()
        && !matches!(c as u32, 0x0964 | 0x0965 | 0x0970))
}

fn sentence_end(c: char) -> bool {
    matches!(
        c,
        '.' | '!' | '?' | '。' | '！' | '？' | '．' | '｡' | '؟' | '‼' | '⁇' | '⁈' | '⁉'
    )
}

fn clause_break(c: char) -> bool {
    matches!(
        c,
        ',' | ';' | ':' | '，' | '、' | '；' | '：' | '､' | '،' | '؛'
    )
}

pub fn tokenize_text(text: &str) -> Vec<TextToken<'_>> {
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < text.len() {
        let tail = &text[i..];
        let c = tail.chars().next().expect("nonempty tail");
        if let Some(mark) = ["...", "…", "—", "–", "--", "⋯"]
            .iter()
            .find(|mark| tail.starts_with(**mark))
        {
            tokens.push(TextToken::Break {
                mark: ';',
                tone: Tone::None,
            });
            i += mark.len();
        } else if let Some(script) = script_of(c) {
            let start = i;
            match script {
                Script::Latin => {
                    while let Some(c) = text[i..]
                        .chars()
                        .next()
                        .filter(|c| script_of(*c) == Some(Script::Latin) || is_combining(*c))
                    {
                        i += c.len_utf8();
                    }
                    loop {
                        let apostrophe = if text[i..].starts_with('’') {
                            3
                        } else if text[i..].starts_with('\'') {
                            1
                        } else {
                            0
                        };
                        if apostrophe == 0
                            || !text[i + apostrophe..]
                                .chars()
                                .next()
                                .is_some_and(is_latin_letter)
                        {
                            break;
                        }
                        i += apostrophe;
                        while let Some(c) = text[i..]
                            .chars()
                            .next()
                            .filter(|c| is_latin_letter(*c) || is_combining(*c))
                        {
                            i += c.len_utf8();
                        }
                    }
                }
                Script::Han => i += c.len_utf8(),
                Script::Hangul => i += hangul_syllable_len(&text[i..]),
                Script::Kana => {
                    i += c.len_utf8();
                    while let Some(c) = text[i..].chars().next().filter(|c| extends_kana(*c)) {
                        i += c.len_utf8();
                    }
                }
                Script::Other => {
                    while let Some(c) = text[i..]
                        .chars()
                        .next()
                        .filter(|c| script_of(*c) == Some(Script::Other) || is_combining(*c))
                    {
                        i += c.len_utf8();
                    }
                }
            }
            tokens.push(TextToken::Word {
                text: &text[start..i],
                start,
                end: i,
            });
        } else if sentence_end(c) {
            let start = i;
            while let Some(c) = text[i..].chars().next().filter(|c| sentence_end(*c)) {
                i += c.len_utf8();
            }
            let mark = &text[start..i];
            let tone = if mark.contains(['?', '？', '؟', '⁇', '⁈', '⁉']) {
                Tone::Question
            } else if mark.contains(['!', '！', '‼']) {
                Tone::Exclaim
            } else {
                Tone::Statement
            };
            tokens.push(TextToken::Break { mark: '.', tone });
        } else if clause_break(c) {
            i += c.len_utf8();
            tokens.push(TextToken::Break {
                mark: ',',
                tone: Tone::None,
            });
        } else if c == '\n' {
            while text[i..].starts_with('\n') {
                i += 1;
            }
            tokens.push(TextToken::Break {
                mark: '.',
                tone: Tone::Statement,
            });
        } else {
            i += c.len_utf8();
        }
    }
    tokens
}

fn vowel(c: u8) -> bool {
    b"aeiouyAEIOU".contains(&c)
}

/// A Latin letter as the plain letter the English rules understand. An accented
/// vowel becomes its capital vowel, which counts as a vowel but is never a silent
/// final e. Any other non-ASCII letter stands in as a consonant.
fn plain_letter(c: char) -> Option<u8> {
    const VOWELS: [(&str, u8); 5] = [
        ("àáâãäåæāăą", b'a'),
        ("èéêëēĕėęě", b'e'),
        ("ìíîïĩīĭįıİ", b'i'),
        ("òóôõöøōŏő", b'o'),
        ("ùúûüũūŭůűų", b'u'),
    ];
    if c.is_ascii_alphabetic() {
        return Some(c.to_ascii_lowercase() as u8);
    }
    if !is_latin_letter(c) {
        return None;
    }
    let lower = c.to_lowercase().next().unwrap_or(c);
    Some(
        VOWELS
            .iter()
            .find(|(set, _)| set.contains(lower))
            .map_or(b'c', |(_, vowel)| vowel.to_ascii_uppercase()),
    )
}

/// Heuristics, deliberately independent of pronunciation dictionaries. English
/// rules for Latin letters; one syllable per Chinese character, Hangul block and
/// kana; about one per three letters of any other script.
pub fn count_syllables(word: &str) -> usize {
    let letters: Vec<u8> = word.chars().filter_map(plain_letter).collect();
    let mut foreign = 0;
    let mut other = 0;
    let mut skip_to = 0;
    for (i, c) in word.char_indices() {
        if i < skip_to {
            continue;
        }
        match script_of(c) {
            Some(Script::Han) => foreign += 1,
            Some(Script::Hangul) => {
                foreign += 1;
                skip_to = i + hangul_syllable_len(&word[i..]);
            }
            Some(Script::Kana) if !extends_kana(c) => foreign += 1,
            Some(Script::Other) => other += 1,
            _ => (),
        }
    }
    foreign += (other as usize).div_ceil(3);
    let n = letters.len();
    if n == 0 {
        return if foreign > 0 {
            foreign
        } else {
            word.bytes()
                .filter(u8::is_ascii_digit)
                .count()
                .div_ceil(2)
                .max(1)
        };
    }
    foreign + if n <= 3 { 1 } else { latin_syllables(&letters) }
}

fn latin_syllables(letters: &[u8]) -> usize {
    let n = letters.len();
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
    // Syllable-timed scripts have no English stress pattern; every syllable is even.
    if word
        .chars()
        .any(|c| script_of(c).is_some_and(|s| s != Script::Latin))
    {
        return None;
    }
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
