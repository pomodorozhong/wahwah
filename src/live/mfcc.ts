// Mel-frequency cepstral coefficients from an AnalyserNode-style dB spectrum,
// the feature uLipSync-style lip sync matches against a speaker's own profile.

export const MFCC_BANDS = 26;
export const MFCC_COEFFS = 12;
const LOW_HZ = 100;
const HIGH_HZ = 7600;

const mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const imel = (m: number) => 700 * (10 ** (m / 2595) - 1);

interface Filterbank {
  /** Per band: first bin and triangular weights. */
  bands: { start: number; weights: Float64Array }[];
}

const cache = new Map<string, Filterbank>();

function filterbank(bins: number, sampleRate: number): Filterbank {
  const key = `${bins}@${sampleRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const binHz = sampleRate / 2 / bins;
  const hi = Math.min(HIGH_HZ, sampleRate / 2 - binHz);
  const points = Array.from({ length: MFCC_BANDS + 2 }, (_, i) => imel(mel(LOW_HZ) + ((mel(hi) - mel(LOW_HZ)) * i) / (MFCC_BANDS + 1)));
  const bands = [];
  for (let b = 0; b < MFCC_BANDS; b++) {
    const [f0, f1, f2] = [points[b], points[b + 1], points[b + 2]];
    const start = Math.max(1, Math.floor(f0 / binHz));
    const end = Math.min(bins - 1, Math.ceil(f2 / binHz));
    const weights = new Float64Array(Math.max(1, end - start + 1));
    for (let k = start; k <= end; k++) {
      const f = k * binHz;
      weights[k - start] = Math.max(0, f < f1 ? (f - f0) / (f1 - f0) : (f2 - f) / (f2 - f1));
    }
    bands.push({ start, weights });
  }
  const fb = { bands };
  cache.set(key, fb);
  return fb;
}

/**
 * c1..c12 of the DCT of log mel band energies. c0 (overall loudness) is
 * dropped so the match depends on spectral shape, not how loud you speak.
 */
export function mfcc(spectrumDb: Float32Array, sampleRate: number): Float64Array {
  const fb = filterbank(spectrumDb.length, sampleRate);
  const logE = new Float64Array(MFCC_BANDS);
  fb.bands.forEach(({ start, weights }, b) => {
    let e = 0;
    for (let i = 0; i < weights.length; i++) e += weights[i] * 10 ** (spectrumDb[start + i] / 10);
    logE[b] = Math.log(Math.max(e, 1e-12));
  });
  const out = new Float64Array(MFCC_COEFFS);
  for (let c = 1; c <= MFCC_COEFFS; c++) {
    let s = 0;
    for (let b = 0; b < MFCC_BANDS; b++) s += logE[b] * Math.cos((Math.PI * c * (b + 0.5)) / MFCC_BANDS);
    out[c - 1] = s * Math.sqrt(2 / MFCC_BANDS);
  }
  return out;
}
