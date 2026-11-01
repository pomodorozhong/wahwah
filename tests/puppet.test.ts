import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, compilePerformance, renderPerformance } from '../src/voice/performance';
import { generateFaceTrack, sampleFaceTrack } from '../src/puppet/generate';
import { NEUTRAL, normalizeControls } from '../src/puppet/controls';
import { syncReport } from '../src/analysis';
import { PRESETS } from '../src/voice/presets';

const voice = { ...DEFAULT_VOICE, msPerPhoneme: 200 };
const midOf = (perf: ReturnType<typeof compilePerformance>, i: number) =>
  (perf.segments[i].startSeconds + perf.segments[i].endSeconds) / 2;

describe('puppet instruction generator', () => {
  it('runs without a Three.js scene or DOM', () => {
    expect(typeof globalThis.document).toBe('undefined');
    const track = generateFaceTrack(compilePerformance('AA IY UW', voice));
    expect(track.samples.length).toBeGreaterThan(10);
  });

  it('keeps every control in [0, 1] with lipWidth + lipRound <= 1', () => {
    for (const p of PRESETS) {
      for (const s of generateFaceTrack(compilePerformance(p.phonemes, p.voice)).samples) {
        for (const v of [s.jawOpen, s.lipWidth, s.lipRound]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        expect(s.lipWidth + s.lipRound).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('produces visibly different poses for AA, IY, UW and M', () => {
    const perf = compilePerformance('AA IY UW M', voice);
    const track = generateFaceTrack(perf);
    const [aa, iy, uw, m] = [0, 1, 2, 3].map((i) => sampleFaceTrack(track, midOf(perf, i)));
    expect(aa.jawOpen).toBeGreaterThan(0.7);
    expect(iy.lipWidth).toBeGreaterThan(0.7);
    expect(uw.lipRound).toBeGreaterThan(0.8);
    expect(m.jawOpen).toBeLessThan(0.1);
  });

  it('starts and ends at neutral, and is neutral outside the track', () => {
    const track = generateFaceTrack(compilePerformance('AA AA', voice));
    const last = track.samples[track.samples.length - 1];
    expect({ jawOpen: last.jawOpen, lipWidth: last.lipWidth, lipRound: last.lipRound }).toEqual(NEUTRAL);
    expect(sampleFaceTrack(track, -1)).toEqual(NEUTRAL);
    expect(sampleFaceTrack(track, track.durationSeconds + 1)).toEqual(NEUTRAL);
    expect(sampleFaceTrack(track, 0)).toEqual(NEUTRAL);
  });

  it('changes smoothly (no jump larger than 0.15 per 10 ms)', () => {
    for (const p of PRESETS) {
      const { samples } = generateFaceTrack(compilePerformance(p.phonemes, p.voice));
      for (let i = 1; i < samples.length; i++) {
        expect(Math.abs(samples[i].jawOpen - samples[i - 1].jawOpen)).toBeLessThan(0.15);
      }
    }
  });

  it('rounding wins over width when both are requested', () => {
    const c = normalizeControls({ jawOpen: 2, lipWidth: 0.8, lipRound: 0.7 });
    expect(c.jawOpen).toBe(1);
    expect(c.lipRound).toBe(0.7);
    expect(c.lipWidth).toBeCloseTo(0.3, 9);
  });
});

describe('audio/face synchronization (objective, no listening needed)', () => {
  // On an "AA . AA . AA" phrase, loudness and jaw opening should rise and fall
  // together. This checks they share one timeline at several speaking rates.
  it.each([80, 110, 200])('jaw follows loudness at %i ms/phoneme', (msPerPhoneme) => {
    const perf = compilePerformance('AA . AA . AA', { ...DEFAULT_VOICE, msPerPhoneme });
    const report = syncReport(renderPerformance(perf, 48000), 48000, generateFaceTrack(perf));
    expect(report.jawLoudnessCorrelation).toBeGreaterThan(0.8);
    expect(Math.abs(report.jawLeadSeconds)).toBeLessThanOrEqual(0.04);
  });

  it('detects a deliberately shifted track (negative control)', () => {
    const perf = compilePerformance('AA . AA . AA', DEFAULT_VOICE);
    const audio = renderPerformance(perf, 48000);
    const track = generateFaceTrack(perf);
    const shifted = { ...track, samples: track.samples.map((s, i) => ({ ...track.samples[Math.max(0, i - 25)], timeSeconds: s.timeSeconds })) };
    const good = syncReport(audio, 48000, track);
    const bad = syncReport(audio, 48000, shifted);
    expect(bad.jawLoudnessCorrelation).toBeLessThan(good.jawLoudnessCorrelation - 0.2);
  });
});
