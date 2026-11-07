// A TypeScript port of the analysis, scoring and smoothing in uLipSync
// (https://github.com/hecomi/uLipSync, Runtime/Core/Algorithm.cs,
// LipSyncJob.cs and uLipSyncBlendShape.cs), used by the "uLipSync-style" live
// mode. Behaviour follows the original's defaults; deviations are noted inline.
//
// uLipSync: The MIT License (MIT), Copyright (c) 2021 hecomi.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
// WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
// THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
// FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
// THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { fft } from './features';

/** uLipSync Profile defaults. */
export const ULS = {
  targetSampleRate: 16000,
  sampleCount: 1024,
  melChannels: 30,
  mfccNum: 12,
  /** uLipSyncBlendShape.smoothness default, seconds. */
  smoothness: 0.05,
} as const;

/** Input samples needed at `sampleRate` for one analysis frame (64 ms). */
export function ulsInputLength(sampleRate: number): number {
  return Math.ceil((ULS.sampleCount * sampleRate) / ULS.targetSampleRate);
}

const toMel = (hz: number) => 1127 * Math.log(hz / 700 + 1);
const toHz = (mel: number) => 700 * (Math.exp(mel / 1127) - 1);

const filterCache = new Map<number, Float64Array>();

/** uLipSync's windowed-sinc FIR (Algorithm.LowPassFilter), cached per rate. */
function lowPassTaps(sampleRate: number): Float64Array {
  const hit = filterCache.get(sampleRate);
  if (hit) return hit;
  const range = 500 / sampleRate;
  const cutoff = (ULS.targetSampleRate / 2 - 500) / sampleRate;
  let n = Math.round(3.1 / range);
  if ((n + 1) % 2 === 0) n += 1;
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = i - (n - 1) / 2;
    const ang = 2 * Math.PI * cutoff * x;
    b[i] = ang === 0 ? 2 * cutoff : (2 * cutoff * Math.sin(ang)) / ang;
  }
  filterCache.set(sampleRate, b);
  return b;
}

/**
 * MFCC c1..c12 exactly as LipSyncJob.Execute computes them: low-pass, decimate
 * to 16 kHz, pre-emphasis 0.97, Hamming window, peak-normalize, FFT magnitude,
 * 30-band mel filter bank over 0-8 kHz, 10·log10, unnormalized DCT.
 *
 * `input` is the latest `ulsInputLength(sampleRate)` samples (older first).
 */
export function ulsMfcc(input: Float32Array, sampleRate: number): Float64Array {
  const n = ULS.sampleCount;
  const data = new Float64Array(n);
  const b = lowPassTaps(sampleRate);
  if (sampleRate <= ULS.targetSampleRate) {
    for (let i = 0; i < n; i++) data[i] = input[i] ?? 0;
  } else if (sampleRate % ULS.targetSampleRate === 0) {
    // The original filters every input sample and then keeps every `skip`-th;
    // computing the filter only at the kept samples gives identical output.
    // Note the original *adds* the filtered signal to the input (data += b*x).
    const skip = sampleRate / ULS.targetSampleRate;
    for (let o = 0; o < n; o++) {
      const i = o * skip;
      let acc = input[i];
      for (let j = 0; j < b.length && j <= i; j++) acc += b[j] * input[i - j];
      data[o] = acc;
    }
  } else {
    // Non-integer ratio (e.g. 44.1 kHz): filter, then linear resampling as the original.
    const filtered = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let acc = input[i];
      for (let j = 0; j < b.length && j <= i; j++) acc += b[j] * input[i - j];
      filtered[i] = acc;
    }
    const df = sampleRate / ULS.targetSampleRate;
    for (let o = 0; o < n; o++) {
      const f = df * o;
      const i0 = Math.min(filtered.length - 1, Math.floor(f));
      const i1 = Math.min(filtered.length - 1, i0 + 1);
      data[o] = filtered[i0] + (filtered[i1] - filtered[i0]) * (f - Math.floor(f));
    }
  }
  for (let i = n - 1; i >= 1; i--) data[i] -= 0.97 * data[i - 1];
  let max = 0;
  for (let i = 0; i < n; i++) {
    data[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    max = Math.max(max, Math.abs(data[i]));
  }
  if (max > 1e-7) for (let i = 0; i < n; i++) data[i] /= max;

  const im = new Float64Array(n);
  fft(data, im);
  const spectrum = new Float64Array(n);
  for (let i = 0; i < n; i++) spectrum[i] = Math.hypot(data[i], im[i]);

  // Mel filter bank (Algorithm.MelFilterBank).
  const fMax = ULS.targetSampleRate / 2;
  const nMax = n / 2;
  const df = fMax / nMax;
  const dMel = toMel(fMax) / (ULS.melChannels + 1);
  const mel = new Float64Array(ULS.melChannels);
  for (let m = 0; m < ULS.melChannels; m++) {
    const fBegin = toHz(dMel * m);
    const fCenter = toHz(dMel * (m + 1));
    const fEnd = toHz(dMel * (m + 2));
    const iBegin = Math.ceil(fBegin / df);
    const iCenter = Math.round(fCenter / df);
    const iEnd = Math.floor(fEnd / df);
    let sum = 0;
    for (let i = iBegin + 1; i <= iEnd; i++) {
      const f = df * i;
      let a = i < iCenter ? (f - fBegin) / (fCenter - fBegin) : (fEnd - f) / (fEnd - fCenter);
      a /= (fEnd - fBegin) * 0.5;
      sum += a * spectrum[i];
    }
    mel[m] = 10 * Math.log10(Math.max(sum, 1e-12));
  }

  // Unnormalized DCT-II (Algorithm.DCT); keep c1..c12.
  const out = new Float64Array(ULS.mfccNum);
  for (let c = 1; c <= ULS.mfccNum; c++) {
    let sum = 0;
    for (let j = 0; j < ULS.melChannels; j++) sum += mel[j] * Math.cos(((j + 0.5) * c * Math.PI) / ULS.melChannels);
    out[c - 1] = sum;
  }
  return out;
}

/**
 * LipSyncJob.CalcL2NormScore with standardization off (the default): score =
 * 10^-rms(distance), normalized across sounds so the ratios sum to 1.
 */
export function ulsScores<K extends string>(mfcc: Float64Array, prototypes: Record<K, number[]>): Record<K, number> {
  const scores = {} as Record<K, number>;
  let sum = 0;
  for (const id of Object.keys(prototypes) as K[]) {
    const p = prototypes[id];
    let d = 0;
    for (let i = 0; i < mfcc.length; i++) d += (mfcc[i] - p[i]) ** 2;
    const s = 10 ** -Math.sqrt(d / mfcc.length);
    scores[id] = s;
    sum += s;
  }
  for (const id of Object.keys(scores) as K[]) scores[id] = sum > 0 ? scores[id] / sum : 0;
  return scores;
}

/**
 * Unity's Mathf.SmoothDamp: a critically damped spring toward a moving
 * target, with no overshoot. `smoothTime` is roughly the time to reach it.
 */
export class SmoothDamp {
  value = 0;
  private velocity = 0;

  constructor(public smoothTime: number = ULS.smoothness) {}

  update(target: number, dt: number): number {
    if (dt <= 0) return this.value;
    const smoothTime = Math.max(0.0001, this.smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * exp;
    let out = target + (change + temp) * exp;
    // Prevent overshooting the target (as Unity does).
    if (target - this.value > 0 === out > target) {
      out = target;
      this.velocity = (out - target) / dt;
    }
    this.value = out;
    return out;
  }

  reset(value = 0): void {
    this.value = value;
    this.velocity = 0;
  }
}
