// Spectral features shared by live analysis and the vocal-tract codebook:
// an AnalyserNode-compatible magnitude spectrum, a smooth spectral envelope
// (cepstrum of mel-spaced band energies), and a voicing (periodicity) measure.

/** In-place radix-2 FFT. `re` and `im` have the same power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/**
 * Magnitude spectrum in dB with a Blackman window, like
 * AnalyserNode.getFloatFrequencyData (without its time smoothing).
 */
export function magnitudeSpectrumDb(frame: Float32Array | Float64Array): Float32Array {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
    re[i] = frame[i] * w;
  }
  fft(re, im);
  const out = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) out[k] = 20 * Math.log10(Math.max(1e-10, Math.hypot(re[k], im[k]) / n));
  return out;
}

const mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const imel = (m: number) => 700 * (10 ** (m / 2595) - 1);

export const ENVELOPE_BANDS = 24;
export const ENVELOPE_COEFFS = 10;
const LOW_HZ = 150;
const HIGH_HZ = 4500;

/**
 * Smooth spectral envelope as cepstral coefficients c1..c10 of mel-spaced
 * band energies between 150 and 4500 Hz. Loudness (c0) is dropped, so only
 * the shape remains. `warp` stretches the band edges: a value of 1.15 reads a
 * voice whose formants sit 15% higher (a shorter vocal tract) as if it were
 * the reference voice.
 */
export function envelopeFeatures(spectrumDb: Float32Array, sampleRate: number, warp = 1): Float64Array {
  const binHz = sampleRate / 2 / spectrumDb.length;
  const lo = mel(LOW_HZ);
  const hi = mel(HIGH_HZ);
  const bands = new Float64Array(ENVELOPE_BANDS);
  for (let b = 0; b < ENVELOPE_BANDS; b++) {
    const f0 = imel(lo + ((hi - lo) * b) / ENVELOPE_BANDS) * warp;
    const f1 = imel(lo + ((hi - lo) * (b + 1)) / ENVELOPE_BANDS) * warp;
    let sum = 0;
    let count = 0;
    for (let k = Math.max(1, Math.floor(f0 / binHz)); k <= Math.min(spectrumDb.length - 1, Math.ceil(f1 / binHz)); k++) {
      sum += 10 ** (spectrumDb[k] / 10);
      count++;
    }
    bands[b] = 10 * Math.log10(Math.max(1e-12, sum / Math.max(1, count)));
  }
  const coeffs = new Float64Array(ENVELOPE_COEFFS);
  for (let c = 1; c <= ENVELOPE_COEFFS; c++) {
    let s = 0;
    for (let b = 0; b < ENVELOPE_BANDS; b++) s += bands[b] * Math.cos((Math.PI * c * (b + 0.5)) / ENVELOPE_BANDS);
    coeffs[c - 1] = s / ENVELOPE_BANDS;
  }
  return coeffs;
}

/**
 * Periodicity in [0, 1]: the best normalized autocorrelation for pitches
 * 70-500 Hz. Voiced sound is near 1; hiss and silence are near 0.
 * Also returns the pitch at that peak.
 */
export function periodicity(frame: Float32Array | Float64Array, sampleRate: number): { value: number; pitchHz: number } {
  const n = frame.length;
  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.min(n - 32, Math.ceil(sampleRate / 70));
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i + lag < n; i++) {
      xy += frame[i] * frame[i + lag];
      xx += frame[i] * frame[i];
      yy += frame[i + lag] * frame[i + lag];
    }
    const r = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  return { value: Math.max(0, best), pitchHz: bestLag ? sampleRate / bestLag : 0 };
}

const LPC_RATE = 12000;
// Order 14 keeps F1 resolvable for high voices (f0 up to ~300 Hz); 12 and below
// lock onto harmonics there (checked on klattsch vowels at 110-300 Hz).
const LPC_ORDER = 14;

