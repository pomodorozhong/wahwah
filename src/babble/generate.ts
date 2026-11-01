// Text-to-babble: English text -> invented, pronounceable klattsch phonemes.
// The text sets word breaks, syllable counts, stress, pauses and intonation;
// the sounds themselves are invented. Pure and deterministic: the same text,
// style, mood and seed always give the same phoneme string.

import type { VoiceSettings } from '../voice/performance';
import { STYLES, MOODS, pickWeighted, type BabbleStyle, type Mood } from './styles';
import { countSyllables, stressIndex, tokenizeText } from './text';

export interface BabbleOptions {
  seed: number;
  styleId?: string;
  moodId?: string;
}

interface Syllable {
  onset: string;
  vowel: string;
  coda: string;
  stressed: boolean;
  /** Transient pitch glide on the vowel, Hz. */
  glide: number;
}

export interface BabbleWord {
  /** The English word and its character range in the input text. */
  text: string;
  srcStart: number;
  srcEnd: number;
  /** Character range of this word's phonemes in `BabbleScript.phonemes`. */
  outStart: number;
  outEnd: number;
  /** Readable spelling of the babble word, e.g. "bo-LA". */
  spelled: string;
}

export interface BabbleScript {
  /** klattsch phoneme string, ready for compilePerformance(). */
  phonemes: string;
  words: BabbleWord[];
  style: BabbleStyle;
  mood: Mood;
}

/** FNV-1a string hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG returning floats in [0, 1). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function findStyle(id?: string): BabbleStyle {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

export function findMood(id?: string): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}

/** Invent the sounds for one word. The same word always sounds the same. */
function inventWord(word: string, style: BabbleStyle, seed: number): Syllable[] {
  const n = countSyllables(word);
  const stress = stressIndex(word, n);
  const r = rng(hash(`${seed}|${style.id}|${word.toLowerCase()}`));
  const syllables: Syllable[] = [];
  for (let i = 0; i < n; i++) {
    let onset = pickWeighted(style.onsets, r());
    // Avoid vowel-vowel hiatus inside a word ("a-o"): give it a consonant.
    if (onset === '' && i > 0 && !syllables[i - 1].coda) onset = pickWeighted(style.onsets.filter(([c]) => c !== ''), r());
    const vowel = pickWeighted(style.vowels, r());
    const coda = r() < style.codaChance ? pickWeighted(style.codas, r()) : '';
    syllables.push({ onset, vowel, coda, stressed: i === stress, glide: 0 });
  }
  return syllables;
}

const SPELL: Record<string, string> = {
  AA: 'a', AE: 'a', AH: 'u', AO: 'aw', AW: 'ow', AY: 'ai', EH: 'e', ER: 'er', EY: 'ay', IH: 'i', IY: 'ee', OW: 'o', OY: 'oy', UH: 'oo', UW: 'u',
  CH: 'ch', HH: 'h', JH: 'j', NG: 'ng', SH: 'sh', TH: 'th', DH: 'th', ZH: 'zh', Y: 'y',
};
const spell = (code: string) => SPELL[code] ?? code.toLowerCase();

function spellWord(syllables: Syllable[]): string {
  return syllables
    .map((s) => {
      const t = spell(s.onset) + spell(s.vowel) + spell(s.coda);
      return s.stressed ? t.toUpperCase() : t;
    })
    .join('-');
}

function syllableTokens(s: Syllable): string[] {
  const glide = Math.round(s.glide);
  const vowel = `${s.vowel}${s.stressed ? "'" : ''}${glide !== 0 ? `(${glide > 0 ? '+' : ''}${glide})` : ''}`;
  return [s.onset, vowel, s.coda].filter(Boolean);
}

export function textToBabble(text: string, options: BabbleOptions): BabbleScript {
  const style = findStyle(options.styleId);
  const mood = findMood(options.moodId);
  type Item = { kind: 'word'; text: string; srcStart: number; srcEnd: number; syllables: Syllable[] } | { kind: 'pause'; mark: string };
  const items: Item[] = [];
  let wordCount = 0;

  const lastWord = (): Extract<Item, { kind: 'word' }> | null => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'word') return it;
      if (it.kind === 'pause') return null; // already closed by an earlier break
    }
    return null;
  };

  const closePhrase = (tone: 'statement' | 'question' | 'exclaim' | 'none') => {
    const w = lastWord();
    if (!w) return;
    const last = w.syllables[w.syllables.length - 1];
    if (tone === 'question') last.glide = mood.questionRise;
    else if (tone === 'statement') last.glide = mood.statementFall;
    else if (tone === 'exclaim') {
      const target = w.syllables.find((s) => s.stressed) ?? last;
      target.glide = mood.exclaimRise;
    }
  };

  for (const tok of tokenizeText(text)) {
    if (tok.kind === 'word') {
      const syllables = inventWord(tok.text, style, options.seed);
      // Melody: wobble varies by position, so repeated words don't sound copied.
      const wobble = rng(hash(`${options.seed}|melody|${wordCount}`));
      for (const s of syllables) {
        s.glide = (wobble() * 2 - 1) * mood.liveliness + (s.stressed ? mood.stressLift : 0);
      }
      items.push({ kind: 'word', text: tok.text, srcStart: tok.start, srcEnd: tok.end, syllables });
      wordCount++;
    } else {
      closePhrase(tok.tone);
      const mark = tok.strength === 'long' ? (tok.tone === 'none' ? ';' : '.') : ',';
      const prev = items[items.length - 1];
      // Collapse runs of punctuation into the strongest pause.
      if (prev?.kind === 'pause') {
        if (prev.mark === ',' || (prev.mark === ';' && mark === '.')) prev.mark = mark;
      } else if (prev) {
        items.push({ kind: 'pause', mark });
      }
    }
  }
  // Text with no final punctuation still ends like a statement.
  if (items[items.length - 1]?.kind === 'word') closePhrase('statement');

  let phonemes = '';
  const words: BabbleWord[] = [];
  const append = (s: string) => {
    phonemes += (phonemes ? ' ' : '') + s;
  };
  for (const it of items) {
    if (it.kind === 'pause') {
      append(it.mark);
      continue;
    }
    const start = phonemes.length + (phonemes ? 1 : 0);
    append(it.syllables.flatMap(syllableTokens).join(' '));
    words.push({ text: it.text, srcStart: it.srcStart, srcEnd: it.srcEnd, outStart: start, outEnd: phonemes.length, spelled: spellWord(it.syllables) });
  }
  return { phonemes, words, style, mood };
}

/** Apply a mood's voice changes to the user's base voice. */
export function moodVoice(base: VoiceSettings, mood: Mood): VoiceSettings {
  return {
    ...base,
    pitchHz: base.pitchHz * mood.pitchScale,
    msPerPhoneme: base.msPerPhoneme * mood.rateScale,
    vibratoDepth: mood.vibratoDepth,
    aspiration: mood.aspiration,
    effort: mood.effort,
    tilt: mood.tilt,
  };
}

/** The English word being spoken for a position in the phoneme string. */
export function wordAtPhonemeOffset(script: BabbleScript, offset: number): BabbleWord | null {
  return script.words.find((w) => offset >= w.outStart && offset < w.outEnd) ?? null;
}
