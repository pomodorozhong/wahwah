//! Repeatable character voices from a caller-provided hash.
//!
//! The caller hashes whatever identifies a character (a viewer ID, a save slot)
//! with its own salt and passes the bytes. Each voice setting is drawn with
//! HKDF-SHA256 under its own label, so settings are independent and a setting
//! added later cannot move the others. A mapping version is part of every label
//! and is always chosen by the caller. A released mapping never changes: its
//! ranges and style list are frozen here, and golden tests pin the output.

use hkdf::Hkdf;
use serde::Serialize;
use sha2::Sha256;
use std::fmt;

/// The only mapping so far.
pub const MAPPING_V1: u32 = 1;
/// Shorter input is too weak to tell characters apart.
pub const MIN_HASH_BYTES: usize = 16;
/// A sanity bound; a SHA-512 digest is 64 bytes.
pub const MAX_HASH_BYTES: usize = 1024;

const SALT: &[u8] = b"wahwah/character-voice";
/// Frozen: adding a style to the presets must not change existing characters.
const STYLES_V1: [&str; 3] = ["bubbly", "chirpy", "grumbly"];

#[derive(Debug, PartialEq, Eq)]
pub enum HashError {
    TooShort,
    TooLong,
    BadHex,
    UnknownMapping(u32),
}

impl fmt::Display for HashError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TooShort => write!(f, "The hash must be at least {MIN_HASH_BYTES} bytes"),
            Self::TooLong => write!(f, "The hash must be at most {MAX_HASH_BYTES} bytes"),
            Self::BadHex => write!(f, "The hash must be an even number of hex digits"),
            Self::UnknownMapping(n) => write!(
                f,
                "Unknown voice mapping {n}; the known mapping is {MAPPING_V1}"
            ),
        }
    }
}

impl std::error::Error for HashError {}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterSettings {
    pub pitch_hz: f64,
    pub ms_per_phoneme: f64,
    pub formant_scale: f64,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct CharacterTrombone {
    pub brightness: f64,
    pub wah: f64,
    pub transpose: f64,
}

/// Plain data a caller can show, store and pass to the render calls. The mood
/// is not part of it: a character keeps its voice and chooses a mood per line.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterVoice {
    pub mapping: u32,
    pub settings: CharacterSettings,
    pub style_id: String,
    pub seed: u32,
    pub brass_color: f64,
    pub trombone: CharacterTrombone,
}

/// Strict hex: an even number of digits, either case, no prefix or spaces.
pub fn parse_hash_hex(hex: &str) -> Result<Vec<u8>, HashError> {
    if !hex.len().is_multiple_of(2) || !hex.is_ascii() {
        return Err(HashError::BadHex);
    }
    hex.as_bytes()
        .chunks(2)
        .map(|pair| {
            let digit = |c: u8| (c as char).to_digit(16).ok_or(HashError::BadHex);
            Ok((digit(pair[0])? * 16 + digit(pair[1])?) as u8)
        })
        .collect()
}

struct Draw {
    kdf: Hkdf<Sha256>,
    mapping: u32,
}

impl Draw {
    /// A whole number in 0..count, drawn for one named setting.
    fn step(&self, field: &str, count: u64) -> u64 {
        let info = format!("wahwah/character-voice/v{}/{field}", self.mapping);
        let mut bytes = [0u8; 8];
        self.kdf
            .expand(info.as_bytes(), &mut bytes)
            .expect("8 bytes is within the HKDF output limit");
        // The remainder is not perfectly even, but count is tiny next to 2^64.
        u64::from_be_bytes(bytes) % count
    }
}

/// Derive a character voice. Values are integers over fixed steps, divided once
/// by a constant, so every platform and language computes the same numbers.
pub fn derive_voice(hash: &[u8], mapping: u32) -> Result<CharacterVoice, HashError> {
    if mapping != MAPPING_V1 {
        return Err(HashError::UnknownMapping(mapping));
    }
    if hash.len() < MIN_HASH_BYTES {
        return Err(HashError::TooShort);
    }
    if hash.len() > MAX_HASH_BYTES {
        return Err(HashError::TooLong);
    }
    let draw = Draw {
        kdf: Hkdf::<Sha256>::new(Some(SALT), hash),
        mapping,
    };
    let hundredths =
        |field: &str, low: u64, high: u64| (low + draw.step(field, high - low + 1)) as f64 / 100.0;
    Ok(CharacterVoice {
        mapping,
        settings: CharacterSettings {
            pitch_hz: (85 + draw.step("pitch", 136)) as f64,
            ms_per_phoneme: (85 + draw.step("rate", 56)) as f64,
            formant_scale: hundredths("formant", 85, 125),
        },
        style_id: STYLES_V1[draw.step("style", STYLES_V1.len() as u64) as usize].to_owned(),
        seed: draw.step("seed", 1 << 32) as u32,
        brass_color: hundredths("brass", 40, 95),
        trombone: CharacterTrombone {
            brightness: hundredths("trombone-brightness", 25, 75),
            wah: hundredths("trombone-wah", 60, 100),
            transpose: -((2 + draw.step("trombone-transpose", 7)) as f64),
        },
    })
}
