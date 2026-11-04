import { describe, expect, it } from 'vitest';
import { analyseRecording, measureMouthLagMs, mouthAt, planPlayback } from '../src/live/delayTest';
import { DEFAULT_LIVE } from '../src/live/estimator';
import { DEFAULT_VOICE } from '../src/voice/performance';
import { renderFormant } from './helpers/voice';
import { generateMumble } from '../src/mumble/generate';
import { calibrate, formantVoice, roomNoise } from './helpers/calibrate';

const SR = 48000;
const SLOW = { timeout: 60000 };
const speech = () => {
  const a = renderFormant(generateMumble('Hello there! How are you today? I can see the moon.', { seed: 3 }).phonemes, DEFAULT_VOICE, SR).audio;
  const n = roomNoise(a.length / SR, 0.002);
  return a.map((v, i) => v + n[i]);
};

describe('delay test: analysing a recording like live mode', () => {
  it('produces one causal frame per audio-thread hop (5.3 ms)', () => {
    const pcm = speech();
    const rec = analyseRecording(pcm, SR, DEFAULT_LIVE, null, 256);
    expect(rec.frames.length).toBeCloseTo(pcm.length / 256, -1);
    expect(rec.hopSeconds).toBeCloseTo(256 / SR, 9);
    expect(rec.frames.every((f, i) => i === 0 || f.t > rec.frames[i - 1].t)).toBe(true);
    expect(Math.max(...rec.frames.map((f) => f.jawOpen))).toBeGreaterThan(0.5);
  });

  it('shows neutral before the recording and interpolates between frames', () => {
    const rec = analyseRecording(speech(), SR, DEFAULT_LIVE, null);
    expect(mouthAt(rec, -1)).toEqual({ jawOpen: 0, lipWidth: 0, lipRound: 0 });
    const i = 300;
    const a = rec.frames[i];
    const b = rec.frames[i + 1];
    const mid = mouthAt(rec, (a.t + b.t) / 2);
    expect(mid.jawOpen).toBeCloseTo((a.jawOpen + b.jawOpen) / 2, 6);
  });

  it('measures how far the mouth trails the sound, and more smoothing trails further', SLOW, () => {
    const pcm = speech();
    const profile = calibrate(formantVoice());
    const quick = measureMouthLagMs(pcm, analyseRecording(pcm, SR, { ...DEFAULT_LIVE, shapeMode: 'ulipsync', smoothSeconds: 0 }, profile));
    const smooth = measureMouthLagMs(pcm, analyseRecording(pcm, SR, { ...DEFAULT_LIVE, shapeMode: 'ulipsync', smoothSeconds: 0.08 }, profile));
    expect(quick).toBeGreaterThan(0);
    expect(quick).toBeLessThan(150);
    expect(smooth).toBeGreaterThan(quick);
  });

  it('plans playback: a positive delay holds the audio back, a negative one plays it early', () => {
    const later = planPlayback(10, 120);
    expect(later.audioStart - later.mouthZero).toBeCloseTo(0.12, 9);
    expect(later.mouthZero).toBeGreaterThanOrEqual(10);
    const early = planPlayback(10, -80);
    expect(early.audioStart - early.mouthZero).toBeCloseTo(-0.08, 9);
    expect(early.audioStart).toBeGreaterThanOrEqual(10); // never scheduled in the past
  });
});
