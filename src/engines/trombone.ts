// Wah-wah muted trombone: the "adult on the phone in a cartoon" voice.
// A project-owned synth. Timing, syllables and pitch contour come from the
// same klattsch performance the other engines use (so stress, questions and
// moods carry over); the sound is additive brass through a "plunger mute"
// low-pass that opens on vowels and closes on consonants: wah, wah-wah.

import type { ScheduleEvent } from 'klattsch';
import type { SpeechPerformance, Timeline, Utterance } from '../voice/performance';
import { VISEMES } from '../puppet/visemes';

export interface TromboneOptions {
  /** 0 dark and muffled .. 1 bright and brassy. */
  brightness: number;
  /** How far the plunger opens on open vowels, 0..1. */
  wah: number;
  /** Pitch shift in semitones applied to the speech contour. */
  transpose: number;
}

export const DEFAULT_TROMBONE: TromboneOptions = { brightness: 0.45, wah: 0.85, transpose: -5 };

const STEP = 0.002; // control-rate step, seconds
const SONORANTS = new Set(['M', 'N', 'NG', 'L', 'R', 'W', 'Y']);

/** F0 in Hz every STEP seconds, following klattsch's targets and glides. */
export function f0Curve(schedule: ScheduleEvent[], durationSeconds: number, step = STEP): Float32Array {
  const n = Math.max(1, Math.ceil(durationSeconds / step));
  const out = new Float32Array(n);
  const events = schedule.filter((e) => typeof e.target.F0 === 'number');
  let current = events[0]?.target.F0 ?? 120;
  let from = current;
  let target = current;
  let rampStart = 0;
  let rampEnd = 0;
  let next = 0;
  for (let i = 0; i < n; i++) {
    const tMs = i * step * 1000;
    while (next < events.length && events[next].atMs <= tMs) {
      from = current;
      target = events[next].target.F0;
      rampStart = events[next].atMs;
      rampEnd = rampStart + Math.max(1, events[next].transitionMs);
      next++;
    }
    current = tMs >= rampEnd ? target : from + (target - from) * ((tMs - rampStart) / (rampEnd - rampStart));
    out[i] = current;
  }
  return out;
}

/** Loudness (0..1) and plunger openness (0..1) every STEP seconds. */
export function articulationCurves(timeline: Timeline, wah: number, step = STEP): { amp: Float32Array; open: Float32Array } {
  const n = Math.max(1, Math.ceil(timeline.durationSeconds / step));
  const amp = new Float32Array(n);
  const open = new Float32Array(n);
  let a = 0;
  let o = 0;
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const t = i * step;
    while (seg < timeline.segments.length && timeline.segments[seg].endSeconds <= t) seg++;
    const s = timeline.segments[seg];
    const code = s && t >= s.startSeconds ? s.phoneme : null;
    let targetAmp = 0;
    let targetOpen = 0.05;
    if (code) {
      const v = VISEMES[code];
      const isVowel = v && /^[AEIOU]/.test(code);
      if (isVowel) {
        targetAmp = 1;
        // Open vowels open the plunger most; rounded ones stay half-covered.
        targetOpen = (0.3 + 0.7 * v.pose.jawOpen) * (1 - 0.35 * v.pose.lipRound);
      } else if (SONORANTS.has(code)) {
        targetAmp = 0.45;
        targetOpen = 0.1;
      } else {
        targetAmp = 0.08;
      }
    }
    // Fast attack, slower release; the plunger moves a little slower than the air.
    a += (targetAmp - a) * (1 - Math.exp(-step / (targetAmp > a ? 0.018 : 0.045)));
    o += (targetOpen * wah - o) * (1 - Math.exp(-step / 0.04));
    amp[i] = a;
    open[i] = o;
  }
  return { amp, open };
}

/** Deterministic xorshift noise in [-1, 1). */
function noise(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 2147483648 - 1;
  };
}

