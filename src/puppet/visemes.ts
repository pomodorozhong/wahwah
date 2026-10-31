import type { FaceControls } from './controls';

export interface Viseme {
  pose: FaceControls;
  /** Diphthongs glide to a second pose late in the sound. */
  glideTo?: FaceControls;
  /**
   * How strongly this sound holds its own pose against its neighbours (0-1).
   * Vowels, bilabials and W must hit their shape; tongue consonants barely
   * show on the lips, so they mostly borrow the surrounding vowel shape.
   */
  dominance: number;
}

const p = (jawOpen: number, lipWidth: number, lipRound: number): FaceControls => ({ jawOpen, lipWidth, lipRound });

// Hand-tuned mapping from klattsch's ARPABET set to the three controls.
export const VISEMES: Record<string, Viseme> = {
  // Monophthong vowels
  AA: { pose: p(0.9, 0.3, 0), dominance: 1 },
  AE: { pose: p(0.75, 0.6, 0), dominance: 1 },
  AH: { pose: p(0.6, 0.3, 0), dominance: 1 },
  AO: { pose: p(0.7, 0.1, 0.5), dominance: 1 },
  EH: { pose: p(0.5, 0.55, 0), dominance: 1 },
  ER: { pose: p(0.35, 0.15, 0.45), dominance: 1 },
  IH: { pose: p(0.3, 0.6, 0), dominance: 1 },
  IY: { pose: p(0.2, 0.9, 0), dominance: 1 },
  UH: { pose: p(0.3, 0.1, 0.6), dominance: 1 },
  UW: { pose: p(0.18, 0, 1), dominance: 1 },
  // Diphthongs
  AY: { pose: p(0.9, 0.3, 0), glideTo: p(0.25, 0.8, 0), dominance: 1 },
  AW: { pose: p(0.9, 0.3, 0), glideTo: p(0.2, 0, 0.9), dominance: 1 },
  EY: { pose: p(0.5, 0.55, 0), glideTo: p(0.22, 0.85, 0), dominance: 1 },
  OW: { pose: p(0.55, 0.05, 0.7), glideTo: p(0.25, 0, 0.95), dominance: 1 },
  OY: { pose: p(0.7, 0.1, 0.5), glideTo: p(0.25, 0.8, 0), dominance: 1 },
  // Bilabials: lips fully closed
  M: { pose: p(0, 0.2, 0), dominance: 1 },
  B: { pose: p(0, 0.2, 0), dominance: 1 },
  P: { pose: p(0, 0.2, 0), dominance: 1 },
  // Labio-dental and rounded consonants
  F: { pose: p(0.08, 0.35, 0), dominance: 0.9 },
  V: { pose: p(0.08, 0.35, 0), dominance: 0.9 },
  W: { pose: p(0.12, 0, 0.95), dominance: 1 },
  SH: { pose: p(0.15, 0.1, 0.6), dominance: 0.8 },
  ZH: { pose: p(0.15, 0.1, 0.6), dominance: 0.8 },
  CH: { pose: p(0.15, 0.1, 0.6), dominance: 0.8 },
  JH: { pose: p(0.15, 0.1, 0.6), dominance: 0.8 },
  R: { pose: p(0.2, 0.05, 0.5), dominance: 0.6 },
  // Tongue consonants: weak lip shape
  S: { pose: p(0.1, 0.6, 0), dominance: 0.5 },
  Z: { pose: p(0.1, 0.6, 0), dominance: 0.5 },
  TH: { pose: p(0.2, 0.4, 0), dominance: 0.5 },
  DH: { pose: p(0.2, 0.4, 0), dominance: 0.5 },
  T: { pose: p(0.22, 0.4, 0), dominance: 0.4 },
  D: { pose: p(0.22, 0.4, 0), dominance: 0.4 },
  N: { pose: p(0.22, 0.4, 0), dominance: 0.4 },
  L: { pose: p(0.3, 0.35, 0), dominance: 0.4 },
  Y: { pose: p(0.15, 0.7, 0), dominance: 0.6 },
  K: { pose: p(0.3, 0.3, 0), dominance: 0.3 },
  G: { pose: p(0.3, 0.3, 0), dominance: 0.3 },
  NG: { pose: p(0.3, 0.3, 0), dominance: 0.3 },
  HH: { pose: p(0.45, 0.3, 0), dominance: 0.2 },
};

/** Fallback for codes not in the table (e.g. a custom bank). */
export const UNKNOWN_VISEME: Viseme = { pose: p(0.3, 0.3, 0), dominance: 0.3 };
