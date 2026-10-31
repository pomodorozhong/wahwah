import { describe, expect, it } from 'vitest';
import { runLive, heldPose, SR, DT, N } from './helpers/liveEval';
import { calibrate, klattschVoice, pinkTromboneVoice, roomNoise } from './helpers/calibrate';
import { SmoothDamp, ULS, ulsInputLength, ulsMfcc, ulsScores } from '../src/live/ulipsync';
import { DEFAULT_LIVE, LiveMouthEstimator } from '../src/live/estimator';
import { magnitudeSpectrumDb } from '../src/live/features';
import { parseProfile, serializeProfile } from '../src/live/profile';
import { DEFAULT_VOICE, compilePerformance, renderPerformance } from '../src/voice/performance';
import { renderSweep, PT_VOWELS } from '../src/live/ptVoice';
import { generateFaceTrack, sampleFaceTrack } from '../src/puppet/generate';
import { textToBabble } from '../src/babble/generate';
import { pearson } from '../src/analysis';

const SLOW = { timeout: 120000 };
const held = (code: string, formantScale = 1, pitchHz = 120) =>
  renderPerformance(compilePerformance(code, { ...DEFAULT_VOICE, formantScale, pitchHz, msPerPhoneme: 700 }), SR);

describe('uLipSync port: analysis and scoring', () => {
  it('needs 64 ms of input and returns 12 coefficients', () => {
    expect(ulsInputLength(48000)).toBe(3072);
    expect(ulsInputLength(44100)).toBe(2823);
    const a = held('AA');
    expect(ulsMfcc(a.subarray(10000, 10000 + 3072), SR)).toHaveLength(ULS.mfccNum);
  });

  it('separates vowels and is insensitive to loudness (it peak-normalizes)', () => {
    const m = (x: Float32Array) => ulsMfcc(x.subarray(12000, 12000 + 3072), SR);
    const aa = m(held('AA'));
    const iy = m(held('IY'));
    const aaQuiet = m(held('AA').map((v) => v * 0.1));
    const d = (x: Float64Array, y: Float64Array) => Math.hypot(...x.map((v, i) => v - y[i]));
    expect(d(aa, aaQuiet)).toBeLessThan(d(aa, iy) * 0.05);
  });

  it('also works at 44.1 kHz (non-integer decimation)', () => {
    const a = renderPerformance(compilePerformance('IY', { ...DEFAULT_VOICE, msPerPhoneme: 700 }), 44100);
    const c = ulsMfcc(a.subarray(11000, 11000 + ulsInputLength(44100)), 44100);
    expect(c.every(Number.isFinite)).toBe(true);
  });

  it('scores are 10^-distance proportions that sum to 1', () => {
    const s = ulsScores(Float64Array.from([0, 0]), { a: [0, 0], b: [1, 1], c: [3, 3] });
    expect(s.a + s.b + s.c).toBeCloseTo(1, 9);
    expect(s.a / s.b).toBeCloseTo(10, 6); // distance 1 apart -> 10x
  });
});

describe('SmoothDamp (Unity Mathf.SmoothDamp)', () => {
  it('reaches a step target smoothly without overshoot', () => {
    const s = new SmoothDamp(0.05);
    const values: number[] = [];
    for (let i = 0; i < 60; i++) values.push(s.update(1, 1 / 60));
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(values.every((v, i) => i === 0 || v >= values[i - 1])).toBe(true);
    expect(values[29]).toBeGreaterThan(0.99); // within 0.5 s
    expect(values[2]).toBeLessThan(0.6); // but not instantly
  });

  it('a longer smooth time responds more slowly', () => {
    const fast = new SmoothDamp(0.02);
    const slow = new SmoothDamp(0.1);
    for (let i = 0; i < 4; i++) {
      fast.update(1, 1 / 60);
      slow.update(1, 1 / 60);
    }
    expect(fast.value).toBeGreaterThan(slow.value);
  });
});

