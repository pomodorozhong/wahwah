import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, compilePerformance, renderPerformance, segmentAt } from '../src/voice/performance';
import { PRESETS } from '../src/voice/presets';
import { rmsEnvelope } from '../src/analysis';

describe('voice module', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('preset %s compiles cleanly and renders audible audio', (_id, preset) => {
    const perf = compilePerformance(preset.phonemes, preset.voice);
    expect(perf.warnings).toEqual([]);
    const audio = renderPerformance(perf, 48000);
    const env = rmsEnvelope(audio, 48000);
    expect(Math.max(...env)).toBeGreaterThan(0.1);
    // Most of the utterance is sound, not silence.
    expect(env.filter((v) => v > 0.01).length / env.length).toBeGreaterThan(0.5);
  });

  it('speaking rate changes duration', () => {
    const slow = compilePerformance('M AA L IY', { ...DEFAULT_VOICE, msPerPhoneme: 200 });
    const fast = compilePerformance('M AA L IY', { ...DEFAULT_VOICE, msPerPhoneme: 80 });
    expect(slow.durationSeconds).toBeGreaterThan(fast.durationSeconds);
  });

  it.each([0.75, 1])('keeps the consonant, pause and voiced pitch at brass color %s', (color) => {
    const sr = 24000;
    const perf = compilePerformance('SH AA(+40) , UW', { ...DEFAULT_VOICE, msPerPhoneme: 300 });
    const dry = renderPerformance(perf, sr);
    const brass = renderPerformance(perf, sr, color);
    const [, aa, pause, uw] = perf.segments;
    expect(brass.length).toBe(dry.length);
    const sample = (seconds: number) => Math.round(seconds * sr);
    expect(brass.slice(0, sample(aa.startSeconds))).toEqual(dry.slice(0, sample(aa.startSeconds)));
    expect(brass.slice(sample(pause.startSeconds + 0.06), sample(pause.endSeconds)).every(x => Math.abs(x) < 0.0001)).toBe(true);

    const start = sample(uw.startSeconds + 0.12);
    const rms = (value: (i: number) => number) => Math.sqrt(
      Array.from({ length: sr / 10 }, (_, i) => value(start + i) ** 2).reduce((a, b) => a + b) / (sr / 10),
    );
    expect(rms(i => brass[i] - dry[i])).toBeGreaterThan(0.05);
    // Both voices settle back to 120 Hz after the bend: one period at 24 kHz is 200 samples.
    for (const audio of [dry, brass]) {
      expect(rms(i => audio[i] - audio[i - 200])).toBeLessThan(rms(i => audio[i] - audio[i - 100]) * 0.2);
    }
  });

  it('keeps phoneme identity and timing in segments', () => {
    const perf = compilePerformance('M AA , IY', DEFAULT_VOICE);
    expect(perf.segments.map((s) => s.phoneme)).toEqual(['M', 'AA', null, 'IY']);
    for (let i = 1; i < perf.segments.length; i++) {
      expect(perf.segments[i].startSeconds).toBeCloseTo(perf.segments[i - 1].endSeconds, 6);
    }
    const aa = perf.segments[1];
    expect(segmentAt(perf, (aa.startSeconds + aa.endSeconds) / 2)?.phoneme).toBe('AA');
  });

  it('reports unknown phonemes as warnings instead of throwing', () => {
    const perf = compilePerformance('AA QQ', DEFAULT_VOICE);
    expect(perf.warnings.join(' ')).toMatch(/QQ/);
  });
});
