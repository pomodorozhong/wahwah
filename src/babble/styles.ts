// Invented "languages" (sound inventories) and moods for babble.

type Weighted = readonly [code: string, weight: number];

export interface BabbleStyle {
  id: string;
  name: string;
  /** '' means a syllable with no onset consonant. */
  onsets: readonly Weighted[];
  vowels: readonly Weighted[];
  codas: readonly Weighted[];
  /** Probability that a syllable gets a coda. */
  codaChance: number;
}

export const STYLES: readonly BabbleStyle[] = [
  {
    id: 'bubbly',
    name: 'Bubbly (soft, round)',
    onsets: [['B', 3], ['M', 3], ['L', 3], ['D', 2], ['N', 2], ['W', 2], ['Y', 1], ['P', 2], ['', 2]],
    vowels: [['AA', 3], ['OW', 3], ['UW', 2], ['AH', 2], ['EH', 2], ['IY', 2], ['AE', 1]],
    codas: [['N', 2], ['M', 2], ['L', 1]],
    codaChance: 0.15,
  },
  {
    id: 'chirpy',
    name: 'Chirpy (bright, clicky)',
    onsets: [['T', 3], ['K', 3], ['P', 2], ['S', 2], ['CH', 1], ['Y', 2], ['N', 1], ['', 1]],
    vowels: [['IY', 3], ['IH', 2], ['EH', 2], ['EY', 2], ['AE', 2], ['AY', 1]],
    codas: [['T', 2], ['K', 2], ['S', 1], ['N', 1]],
    codaChance: 0.25,
  },
  {
    id: 'grumbly',
    name: 'Grumbly (low, chewy)',
    onsets: [['G', 2], ['B', 2], ['M', 3], ['R', 2], ['D', 2], ['HH', 1], ['W', 1], ['', 2]],
    vowels: [['AH', 3], ['UH', 2], ['AO', 2], ['OW', 2], ['UW', 2], ['ER', 1], ['AA', 1]],
    codas: [['R', 2], ['M', 2], ['N', 2], ['G', 1], ['L', 1]],
    codaChance: 0.4,
  },
];

export interface Mood {
  id: string;
  name: string;
  /** Multiplies the voice's base pitch. */
  pitchScale: number;
  /** Multiplies ms-per-phoneme (below 1 is faster). */
  rateScale: number;
  /** Random per-syllable pitch wobble, Hz (deterministic per seed). */
  liveliness: number;
  /** Extra pitch glide on stressed syllables, Hz. */
  stressLift: number;
  /** Final-syllable glides, Hz. */
  questionRise: number;
  exclaimRise: number;
  statementFall: number;
  vibratoDepth: number;
  aspiration: number;
  effort: number;
  tilt: number;
}

export const MOODS: readonly Mood[] = [
  { id: 'neutral', name: 'Neutral', pitchScale: 1, rateScale: 1, liveliness: 6, stressLift: 12, questionRise: 45, exclaimRise: 25, statementFall: -12, vibratoDepth: 0, aspiration: 0, effort: 0.5, tilt: 0 },
  { id: 'happy', name: 'Happy', pitchScale: 1.18, rateScale: 0.88, liveliness: 18, stressLift: 22, questionRise: 60, exclaimRise: 40, statementFall: -6, vibratoDepth: 0, aspiration: 0, effort: 0.45, tilt: 0.2 },
  { id: 'sad', name: 'Sad', pitchScale: 0.85, rateScale: 1.3, liveliness: 3, stressLift: 4, questionRise: 20, exclaimRise: 10, statementFall: -25, vibratoDepth: 2, aspiration: 0.35, effort: 0.3, tilt: -0.3 },
  { id: 'angry', name: 'Angry', pitchScale: 0.95, rateScale: 0.85, liveliness: 8, stressLift: 30, questionRise: 30, exclaimRise: 45, statementFall: -20, vibratoDepth: 0, aspiration: 0.1, effort: 0.9, tilt: 0.4 },
  { id: 'surprised', name: 'Surprised', pitchScale: 1.3, rateScale: 0.95, liveliness: 12, stressLift: 25, questionRise: 90, exclaimRise: 70, statementFall: 0, vibratoDepth: 0, aspiration: 0.05, effort: 0.6, tilt: 0.25 },
];

export function pickWeighted(items: readonly Weighted[], r: number): string {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [code, w] of items) {
    x -= w;
    if (x < 0) return code;
  }
  return items[items.length - 1][0];
}
