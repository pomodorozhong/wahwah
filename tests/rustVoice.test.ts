import { describe, expect, it } from 'vitest';
import { rmsEnvelope, syncReport } from '../src/analysis';
import { DEFAULT_TROMBONE } from '../src/voice/trombone';
import { sampleFaceTrack, NEUTRAL } from '@wahwah/performance';
import { VISEMES } from '../src/puppet/visemes';
import { STYLES, MOODS } from '../src/mumble/styles';
import { DEFAULT_VOICE } from '../src/voice/performance';
import { renderMumble, renderPhonemes, type RustVoice } from '../src/voice/rustVoice';

const SR = 24000;
const voices: [string, RustVoice][] = [
  ['formant voice', { engine: 'formant', brassColor: 0.75 }],
  ['wah-wah trombone', { engine: 'trombone', trombone: DEFAULT_TROMBONE }],
];

describe.each(voices)('%s complete performance through WASM', (_name, voice) => {
  it.each([22050, 24000, 44100, 48000])('returns typed audio and a synchronized Rust mouth track at %i Hz', sampleRate => {
    const p = renderPhonemes('HH EH L OW , M IY B AA', DEFAULT_VOICE, sampleRate, voice);
    expect(p.warnings).toEqual([]);
    expect(p.audio).toBeInstanceOf(Float32Array);
    expect(p.audio.length).toBe(Math.ceil(p.timeline.durationSeconds * sampleRate));
    expect(p.audio.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    expect(Math.max(...rmsEnvelope(p.audio, sampleRate))).toBeGreaterThan(0.05);
    expect(p.track!.durationSeconds).toBe(p.timeline.durationSeconds);
    expect(p.track!.samples.at(-1)!.timeSeconds).toBe(p.timeline.durationSeconds);
    expect(sampleFaceTrack(p.track!, p.timeline.durationSeconds)).toEqual(NEUTRAL);
  });

  it('returns repeatable audio and mouth movement', () => {
    const a = renderMumble('Hello there!', { seed: 7 }, DEFAULT_VOICE, SR, voice);
    const b = renderMumble('Hello there!', { seed: 7 }, DEFAULT_VOICE, SR, voice);
    expect(a).toEqual(b);
    expect(a.script.phonemes).not.toBe(renderMumble('Hello there!', { seed: 8 }, DEFAULT_VOICE, SR, voice).script.phonemes);
  });

  it('skips mouth generation when puppet output is off', () => {
    const on = renderPhonemes('AA M AA', DEFAULT_VOICE, SR, voice);
    const off = renderPhonemes('AA M AA', DEFAULT_VOICE, SR, voice, false);
    expect(off.track).toBeNull();
    expect(off.audio).toEqual(on.audio);
    expect(off.timeline).toEqual(on.timeline);
  });

  it('closes M and pauses while keeping distinct vowels', () => {
    const p = renderPhonemes('AA M AA , IY UW', { ...DEFAULT_VOICE, msPerPhoneme: 200 }, SR, voice);
    const middle = (i: number) => {
      const s = p.timeline.segments[i];
      return sampleFaceTrack(p.track!, (s.startSeconds + s.endSeconds) / 2);
    };
    expect(middle(0).jawOpen).toBeGreaterThan(0.7);
    expect(middle(1).jawOpen).toBeLessThan(0.1);
    // A short comma blends into the next sound; it still closes more than AA.
    expect(middle(3).jawOpen).toBeLessThan(middle(2).jawOpen);
    expect(middle(4).lipWidth).toBeGreaterThan(0.7);
    expect(middle(5).lipRound).toBeGreaterThan(0.8);
  });

  it('makes valid scores for every Mumble style and mood', () => {
    for (const style of STYLES) for (const mood of MOODS) {
      const p = renderMumble('Hello there! How are you?', { seed: 11, styleId: style.id, moodId: mood.id }, DEFAULT_VOICE, SR, voice);
      expect(p.warnings).toEqual([]);
      expect(p.script.words).toHaveLength(5);
      expect(p.track!.samples.some(s => s.jawOpen > 0.5)).toBe(true);
    }
  });

  it('applies mood to the whole performance', () => {
    const happy = renderMumble('Hello there.', { seed: 1, moodId: 'happy' }, DEFAULT_VOICE, SR, voice);
    const sad = renderMumble('Hello there.', { seed: 1, moodId: 'sad' }, DEFAULT_VOICE, SR, voice);
    expect(happy.timeline.durationSeconds).toBeLessThan(sad.timeline.durationSeconds);
  });

  it('returns UTF-16 source ranges after emoji and smart punctuation', () => {
    const text = '🧊 It’s fine — hello!';
    const p = renderMumble(text, { seed: 1 }, DEFAULT_VOICE, SR, voice);
    expect(p.script.words[0].srcStart).toBe(3);
    for (const w of p.script.words) expect(text.slice(w.srcStart, w.srcEnd)).toBe(w.text);
    for (const s of p.timeline.segments.filter(s => s.phoneme)) {
      expect(p.script.phonemes.slice(s.srcStart, s.srcEnd)).toContain(s.phoneme);
    }
    const phonemes = '// 🧊 It’s fine\n AA IY';
    for (const s of renderPhonemes(phonemes, DEFAULT_VOICE, SR, voice).timeline.segments.filter(s => s.phoneme)) {
      expect(phonemes.slice(s.srcStart, s.srcEnd)).toContain(s.phoneme);
    }
  });

  it('keeps silent input neutral and reports invalid phonemes', () => {
    const p = renderMumble('?!...', { seed: 1 }, DEFAULT_VOICE, SR, voice);
    expect(p.audio.every(v => v === 0)).toBe(true);
    expect(p.track!.samples.every(s => s.jawOpen === 0 && s.lipWidth === 0 && s.lipRound === 0)).toBe(true);
    expect(renderPhonemes('QQ', DEFAULT_VOICE, SR, voice).warnings).toEqual(['unknown phoneme: QQ']);
  });
});

it('Rust and live TypeScript use the same held mouth poses', () => {
  for (const code of ['AA', 'IY', 'UW', 'M', 'B', 'P']) {
    const p = renderPhonemes(code, { ...DEFAULT_VOICE, msPerPhoneme: 500 }, SR, voices[0][1]);
    const sample = p.track!.samples.reduce((a,b) => a.jawOpen + a.lipWidth + a.lipRound > b.jawOpen + b.lipWidth + b.lipRound ? a : b);
    expect(sample.jawOpen).toBeCloseTo(VISEMES[code].pose.jawOpen, 2);
    expect(sample.lipWidth).toBeCloseTo(VISEMES[code].pose.lipWidth, 2);
    expect(sample.lipRound).toBeCloseTo(VISEMES[code].pose.lipRound, 2);
  }
});

it('mouth movement follows the audible vowel pulses', () => {
  const p = renderPhonemes('AA . AA . AA', DEFAULT_VOICE, SR, voices[0][1]);
  const report = syncReport(p.audio, SR, p.track!);
  expect(report.jawLoudnessCorrelation).toBeGreaterThan(0.8);
  expect(Math.abs(report.jawLeadSeconds)).toBeLessThanOrEqual(0.04);
});

it('rejects invalid rendering parameters at the browser boundary', () => {
  expect(() => renderPhonemes('AA', DEFAULT_VOICE, 0, voices[0][1])).toThrow(/Sample rate/);
  expect(() => renderPhonemes('AA', { ...DEFAULT_VOICE, pitchHz: NaN }, SR, voices[0][1])).toThrow(/finite/);
});
