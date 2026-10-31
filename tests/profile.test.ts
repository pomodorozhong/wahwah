import { describe, expect, it } from 'vitest';
import { runLive, heldPose, SR, DT, N } from './helpers/liveEval';
import { calibrate, klattschVoice, lowpass, pinkTromboneVoice, roomNoise, type StepVoice } from './helpers/calibrate';
import { Calibration, CALIBRATION_STEPS, classify, argmax, parseProfile, serializeProfile } from '../src/live/profile';
import { mfcc } from '../src/live/mfcc';
import { magnitudeSpectrumDb } from '../src/live/features';
import { DEFAULT_VOICE, compilePerformance, renderPerformance } from '../src/voice/performance';
import { renderSweep, PT_VOWELS } from '../src/live/ptVoice';
import { generateFaceTrack, sampleFaceTrack } from '../src/puppet/generate';
import { textToBabble } from '../src/babble/generate';
import { pearson } from '../src/analysis';

const SLOW = { timeout: 60000 };
const held = (code: string, formantScale: number, pitchHz: number) =>
  renderPerformance(compilePerformance(code, { ...DEFAULT_VOICE, formantScale, pitchHz, msPerPhoneme: 700 }), SR);

describe('MFCC features', () => {
  it('differ between vowels and match for the same vowel at another pitch', () => {
    const m = (code: string, pitch: number) => {
      const a = held(code, 1, pitch);
      return mfcc(magnitudeSpectrumDb(a.subarray(10000, 10000 + N)), SR);
    };
    const d = (x: Float64Array, y: Float64Array) => Math.hypot(...x.map((v, i) => v - y[i]));
    expect(d(m('AA', 120), m('IY', 120))).toBeGreaterThan(d(m('AA', 120), m('AA', 140)) * 2);
  });
});

describe('voice profile calibration', () => {
  it('builds a profile with every sound recognized, and suggests settings', SLOW, () => {
    const p = calibrate(klattschVoice(1.15, 200));
    expect(p.classes.map((c) => c.id)).toEqual(CALIBRATION_STEPS.map((s) => s.id));
    for (const acc of Object.values(p.quality.accuracy)) expect(acc).toBeGreaterThan(0.9);
    expect(p.quality.messages[0].level).toBe('ok');
    expect(p.suggested.gateDb).toBeGreaterThanOrEqual(4);
    expect(p.noiseFloorDb).toBeLessThan(p.vowelLevelDb - 30);
  });

  // The point of calibration: voices far from the textbook reference. Formant
  // mode misreads these (a child-sized voice's "oo" reads as "er"); the profile
  // made from the same voice reads them correctly.
  it.each([
    ['adult female-like', 1.15, 200],
    ['child-like', 1.3, 270],
  ] as const)('reads a %s voice correctly after calibration', SLOW, (_name, scale, pitch) => {
    const profile = calibrate(klattschVoice(scale, pitch));
    const expectations: [string, (p: ReturnType<typeof heldPose>) => boolean][] = [
      ['AA', (p) => p.sound === 'AA' && p.jawOpen > 0.8],
      ['IY', (p) => p.sound === 'IY' && p.lipWidth > 0.8],
      ['UW', (p) => p.sound === 'UW' && p.lipRound > 0.9],
      ['EH', (p) => p.sound === 'EH' && p.lipWidth > 0.4],
      ['M', (p) => p.sound === 'M' && p.jawOpen < 0.05],
      ['S', (p) => p.sound === 'S' && p.lipWidth > 0.5],
      ['SH', (p) => p.sound === 'SH' && p.lipRound > 0.5],
    ];
    for (const [code, ok] of expectations) {
      const pose = heldPose(runLive(held(code, scale, pitch), 'profile', 0.3, profile));
      expect(ok(pose), `${code}: ${JSON.stringify(pose)}`).toBe(true);
    }
    // And formant mode, uncalibrated, gets this voice's "oo" wrong.
    const uncal = heldPose(runLive(held('UW', scale, pitch), 'formants'));
    expect(uncal.lipRound).toBeLessThan(0.6);
  });

  it('works for a different synthesizer: Pink Trombone calibrates and its vowel sweep reads ah -> ee -> oo', SLOW, () => {
    const profile = calibrate(pinkTromboneVoice());
    const frames = runLive(
      renderSweep([{ config: PT_VOWELS.AA, seconds: 0.6 }, { config: PT_VOWELS.IY, seconds: 0.6 }, { config: PT_VOWELS.UW, seconds: 0.6 }]),
      'profile',
      0.3,
      profile,
    );
    const at = (t: number) => frames[Math.floor(t / DT)];
    expect(at(0.4).sound).toBe('AA');
    expect(at(1.0).sound).toBe('IY');
    expect(at(1.6).sound).toBe('UW');
    expect(at(1.6).lipRound).toBeGreaterThan(0.8);
  });

  it('keeps sentences moving: jaw and width track, rounding at least matches formant mode', SLOW, () => {
    const scale = 1.3;
    const pitch = 270;
    const profile = calibrate(klattschVoice(scale, pitch));
    const texts = ['Hello there! How are you today?', 'I can see the moon, she said. Oh wow!', 'My mom made more lemon muffins for me.'];
    const score = (mode: 'formants' | 'profile') => {
      const acc = { jawOpen: 0, lipWidth: 0, lipRound: 0 };
      for (const t of texts) {
        const perf = compilePerformance(textToBabble(t, { seed: 3 }).phonemes, { ...DEFAULT_VOICE, formantScale: scale, pitchHz: pitch });
        const fr = runLive(renderPerformance(perf, SR), mode, 0.3, profile);
        const track = generateFaceTrack(perf);
        const ref = fr.map((_, i) => sampleFaceTrack(track, i * DT + N / SR));
        for (const k of ['jawOpen', 'lipWidth', 'lipRound'] as const) acc[k] += pearson(fr.map((f) => f[k]), ref.map((x) => x[k])) / texts.length;
      }
      return acc;
    };
    const p = score('profile');
    const f = score('formants');
    expect(p.jawOpen).toBeGreaterThan(0.3);
    expect(p.lipWidth).toBeGreaterThan(0.3);
    expect(p.lipRound).toBeGreaterThan(f.lipRound - 0.05);
  });
});

