// Shared with Rust; imported at build time, with no WASM dependency.
import { mumblePresets as presets } from '../data/presets.js';

type Weighted = readonly [code: string, weight: number];

export interface MumbleStyle {
  id: string;
  name: string;
  /** '' means a syllable with no onset consonant. */
  onsets: readonly Weighted[];
  vowels: readonly Weighted[];
  codas: readonly Weighted[];
  /** Probability that a syllable gets a coda. */
  codaChance: number;
}

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

export const STYLES: readonly MumbleStyle[] = presets.styles as unknown as MumbleStyle[];
export const MOODS: readonly Mood[] = presets.moods;
