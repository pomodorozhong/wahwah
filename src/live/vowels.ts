// Vowel space for live analysis: measured F1/F2 -> nearest reference vowels
// -> a blend of their designed mouth poses (the same visemes the text
// pipeline uses), with an adaptive speaker scale so higher voices (shorter
// vocal tracts, formants ~10-30% higher) map onto the same vowels.

import { VISEMES } from '../puppet/visemes';
import { lerpControls, NEUTRAL, type FaceControls } from '../puppet/controls';

export interface ReferenceVowel {
  code: string;
  f1: number;
  f2: number;
  pose: FaceControls;
}

// Monophthongs plus the end points of rounded glides, from klattsch's
// Klatt (1980) bank: an adult male reference (speaker scale 1).
const TARGETS: readonly [code: string, f1: number, f2: number][] = [
  ['AA', 700, 1220], ['AE', 620, 1660], ['AH', 620, 1220], ['AO', 600, 990],
  ['EH', 530, 1680], ['ER', 470, 1270], ['IH', 400, 1800], ['IY', 310, 2020],
  ['UH', 450, 1100], ['UW', 320, 900], // UW uses its rounded glide endpoint.
];

export const REFERENCE_VOWELS: ReferenceVowel[] = TARGETS.map(([code, f1, f2]) => ({
  code, f1, f2, pose: VISEMES[code].pose,
}));

/** Speaker scales tried: 1 = reference adult male; ~1.15 typical adult female; ~1.3 child. */
export const SPEAKER_SCALES = Array.from({ length: 13 }, (_, i) => 0.85 + i * 0.05);

// Log-frequency distance; F2 is a little more discriminating than F1.
const SIGMA_F1 = 0.14;
const SIGMA_F2 = 0.11;

function distance(f1: number, f2: number, scale: number, v: ReferenceVowel): number {
  const d1 = (Math.log(f1 / scale) - Math.log(v.f1)) / SIGMA_F1;
  const d2 = (Math.log(f2 / scale) - Math.log(v.f2)) / SIGMA_F2;
  return d1 * d1 + d2 * d2;
}

export interface VowelMatch {
  /** Closest reference vowel. */
  code: string;
  /** Blended mouth pose of the closest vowels. */
  pose: FaceControls;
  /** Squared normalized distance to the closest vowel (lower is better). */
  distance: number;
}

/** Soft nearest-vowel match at a given speaker scale. */
export function matchVowel(f1: number, f2: number, scale: number): VowelMatch {
  const ranked = REFERENCE_VOWELS.map((v) => ({ v, d: distance(f1, f2, scale, v) })).sort((a, b) => a.d - b.d);
  let wsum = 0;
  let pose: FaceControls = { ...NEUTRAL };
  for (const { v, d } of ranked.slice(0, 3)) {
    const w = Math.exp(-(d - ranked[0].d) / 2);
    wsum += w;
    pose = lerpControls(pose, v.pose, w / wsum); // running weighted mean
  }
  return { code: ranked[0].v.code, pose, distance: ranked[0].d };
}

/** The speaker scale that best explains these formants. */
export function bestScale(f1: number, f2: number): number {
  let best = { scale: 1, d: Infinity };
  for (const scale of SPEAKER_SCALES) {
    const d = Math.min(...REFERENCE_VOWELS.map((v) => distance(f1, f2, scale, v)));
    if (d < best.d) best = { scale, d };
  }
  return best.scale;
}
