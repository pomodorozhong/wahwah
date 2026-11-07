import { describe, expect, it } from 'vitest';
import { runLive, heldPose, SR, DT, N } from './helpers/liveEval';
import { estimateFormants, periodicity } from '../src/live/features';
import { matchVowel, bestScale, REFERENCE_VOWELS } from '../src/live/vowels';
import { LiveMouthEstimator, DEFAULT_LIVE } from '../src/live/estimator';
import { renderSweep, renderTract, PT_VOWELS } from '../src/live/ptVoice';
import { magnitudeSpectrumDb } from '../src/live/features';
import { DEFAULT_VOICE } from 'wahwah';
import { sampleFaceTrack } from 'wahwah/performance';
import { generateMumble } from 'wahwah/mumble';
import { renderFormant } from './helpers/voice';
import { pearson } from '../src/analysis';
import { VISEMES } from '../src/puppet/visemes';

const held = (code: string, pitchHz = 120, formantScale = 1) =>
  renderFormant(code, { ...DEFAULT_VOICE, pitchHz, formantScale, msPerPhoneme: 700 }, SR).audio;

const medianFormants = (audio: Float32Array) => {
  const f1: number[] = [];
  const f2: number[] = [];
  for (let s = Math.floor(audio.length * 0.35); s + N <= audio.length * 0.65; s += 512) {
    const f = estimateFormants(audio.subarray(s, s + N), SR);
    f1.push(f.f1);
    f2.push(f.f2);
  }
  const med = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  return { f1: med(f1), f2: med(f2) };
};

describe('formant estimation (LPC)', () => {
  // Rust formant vowels have known targets; allow ~15%.
  it.each([
    ['AA', 700, 1220], ['AH', 620, 1220], ['IY', 310, 2020], ['UH', 450, 1100],
  ])('%s: F1 ≈ %i Hz, F2 ≈ %i Hz', (code, f1, f2) => {
    for (const pitch of [110, 220]) {
      const est = medianFormants(held(code as string, pitch));
      expect(Math.abs(est.f1 - (f1 as number)) / (f1 as number)).toBeLessThan(0.15);
      expect(Math.abs(est.f2 - (f2 as number)) / (f2 as number)).toBeLessThan(0.15);
    }
  });

  it('reads Pink Trombone vowels (a different synthesizer) in the right regions', () => {
    const aa = medianFormants(renderTract(PT_VOWELS.AA));
    const iy = medianFormants(renderTract(PT_VOWELS.IY));
    const uw = medianFormants(renderTract(PT_VOWELS.UW));
    expect(aa.f1).toBeGreaterThan(600);
    expect(iy.f2).toBeGreaterThan(1800);
    expect(uw.f2).toBeLessThan(1000);
  });

  it('separates pitched sound from hiss', () => {
    const tone = Float32Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 150 * i) / SR));
    let x = 1;
    const noise = Float32Array.from({ length: N }, () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1);
    expect(periodicity(tone, SR).value).toBeGreaterThan(0.9);
    expect(periodicity(tone, SR).pitchHz).toBeCloseTo(150, -1);
    expect(periodicity(noise, SR).value).toBeLessThan(0.3);
  });
});

describe('vowel matching', () => {
  it('maps each reference vowel to itself at scale 1', () => {
    for (const v of REFERENCE_VOWELS) expect(matchVowel(v.f1, v.f2, 1).code).toBe(v.code);
  });

  it('finds the speaker scale of a shifted vowel', () => {
    const iy = REFERENCE_VOWELS.find((v) => v.code === 'IY')!;
    // An "ee" with formants 20% higher reads as "ee" once the scale is known.
    expect(matchVowel(iy.f1 * 1.2, iy.f2 * 1.2, 1.2).code).toBe('IY');
    expect(bestScale(iy.f1 * 1.2, iy.f2 * 1.2)).toBeGreaterThan(1);
  });

  it('blends poses from the designed visemes', () => {
    const m = matchVowel(320, 900, 1);
    expect(m.code).toBe('UW');
    expect(m.pose.lipRound).toBeGreaterThan(0.5);
    expect(VISEMES.UW.pose.lipRound).toBe(1);
  });
});