/** Low-pass and decimate to ~12 kHz, the band where F1-F3 live. */
function decimate(frame: Float32Array | Float64Array, sampleRate: number): Float64Array {
  const factor = Math.max(1, Math.round(sampleRate / LPC_RATE));
  if (factor === 1) return Float64Array.from(frame);
  // Windowed-sinc low-pass just below the new Nyquist frequency.
  const taps = 8 * factor + 1;
  const fc = 0.45 / factor;
  const h = new Float64Array(taps);
  let hs = 0;
  for (let i = 0; i < taps; i++) {
    const m = i - (taps - 1) / 2;
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    h[i] = sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1)));
    hs += h[i];
  }
  const out = new Float64Array(Math.floor((frame.length - taps) / factor) + 1);
  for (let o = 0; o < out.length; o++) {
    let s = 0;
    for (let i = 0; i < taps; i++) s += frame[o * factor + i] * h[i];
    out[o] = s / hs;
  }
  return out;
}

/** LPC coefficients a[0..order] (a[0] = 1) by autocorrelation + Levinson-Durbin. */
export function lpc(x: Float64Array, order: number): Float64Array {
  const n = x.length;
  const r = new Float64Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    r[lag] = s;
  }
  r[0] *= 1 + 1e-9; // white-noise correction for stability
  const a = new Float64Array(order + 1);
  a[0] = 1;
  let err = r[0];
  if (err <= 0) return a;
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (err <= 0) break;
  }
  return a;
}

export interface Formants {
  /** First and second formant frequencies in Hz (0 when not found). */
  f1: number;
  f2: number;
}

/**
 * Estimate F1 and F2 from a time-domain frame: decimate to 12 kHz,
 * pre-emphasize, window, fit a 14th-order LPC model, and pick the first two
 * peaks of its spectral envelope.
 */
export function estimateFormants(frame: Float32Array | Float64Array, sampleRate: number): Formants {
  const d = decimate(frame, sampleRate);
  const rate = sampleRate / Math.max(1, Math.round(sampleRate / LPC_RATE));
  const n = d.length;
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 1; i--) x[i] = d[i] - 0.97 * d[i - 1];
  x[0] = d[0];
  for (let i = 0; i < n; i++) x[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  const a = lpc(x, LPC_ORDER);
  const points = 300;
  const env = new Float64Array(points);
  const hzAt = (i: number) => (i / points) * Math.min(4000, rate / 2);
  for (let i = 0; i < points; i++) {
    const w = (2 * Math.PI * hzAt(i)) / rate;
    let re = 0;
    let im = 0;
    for (let k = 0; k <= LPC_ORDER; k++) {
      re += a[k] * Math.cos(w * k);
      im -= a[k] * Math.sin(w * k);
    }
    env[i] = -10 * Math.log10(re * re + im * im + 1e-12);
  }
  const peaks: number[] = [];
  for (let i = 1; i < points - 1; i++) {
    if (env[i] > env[i - 1] && env[i] >= env[i + 1] && hzAt(i) >= 200) peaks.push(i);
  }
  // Parabolic refinement of each peak position.
  const refine = (i: number) => {
    const den = env[i - 1] - 2 * env[i] + env[i + 1];
    return hzAt(i + (den !== 0 ? (0.5 * (env[i - 1] - env[i + 1])) / den : 0));
  };
  const freqs = peaks.map(refine);
  const f1 = freqs.find((f) => f <= 1200) ?? 0;
  const f2 = freqs.find((f) => f > f1 + 250 && f >= 600) ?? 0;
  return { f1, f2 };
}

/** Fraction of spectral power above `splitHz`. */
export function highBandRatio(spectrumDb: Float32Array, sampleRate: number, splitHz: number): number {
  const binHz = sampleRate / 2 / spectrumDb.length;
  let hi = 0;
  let total = 0;
  for (let k = 1; k < spectrumDb.length; k++) {
    const p = 10 ** (spectrumDb[k] / 10);
    total += p;
    if (k * binHz >= splitHz) hi += p;
  }
  return total > 0 ? hi / total : 0;
}

/** Power-weighted mean frequency over the whole spectrum, Hz. */
export function fullCentroid(spectrumDb: Float32Array, sampleRate: number): number {
  const binHz = sampleRate / 2 / spectrumDb.length;
  let num = 0;
  let den = 0;
  for (let k = 1; k < spectrumDb.length; k++) {
    const p = 10 ** (spectrumDb[k] / 10);
    num += k * binHz * p;
    den += p;
  }
  return den > 0 ? num / den : 0;
}
