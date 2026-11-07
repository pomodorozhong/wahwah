import { describe, expect, it } from 'vitest';
import { NEUTRAL, lerpControls, normalizeControls, sampleFaceTrack, segmentAt, type FaceControlTrack, type Timeline } from '../src/performance/index';

const track: FaceControlTrack = {
  sampleRateHz: 10,
  durationSeconds: 0.3,
  samples: [
    { timeSeconds: 0, jawOpen: 0, lipWidth: 0, lipRound: 0, phoneme: null },
    { timeSeconds: 0.1, jawOpen: 1, lipWidth: 0.5, lipRound: 0, phoneme: 'AA' },
    { timeSeconds: 0.2, jawOpen: 0.5, lipWidth: 0, lipRound: 0.5, phoneme: 'UW' },
    { timeSeconds: 0.3, jawOpen: 0, lipWidth: 0, lipRound: 0, phoneme: null },
  ],
};

describe('sampleFaceTrack', () => {
  it('is neutral before the start, at the end and after it', () => {
    for (const t of [-1, 0, 0.3, 5]) expect(sampleFaceTrack(track, t)).toEqual(NEUTRAL);
  });

  it('interpolates between samples', () => {
    const c = sampleFaceTrack(track, 0.05);
    expect(c.jawOpen).toBeCloseTo(0.5);
    expect(c.lipWidth).toBeCloseTo(0.25);
  });

  it('is neutral for an empty track', () => {
    expect(sampleFaceTrack({ sampleRateHz: 100, durationSeconds: 1, samples: [] }, 0.5)).toEqual(NEUTRAL);
  });
});

describe('controls', () => {
  it('clamps values and lets rounding win over width', () => {
    expect(normalizeControls({ jawOpen: 2, lipWidth: 0.8, lipRound: 0.6 })).toEqual({ jawOpen: 1, lipWidth: 0.4, lipRound: 0.6 });
    expect(normalizeControls({ jawOpen: -1, lipWidth: -1, lipRound: -1 })).toEqual(NEUTRAL);
  });

  it('interpolates linearly', () => {
    expect(lerpControls(NEUTRAL, { jawOpen: 1, lipWidth: 0.5, lipRound: 0 }, 0.5)).toEqual({ jawOpen: 0.5, lipWidth: 0.25, lipRound: 0 });
  });
});

describe('segmentAt', () => {
  const timeline: Timeline = {
    durationSeconds: 0.3,
    segments: [
      { phoneme: 'HH', startSeconds: 0, endSeconds: 0.1, srcStart: 0, srcEnd: 1 },
      { phoneme: null, startSeconds: 0.1, endSeconds: 0.2, srcStart: 1, srcEnd: 1 },
    ],
  };

  it('finds the sounding segment, including pauses', () => {
    expect(segmentAt(timeline, 0.05)?.phoneme).toBe('HH');
    expect(segmentAt(timeline, 0.15)?.phoneme).toBeNull();
  });

  it('returns null outside every segment', () => {
    expect(segmentAt(timeline, 0.25)).toBeNull();
  });
});