describe('live mouth shapes (formant mode)', () => {
  it.each([
    ['AA', 'jaw open', (p: ReturnType<typeof heldPose>) => p.jawOpen > 0.6 && p.lipRound < 0.2],
    ['IY', 'wide, nearly closed', (p: ReturnType<typeof heldPose>) => p.lipWidth > 0.6 && p.jawOpen < 0.45],
    ['UW', 'rounded', (p: ReturnType<typeof heldPose>) => p.lipRound > 0.6 && p.lipWidth < 0.2],
    ['EH', 'spread, half open', (p: ReturnType<typeof heldPose>) => p.lipWidth > 0.4 && p.jawOpen > 0.4],
    ['S', 'teeth together, spread', (p: ReturnType<typeof heldPose>) => p.sound === 'S' && p.jawOpen < 0.2],
    ['SH', 'rounded hiss', (p: ReturnType<typeof heldPose>) => p.sound === 'SH' && p.lipRound > 0.4],
  ])('Rust formant %s reads as %s', (code, _label, check) => {
    const pose = heldPose(runLive(held(code as string)));
    expect(check(pose), JSON.stringify(pose)).toBe(true);
  });

  it.each([
    ['AA', (p: ReturnType<typeof heldPose>) => p.jawOpen > 0.6 && p.lipRound < 0.3],
    ['IY', (p: ReturnType<typeof heldPose>) => p.lipWidth > 0.6 && p.lipRound < 0.1],
    ['UW', (p: ReturnType<typeof heldPose>) => p.lipRound > 0.8 && p.lipWidth < 0.1],
  ] as const)('Pink Trombone %s (a voice it was not tuned on) reads correctly', (code, check) => {
    const pose = heldPose(runLive(renderTract(PT_VOWELS[code], SR, 0.7, 130)));
    expect(check(pose), JSON.stringify(pose)).toBe(true);
  });

  it('follows a Pink Trombone vowel sweep ah -> ee -> oo', () => {
    const audio = renderSweep([
      { config: PT_VOWELS.AA, seconds: 0.6 },
      { config: PT_VOWELS.IY, seconds: 0.6 },
      { config: PT_VOWELS.UW, seconds: 0.6 },
    ]);
    const frames = runLive(audio);
    const at = (t: number) => frames[Math.floor(t / DT)];
    expect(at(0.45).jawOpen).toBeGreaterThan(at(1.05).jawOpen);
    expect(at(1.05).lipWidth).toBeGreaterThan(0.5);
    expect(at(1.65).lipRound).toBeGreaterThan(0.6);
  });

  it('closes the lips for a quiet low hum after louder speech (m murmur rule)', () => {
    // Constructed signal: a vowel-like buzz, then a 14 dB quieter pure low hum.
    const vowel = Float32Array.from({ length: SR * 0.5 }, (_, i) => {
      const t = i / SR;
      return 0.3 * (Math.sin(2 * Math.PI * 130 * t) + 0.6 * Math.sin(2 * Math.PI * 650 * t) + 0.4 * Math.sin(2 * Math.PI * 1170 * t));
    });
    const hum = Float32Array.from({ length: SR * 0.4 }, (_, i) => 0.06 * Math.sin((2 * Math.PI * 130 * i) / SR) + 0.02 * Math.sin((2 * Math.PI * 260 * i) / SR));
    const audio = new Float32Array(vowel.length + hum.length);
    audio.set(vowel);
    audio.set(hum, vowel.length);
    const frames = runLive(audio);
    const late = frames.slice(Math.floor(0.7 / DT), Math.floor(0.85 / DT));
    expect(late.every((f) => f.soundClass === 'closure')).toBe(true);
    expect(late.at(-1)!.jawOpen).toBeLessThan(0.1);
  });

  it('beats the brightness-only mode on lip width in whole sentences (objective score)', () => {
    // Score: correlation with the face track the text pipeline makes for the
    // same rendered sentence, for an adult-male-like and a smaller voice.
    const cases = ['Hello there! How are you today?', 'I can see the moon, she said. Oh wow!'].flatMap((t) =>
      [1, 1.15].map((scale) => {
        const s = generateMumble(t, { seed: 3 });
        const perf = renderFormant(s.phonemes, { ...DEFAULT_VOICE, formantScale: scale, pitchHz: scale > 1 ? 200 : 120 });
        return { audio: perf.audio, track: perf.track! };
      }),
    );
    const score = (mode: 'centroid' | 'formants', key: 'jawOpen' | 'lipWidth') =>
      cases.reduce((sum, c) => {
        const fr = runLive(c.audio, mode);
        const ref = fr.map((_, i) => sampleFaceTrack(c.track, i * DT + N / SR));
        return sum + pearson(fr.map((f) => f[key]), ref.map((x) => x[key])) / cases.length;
      }, 0);
    const width = score('formants', 'lipWidth');
    expect(width).toBeGreaterThan(0.45);
    expect(width).toBeGreaterThan(score('centroid', 'lipWidth') + 0.25);
    expect(score('formants', 'jawOpen')).toBeGreaterThan(score('centroid', 'jawOpen') - 0.1);
  });

  it('adapts its speaker scale toward a smaller voice over a sentence', () => {
    const s = generateMumble('Hello there! How are you today? I can see the moon.', { seed: 3 });
    const small = runLive(renderFormant(s.phonemes, { ...DEFAULT_VOICE, formantScale: 1.25, pitchHz: 220 }, SR).audio);
    const big = runLive(renderFormant(s.phonemes, { ...DEFAULT_VOICE, formantScale: 1, pitchHz: 110 }, SR).audio);
    expect(small.at(-1)!.speakerScale).toBeGreaterThan(big.at(-1)!.speakerScale);
  });

  it('runs fast enough for every display frame', () => {
    const est = new LiveMouthEstimator({ ...DEFAULT_LIVE });
    const audio = held('AA');
    const frame = audio.subarray(10000, 10000 + N);
    const spec = magnitudeSpectrumDb(frame);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) est.process(frame, spec, SR, DT);
    expect((performance.now() - t0) / 100).toBeLessThan(4); // ms per frame, well under 16.7
  });
});
