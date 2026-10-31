// Objective checks used by the tests and the in-app diagnostics panel.

import type { FaceControlTrack } from './puppet/controls';
import { sampleFaceTrack } from './puppet/generate';

/** RMS of consecutive windows. */
export function rmsEnvelope(samples: Float32Array, sampleRate: number, windowSeconds = 0.01): number[] {
  const win = Math.max(1, Math.round(sampleRate * windowSeconds));
  const out: number[] = [];
  for (let start = 0; start < samples.length; start += win) {
    let sum = 0;
    const end = Math.min(samples.length, start + win);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    out.push(Math.sqrt(sum / (end - start)));
  }
  return out;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export interface SyncReport {
  peakRms: number;
  /** Fraction of 10 ms windows louder than 1% of full scale. */
  voicedFraction: number;
  /** Correlation between the loudness envelope and jawOpen. */
  jawLoudnessCorrelation: number;
  /** Seconds the jaw leads the loudness at best match; negative = jaw trails. */
  jawLeadSeconds: number;
  distinctPoses: number;
}

/** Compare a rendered utterance with its face track on the shared timeline. */
export function syncReport(audio: Float32Array, sampleRate: number, track: FaceControlTrack): SyncReport {
  const windowSeconds = 0.01;
  const env = rmsEnvelope(audio, sampleRate, windowSeconds);
  const jaw = env.map((_, i) => sampleFaceTrack(track, (i + 0.5) * windowSeconds).jawOpen);
  let best = { lag: 0, r: -Infinity };
  for (let lag = -10; lag <= 10; lag++) {
    const shifted = jaw.map((_, i) => jaw[Math.min(jaw.length - 1, Math.max(0, i + lag))]);
    const r = pearson(env, shifted);
    if (r > best.r) best = { lag, r };
  }
  const poses = new Set(
    track.samples.map((s) => `${s.jawOpen.toFixed(1)}|${s.lipWidth.toFixed(1)}|${s.lipRound.toFixed(1)}`),
  );
  return {
    peakRms: Math.max(0, ...env),
    voicedFraction: env.filter((v) => v > 0.01).length / Math.max(1, env.length),
    jawLoudnessCorrelation: pearson(env, jaw),
    // jaw[i + lag] best matches env[i]; a negative lag means the jaw moved first.
    jawLeadSeconds: -best.lag * windowSeconds,
    distinctPoses: poses.size,
  };
}