describe('uLipSync-style live mode', () => {
  it('calibration stores one averaged template per sound, and it survives JSON', SLOW, () => {
    const p = calibrate(klattschVoice());
    expect(Object.keys(p.uls!.prototypes).sort()).toEqual(['AA', 'EH', 'IY', 'M', 'OW', 'S', 'SH', 'UW', 'silence']);
    const q = parseProfile(serializeProfile(p));
    expect(q.uls!.prototypes.AA![0]).toBeCloseTo(p.uls!.prototypes.AA![0], 2);
  });

  it.each([
    ['female-like', 1.15, 200],
    ['child-like', 1.3, 270],
  ] as const)('reads a calibrated %s voice correctly', SLOW, (_n, scale, pitch) => {
    const profile = calibrate(klattschVoice(scale, pitch));
    const checks: [string, (p: ReturnType<typeof heldPose>) => boolean][] = [
      ['AA', (p) => p.sound === 'AA' && p.jawOpen > 0.7],
      ['IY', (p) => p.sound === 'IY' && p.lipWidth > 0.8 && p.jawOpen < 0.3],
      ['UW', (p) => p.sound === 'UW' && p.lipRound > 0.9],
      ['M', (p) => p.sound === 'M' && p.jawOpen < 0.05],
      ['S', (p) => p.sound === 'S' && p.lipWidth > 0.4],
      ['SH', (p) => p.sound === 'SH' && p.lipRound > 0.4],
    ];
    for (const [code, ok] of checks) {
      const pose = heldPose(runLive(held(code, scale, pitch), 'ulipsync', 0.3, profile));
      expect(ok(pose), `${code}: ${JSON.stringify(pose)}`).toBe(true);
    }
  });

  it('follows a Pink Trombone sweep ah -> ee -> oo', SLOW, () => {
    const profile = calibrate(pinkTromboneVoice());
    const frames = runLive(renderSweep([{ config: PT_VOWELS.AA, seconds: 0.6 }, { config: PT_VOWELS.IY, seconds: 0.6 }, { config: PT_VOWELS.UW, seconds: 0.6 }]), 'ulipsync', 0.3, profile);
    const at = (t: number) => frames[Math.floor(t / DT)];
    expect(at(0.45).sound).toBe('AA');
    expect(at(1.05).sound).toBe('IY');
    expect(at(1.65).sound).toBe('UW');
  });

  it('trades lag for steadiness with the smoothness setting (measured on sentences)', SLOW, () => {
    const profile = calibrate(klattschVoice(1.15, 200));
    const texts = ['Hello there! How are you today?', 'I can see the moon, she said. Oh wow!'];
    const run = (smoothSeconds: number) => {
      let r = 0;
      let jerk = 0;
      for (const t of texts) {
        const perf = compilePerformance(textToBabble(t, { seed: 3 }).phonemes, { ...DEFAULT_VOICE, formantScale: 1.15, pitchHz: 200 });
        const raw = renderPerformance(perf, SR);
        const noise = roomNoise(raw.length / SR, 0.002);
        const audio = raw.map((v, i) => v + noise[i]);
        const est = new LiveMouthEstimator({ ...DEFAULT_LIVE, shapeMode: 'ulipsync', smoothSeconds, gateDb: profile.suggested.gateDb, rangeDb: profile.suggested.rangeDb });
        est.setProfile(profile);
        const hop = Math.round(SR * DT);
        const jaw: number[] = [];
        const width: number[] = [];
        const refW: number[] = [];
        for (let end = 3072; end <= audio.length; end += hop) {
          const f = audio.subarray(end - N, end);
          const fr = est.process(f, magnitudeSpectrumDb(f), SR, DT, audio.subarray(end - 3072, end));
          jaw.push(fr.jawOpen);
          width.push(fr.lipWidth);
          refW.push(sampleFaceTrack(generateFaceTrack(perf), end / SR).lipWidth);
        }
        r += pearson(width, refW) / texts.length;
        for (let i = 2; i < jaw.length; i++) jerk += Math.abs(jaw[i] - 2 * jaw[i - 1] + jaw[i - 2]) / (jaw.length - 2) / texts.length;
      }
      return { r, jerk };
    };
    const fast = run(0.02);
    const faithful = run(ULS.smoothness);
    expect(fast.r).toBeGreaterThan(faithful.r); // faster spring tracks shapes better…
    expect(faithful.jerk).toBeLessThan(fast.jerk); // …and the default spring is steadier
  });
});
