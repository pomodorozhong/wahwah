use wahwah_core::character::{HashError, MAPPING_V1, derive_voice, parse_hash_hex};

fn hash(byte: u8) -> Vec<u8> {
    vec![byte; 32]
}

#[test]
fn same_hash_gives_the_same_voice() {
    assert_eq!(derive_voice(&hash(7), 1), derive_voice(&hash(7), 1));
}

#[test]
fn different_hashes_give_different_voices() {
    let voices: Vec<_> = (0..20u8)
        .map(|b| derive_voice(&hash(b), 1).unwrap().seed)
        .collect();
    let mut unique = voices.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(unique.len(), voices.len());
}

#[test]
fn hex_and_bytes_agree_in_either_case() {
    let bytes: Vec<u8> = (0..32).collect();
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(parse_hash_hex(&hex).unwrap(), bytes);
    assert_eq!(parse_hash_hex(&hex.to_uppercase()).unwrap(), bytes);
}

#[test]
fn rejects_bad_input() {
    assert_eq!(derive_voice(&[1; 15], 1), Err(HashError::TooShort));
    assert_eq!(derive_voice(&vec![1; 1025], 1), Err(HashError::TooLong));
    assert_eq!(derive_voice(&hash(1), 2), Err(HashError::UnknownMapping(2)));
    assert_eq!(derive_voice(&hash(1), 0), Err(HashError::UnknownMapping(0)));
    for bad in ["abc", "zz", "0x00", "é1"] {
        assert_eq!(parse_hash_hex(bad), Err(HashError::BadHex), "{bad}");
    }
}

#[test]
fn values_stay_in_the_frozen_ranges() {
    for b in 0..=255u8 {
        let v = derive_voice(&[b; 16], MAPPING_V1).unwrap();
        assert!((85.0..=220.0).contains(&v.settings.pitch_hz));
        assert!((85.0..=140.0).contains(&v.settings.ms_per_phoneme));
        assert!((0.85..=1.25).contains(&v.settings.formant_scale));
        assert!((0.40..=0.95).contains(&v.brass_color));
        assert!((0.25..=0.75).contains(&v.trombone.brightness));
        assert!((0.60..=1.00).contains(&v.trombone.wah));
        assert!((-8.0..=-2.0).contains(&v.trombone.transpose));
        assert!(["bubbly", "chirpy", "grumbly"].contains(&v.style_id.as_str()));
    }
}

#[test]
fn styles_cover_every_choice() {
    let mut seen = std::collections::HashSet::new();
    for b in 0..=255u8 {
        seen.insert(derive_voice(&[b; 16], 1).unwrap().style_id);
    }
    assert_eq!(seen.len(), 3);
}

/// Frozen on purpose. If this fails, mapping 1 changed: add a mapping 2 instead.
#[test]
fn mapping_one_is_frozen() {
    let bytes: Vec<u8> = (0..32).collect();
    // Cross-checked against an independent HMAC-SHA256 implementation of RFC 5869.
    let v = derive_voice(&bytes, 1).unwrap();
    assert_eq!(
        format!("{v:?}"),
        "CharacterVoice { mapping: 1, settings: CharacterSettings { pitch_hz: 155.0, ms_per_phoneme: 128.0, formant_scale: 1.13 }, style_id: \"grumbly\", seed: 763329912, brass_color: 0.62, trombone: CharacterTrombone { brightness: 0.48, wah: 0.93, transpose: -2.0 } }"
    );
}