describe('calibration quality checks', () => {
  it('reports a sound that was not heard', SLOW, () => {
    const base = klattschVoice();
    const voice: StepVoice = (id, s) => (id === 'UW' ? roomNoise(s) : base(id, s));
    const p = calibrate(voice);
    expect(p.quality.messages.some((m) => m.level === 'error' && m.text.includes('“oo”'))).toBe(true);
    expect(p.classes.some((c) => c.id === 'UW')).toBe(false);
  });

  it('warns when two recorded sounds are the same', SLOW, () => {
    const base = klattschVoice();
    const voice: StepVoice = (id, s) => base(id === 'EH' ? 'IY' : id, s); // said "ee" when asked for "eh"
    const p = calibrate(voice);
    expect(p.quality.messages.some((m) => m.level === 'warn' && m.text.includes('“eh”') && m.text.includes('“ee”'))).toBe(true);
  });

  it('warns about a telephone-band microphone (cut at ~4 kHz)', SLOW, () => {
    const base = klattschVoice();
    const p = calibrate((id, s) => lowpass(base(id, s), 3800));
    expect(p.quality.messages.some((m) => m.level === 'warn' && m.text.includes('above 4 kHz'))).toBe(true);
  });

  it('notes a 16 kHz-band "call mode" microphone (cut at ~8 kHz) without failing', SLOW, () => {
    const base = klattschVoice();
    const p = calibrate((id, s) => lowpass(base(id, s), 7600));
    expect(p.quality.messages.some((m) => m.level === 'ok' && m.text.includes('8 kHz'))).toBe(true);
    expect(p.quality.messages.some((m) => m.text.includes('above 4 kHz'))).toBe(false);
  });

  it('warns when the voice is barely above the room noise', SLOW, () => {
    const base = klattschVoice();
    const noisy: StepVoice = (id, s) => {
      const noise = roomNoise(s, 0.06);
      if (id === 'silence') return noise;
      const v = base(id, s);
      return v.map((x, i) => x * 0.15 + noise[i]);
    };
    const p = calibrate(noisy);
    expect(p.quality.messages.some((m) => m.text.includes('above the room noise'))).toBe(true);
  });
});

describe('profile storage', () => {
  it('round-trips through JSON and classifies the same', SLOW, () => {
    const p = calibrate(klattschVoice());
    const q = parseProfile(serializeProfile(p));
    const a = held('IY', 1, 120);
    const coeffs = mfcc(magnitudeSpectrumDb(a.subarray(12000, 12000 + N)), SR);
    expect(argmax(classify(q, coeffs))).toBe('IY');
    expect(argmax(classify(p, coeffs))).toBe('IY');
    expect(serializeProfile(p).length).toBeLessThan(60000);
  });

  it('rejects files that are not profiles', () => {
    expect(() => parseProfile('{"kind":"something-else"}')).toThrow(/Not a mumble voice profile/);
    expect(() => parseProfile('not json')).toThrow();
  });

  it('ignores the start of each step while the speaker begins the sound', () => {
    const cal = new Calibration();
    cal.add('AA', { mfcc: new Float64Array(12), levelDb: -20, highRatio: 0, veryHighRatio: 0, centroidHz: 0 }, 0.1);
    expect(cal.frames.get('AA')).toBeUndefined();
  });
});
