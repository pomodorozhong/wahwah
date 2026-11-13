use wahwah_core::mumble::{
    MumbleOptions, MumbleScript, TextToken, Tone, count_syllables, generate_mumble, stress_index,
    tokenize_text,
};

fn script(text: &str) -> MumbleScript {
    generate_mumble(
        text,
        &MumbleOptions {
            seed: 11,
            style_id: "bubbly".into(),
            mood_id: "neutral".into(),
        },
    )
}

fn words(text: &str) -> Vec<&str> {
    tokenize_text(text)
        .into_iter()
        .filter_map(|t| match t {
            TextToken::Word { text, .. } => Some(text),
            TextToken::Break { .. } => None,
        })
        .collect()
}

/// Recorded from the code before multilingual input: English must not change.
#[test]
fn english_output_is_unchanged() {
    assert_eq!(
        script("Hello there! How are you today?").phonemes,
        "M EH'(+18) Y OW(-3) P AE(+25) . D AA'(+6) W IY D UW(-5) M D OW'(+10) L IY(+45) ."
    );
}

#[test]
fn chinese_is_a_word_per_character_with_fullwidth_punctuation() {
    let text = "你好，世界！你是谁？";
    assert_eq!(words(text), ["你", "好", "世", "界", "你", "是", "谁"]);
    let tokens = tokenize_text(text);
    assert!(tokens.contains(&TextToken::Break {
        mark: ',',
        tone: Tone::None
    }));
    assert!(tokens.contains(&TextToken::Break {
        mark: '.',
        tone: Tone::Exclaim
    }));
    assert!(tokens.contains(&TextToken::Break {
        mark: '.',
        tone: Tone::Question
    }));
    let s = script(text);
    assert_eq!(s.words.len(), 7);
    // One syllable each, none stressed, and the same character sounds the same.
    assert!(s.words.iter().all(|w| !w.spelled.contains('-')));
    assert!(
        s.words
            .iter()
            .all(|w| w.spelled == w.spelled.to_lowercase())
    );
    assert_eq!(s.words[0].spelled, s.words[4].spelled);
}

#[test]
fn mixed_languages_keep_each_word_and_its_byte_range() {
    let text = "Hello你好world, こんにちは! Привет мир";
    assert_eq!(
        words(text),
        [
            "Hello",
            "你",
            "好",
            "world",
            "こ",
            "ん",
            "に",
            "ち",
            "は",
            "Привет",
            "мир"
        ]
    );
    for token in tokenize_text(text) {
        if let TextToken::Word {
            text: word,
            start,
            end,
        } = token
        {
            assert_eq!(&text[start..end], word);
        }
    }
    let s = script(text);
    assert_eq!(s.words.len(), 11);
    assert!(s.words.iter().all(|w| w.out_end > w.out_start));
}

#[test]
fn kana_morae_and_hangul_blocks_count_one_syllable() {
    assert_eq!(words("きょう"), ["きょ", "う"]);
    assert_eq!(words("ラーメン"), ["ラー", "メ", "ン"]);
    assert_eq!(words("안녕하세요"), ["안", "녕", "하", "세", "요"]);
    assert_eq!(count_syllables("きょ"), 1);
    assert_eq!(count_syllables("你"), 1);
    assert_eq!(count_syllables("안"), 1);
}

#[test]
fn decomposed_hangul_jamo_spell_one_syllable() {
    // 한 and 글, each as a leading consonant, a vowel and a trailing consonant.
    let decomposed = "\u{1112}\u{1161}\u{11AB}\u{1100}\u{1173}\u{11AF}";
    assert_eq!(
        words(decomposed),
        ["\u{1112}\u{1161}\u{11AB}", "\u{1100}\u{1173}\u{11AF}"]
    );
    // 하, with no trailing consonant.
    assert_eq!(words("\u{1112}\u{1161}"), ["\u{1112}\u{1161}"]);
    assert_eq!(count_syllables("\u{1112}\u{1161}\u{11AB}"), 1);
    assert_eq!(count_syllables(decomposed), 2);
    // Spoken as the same number of syllables as the precomposed 한글.
    let s = script(decomposed);
    assert_eq!(s.words.len(), 2);
    assert!(s.words.iter().all(|w| !w.spelled.contains('-')));
    // A stray jamo that spells no syllable stays a syllable of its own.
    assert_eq!(words("\u{1161}\u{11AB}"), ["\u{1161}", "\u{11AB}"]);
    assert_eq!(words("\u{1112}\u{1100}"), ["\u{1112}", "\u{1100}"]);
    // Compatibility jamo are unchanged: one syllable each.
    assert_eq!(words("ㅎㅏ"), ["ㅎ", "ㅏ"]);
}

#[test]
fn other_scripts_fall_back_to_about_three_letters_a_syllable() {
    assert_eq!(count_syllables("Привет"), 2);
    assert_eq!(count_syllables("мир"), 1);
    assert_eq!(count_syllables("مرحبا"), 2);
    // Vowel marks are not letters: the vowelled word is as long as the bare one.
    assert_eq!(count_syllables("مَرْحَبًا"), 2);
    assert_eq!(stress_index("Привет", 2), None);
    assert_eq!(stress_index("你", 1), None);
    assert!(script("Привет мир").phonemes.len() > 4);
}

#[test]
fn accented_latin_words_stay_whole() {
    assert_eq!(
        words("café naïve Zürich señor"),
        ["café", "naïve", "Zürich", "señor"]
    );
    assert_eq!(count_syllables("café"), 2);
    assert_eq!(count_syllables("résumé"), 3);
    assert_eq!(count_syllables("Zürich"), 2);
    assert_eq!(words("l'été d’été"), ["l'été", "d’été"]);
}

#[test]
fn symbols_and_emoji_are_skipped_not_spoken() {
    assert_eq!(words("🧊 ★ ✓ ok"), ["ok"]);
    assert_eq!(script("🧊🧊").phonemes, "");
}

#[test]
fn the_same_text_gives_the_same_script() {
    let text = "Hello 世界 мир";
    assert_eq!(script(text).phonemes, script(text).phonemes);
    assert_ne!(
        script(text).phonemes,
        generate_mumble(
            text,
            &MumbleOptions {
                seed: 12,
                ..Default::default()
            }
        )
        .phonemes
    );
}

#[test]
fn combining_marks_stay_with_their_word() {
    assert_eq!(words("नमस्ते"), ["नमस्ते"]);
    assert_eq!(words("नमस्ते दुनिया"), ["नमस्ते", "दुनिया"]);
    assert_eq!(words("cafe\u{301} bar"), ["cafe\u{301}", "bar"]);
    assert_eq!(words("مَرْحَبًا"), ["مَرْحَبًا"]);
    assert_eq!(words("สวัสดี"), ["สวัสดี"]);
    assert_eq!(words("3.14"), ["3", "14"]);
    // A mark with no letter before it starts no word and is skipped.
    assert_eq!(words("\u{301}cafe"), ["cafe"]);
    assert_eq!(words("ok \u{301}\u{64E} bar"), ["ok", "bar"]);
    assert_eq!(script("\u{301}").phonemes, "");
    // A danda is punctuation, not part of a word.
    assert_eq!(words("नमस्ते। दुनिया"), ["नमस्ते", "दुनिया"]);
}

#[test]
fn the_sokuon_is_a_mora_of_its_own() {
    assert_eq!(words("がっこう"), ["が", "っ", "こ", "う"]);
    assert_eq!(count_syllables("っ"), 1);
    assert_eq!(words("きょう"), ["きょ", "う"]);
}
