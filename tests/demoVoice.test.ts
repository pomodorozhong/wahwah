import { describe, expect, it } from 'vitest';
import { demoStepAudio, liveSpeechAudio } from '../src/live/demoVoice';
import { CALIBRATION_STEPS } from '../src/live/profile';
import { rmsEnvelope } from '../src/analysis';
import { runLive } from './helpers/liveEval';

describe('Rust synthetic live inputs', () => {
  it.each([24000, 44100, 48000])('renders both looping speech sources at %i Hz', sampleRate => {
    const test = liveSpeechAudio('test', sampleRate);
    const demo = liveSpeechAudio('demo', sampleRate);
    for (const [source, audio] of [['test', test], ['demo', demo]] as const) {
      expect(audio).toBeInstanceOf(Float32Array);
      expect(audio.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
      expect(audio.length / sampleRate).toBeGreaterThan(2);
      expect(Math.max(...rmsEnvelope(audio, sampleRate))).toBeGreaterThan(0.1);
      expect(audio).toEqual(liveSpeechAudio(source, sampleRate));
    }
    expect(test).not.toEqual(demo);
  });

  it('waits after each calibration prompt and then supplies every requested sound', () => {
    const sr = 24000;
    expect(demoStepAudio('silence', sr)).toBeNull();
    for (const { id } of CALIBRATION_STEPS.slice(1)) {
      const audio = demoStepAudio(id, sr)!;
      expect(audio.subarray(0, Math.floor(0.69 * sr)).every(v => v === 0)).toBe(true);
      // 0.7 s reaction, 2.6 s sound, and the renderer's 0.15 s release tail.
      expect(audio.length / sr).toBeCloseTo(3.45, 2);
      expect(audio.every(Number.isFinite)).toBe(true);
      expect(Math.max(...rmsEnvelope(audio.subarray(sr), sr))).toBeGreaterThan(0.1);
    }
  });

  it('moves the live estimator from the rendered audio', () => {
    for (const source of ['test', 'demo'] as const) {
      const frames = runLive(liveSpeechAudio(source, 48000));
      expect(frames.some(f => f.jawOpen > 0.6)).toBe(true);
      expect(frames.some(f => f.lipWidth > 0.5)).toBe(true);
      expect(frames.every(f => Number.isFinite(f.jawOpen))).toBe(true);
    }
  });
});
