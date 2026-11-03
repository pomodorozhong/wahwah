import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, compilePerformance } from '../src/voice/performance';
import { DEFAULT_TROMBONE, articulationCurves, f0Curve, renderTrombone, tromboneUtterance } from '../src/engines/trombone';
import { generateMumble, moodVoice } from '../src/mumble/generate';
import { generateFaceTrack } from '../src/puppet/generate';
import { rmsEnvelope, syncReport } from '../src/analysis';

const SR = 48000;
const slow = { ...DEFAULT_VOICE, msPerPhoneme: 250 };

/** Pitch by autocorrelation over a window, Hz. */
function pitchAt(audio: Float32Array, t: number, lo = 50, hi = 400): number {
  const start = Math.floor(t * SR);
  const n = 2048;
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(SR / hi); lag <= Math.floor(SR / lo); lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += audio[start + i] * audio[start + i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  return SR / bestLag;
}

/** Spectral centroid over a window, Hz (naive DFT, coarse bins). */
function centroidAt(audio: Float32Array, t: number): number {
  const start = Math.floor(t * SR);
  const n = 2048;
  let num = 0;
  let den = 0;
  for (let f = 50; f < 5000; f += 25) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      const a = (2 * Math.PI * f * i) / SR;
      re += audio[start + i] * w * Math.cos(a);
      im -= audio[start + i] * w * Math.sin(a);
    }
    const mag = Math.hypot(re, im);
    num += f * mag;
    den += mag;
  }
  return num / den;
}

const mid = (perf: ReturnType<typeof compilePerformance>, i: number) => (perf.segments[i].startSeconds + perf.segments[i].endSeconds) / 2;

describe('wah-wah trombone engine', () => {
  it('follows klattsch pitch targets and glides', () => {
    const perf = compilePerformance('AA AA(+60)', slow);
    const f0 = f0Curve(perf.schedule, perf.durationSeconds);
    expect(f0[Math.floor(mid(perf, 0) / 0.002)]).toBeCloseTo(DEFAULT_VOICE.pitchHz, 0);
    expect(Math.max(...f0)).toBeGreaterThan(DEFAULT_VOICE.pitchHz + 50);
  });

  it('plays at the speech pitch, transposed', () => {
    const perf = compilePerformance('AA', { ...slow, msPerPhoneme: 600 });
    const audio = renderTrombone(perf, SR, { ...DEFAULT_TROMBONE, transpose: 0 });
    const hz = pitchAt(audio, mid(perf, 0));
    expect(hz).toBeGreaterThan(DEFAULT_VOICE.pitchHz * 0.95);
    expect(hz).toBeLessThan(DEFAULT_VOICE.pitchHz * 1.05);
  });

  it('opens the plunger on vowels and closes it on consonants and pauses', () => {
    const perf = compilePerformance('W AA ; M UW', slow);
    const { amp, open } = articulationCurves(perf, 1);
    const at = (arr: Float32Array, t: number) => arr[Math.floor(t / 0.002)];
    expect(at(open, mid(perf, 1))).toBeGreaterThan(at(open, mid(perf, 4)));
    expect(at(amp, mid(perf, 1))).toBeGreaterThan(0.9);
    expect(at(amp, mid(perf, 2))).toBeLessThan(0.15); // the 200 ms pause
  });

  it('sounds brighter on an open vowel than a rounded one (the "wah")', () => {
    const perf = compilePerformance('AA , UW', { ...slow, msPerPhoneme: 500 });
    const audio = renderTrombone(perf, SR);
    expect(centroidAt(audio, mid(perf, 0))).toBeGreaterThan(centroidAt(audio, mid(perf, 2)) * 1.3);
  });

  it('renders deterministic, audible, normalized audio whose loudness the jaw follows', () => {
    const script = generateMumble('Hello class. Please open your books to page forty two.', { seed: 4 });
    const perf = compilePerformance(script.phonemes, moodVoice(DEFAULT_VOICE, script.mood));
    const u = tromboneUtterance(perf);
    const a = u.render(SR);
    expect(a).toEqual(u.render(SR));
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.7, 2);
    expect(Math.max(...rmsEnvelope(a, SR))).toBeGreaterThan(0.1);
    const report = syncReport(a, SR, generateFaceTrack(u.timeline));
    expect(report.jawLoudnessCorrelation).toBeGreaterThan(0.45); // measured 0.56
    expect(Math.abs(report.jawLeadSeconds)).toBeLessThanOrEqual(0.06);
  });
});