export function renderTrombone(performance: SpeechPerformance, sampleRate: number, opts: TromboneOptions = DEFAULT_TROMBONE, phrasing: 'player' | 'speech' = 'player'): Float32Array {
  const total = Math.ceil(performance.durationSeconds * sampleRate);
  const out = new Float32Array(total);
  if (!total) return out;
  const f0 = f0Curve(performance.schedule, performance.durationSeconds);
  if (phrasing === 'speech') {
    // Use the score's vibrato directives on top of its pitch bends.
    let phase = 0;
    let nextEvent = 0;
    let depth = 0;
    let rate = 5;
    for (let i = 0; i < f0.length; i++) {
      while (nextEvent < performance.schedule.length && performance.schedule[nextEvent].atMs <= i * STEP * 1000) {
        const target = performance.schedule[nextEvent++].target;
        depth = target.vibratoDepth ?? depth;
        rate = target.vibratoRate ?? rate;
      }
      f0[i] += depth * Math.sin(phase);
      phase += 2 * Math.PI * rate * STEP;
    }
  }
  const { amp, open } = articulationCurves(performance, opts.wah);
  const shift = Math.pow(2, opts.transpose / 12);
  const maxHarmonics = 48;
  const phases = new Float64Array(maxHarmonics + 1);
  const gains = new Float64Array(maxHarmonics + 1);
  const re = new Float64Array(maxHarmonics + 1);
  const im = new Float64Array(maxHarmonics + 1);
  const stepRe = new Float64Array(maxHarmonics + 1);
  const stepIm = new Float64Array(maxHarmonics + 1);
  const rand = noise(0x7b0b);
  const block = 32;
  let pitch = f0[0] * shift;
  let breathLp = 0;
  const TWO_PI = Math.PI * 2;

  for (let start = 0; start < total; start += block) {
    const t = start / sampleRate;
    const ci = Math.min(f0.length - 1, Math.floor(t / STEP));
    // Portamento toward the speech contour, plus a lazy player's vibrato.
    if (phrasing === 'player') {
      const targetPitch = f0[ci] * shift * (1 + 0.006 * Math.sin(TWO_PI * 5.2 * t));
      pitch += (targetPitch - pitch) * (1 - Math.exp(-(block / sampleRate) / 0.03));
    } else {
      pitch = f0[ci] * shift;
    }
    const a = amp[ci];
    // Plunger: low-pass corner moves with openness; louder notes get brassier.
    const fc = 260 + 2600 * Math.pow(open[ci], 1.3) * (0.75 + 0.5 * a) * (0.6 + 0.8 * opts.brightness);
    const nyquistSafe = sampleRate / 2.2;
    let k = 1;
    for (; k <= maxHarmonics && k * pitch < Math.min(6000, nyquistSafe); k++) {
      const f = k * pitch;
      const brass = Math.pow(k, -0.65 + 0.35 * opts.brightness);
      const lowpass = 1 / Math.sqrt(1 + Math.pow(f / fc, 4));
      const resonance = 1 + 0.9 * Math.exp(-(((f - fc) / (0.3 * fc)) ** 2));
      gains[k] = brass * lowpass * resonance;
    }
    const harmonics = k - 1;
    const end = Math.min(total, start + block);
    const dPhase = (TWO_PI * pitch) / sampleRate;
    // Each harmonic is a rotating phasor (re, im): one complex multiply per
    // sample instead of a sin() call. Phases are re-anchored every block.
    for (let h = 1; h <= harmonics; h++) {
      re[h] = Math.cos(phases[h]);
      im[h] = Math.sin(phases[h]);
      stepRe[h] = Math.cos(dPhase * h);
      stepIm[h] = Math.sin(dPhase * h);
    }
    for (let i = start; i < end; i++) {
      let s = 0;
      for (let h = 1; h <= harmonics; h++) {
        const r = re[h] * stepRe[h] - im[h] * stepIm[h];
        im[h] = re[h] * stepIm[h] + im[h] * stepRe[h];
        re[h] = r;
        s += gains[h] * im[h];
      }
      breathLp += (rand() - breathLp) * 0.15;
      out[i] = a * (s + 0.25 * breathLp);
    }
    const n = end - start;
    for (let h = 1; h <= harmonics; h++) phases[h] = (phases[h] + dPhase * h * n) % TWO_PI;
  }
  // Normalize to a comfortable peak.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < total; i++) out[i] *= 0.7 / peak;
  return out;
}

export function tromboneUtterance(performance: SpeechPerformance, opts: TromboneOptions = DEFAULT_TROMBONE): Utterance {
  return {
    engine: 'Wah-wah trombone',
    timeline: performance,
    warnings: performance.warnings,
    render: (sampleRate) => renderTrombone(performance, sampleRate, opts),
  };
}
