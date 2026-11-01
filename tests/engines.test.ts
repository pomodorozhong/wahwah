import { describe, expect, it } from 'vitest';
import { MotionTracker } from '../src/puppet/motion';
import { NEUTRAL } from '../src/puppet/controls';
import { generateFaceTrack, sampleFaceTrack } from '../src/puppet/generate';
import { babbleEngineUtterance, revealedIndex, syllableSounds, syllablesToSegments } from '../src/engines/babbleEngine';
import { rmsEnvelope, syncReport } from '../src/analysis';

describe('motion tracker (debug puppet input)', () => {
  const dt = 1 / 60;

  it('reports velocity with the direction of change', () => {
    const m = new MotionTracker(0.001, 0.001);
    m.update({ ...NEUTRAL }, dt);
    let last = m.update({ ...NEUTRAL, jawOpen: 0.1 }, dt);
    for (let i = 2; i <= 10; i++) last = m.update({ ...NEUTRAL, jawOpen: 0.1 * i }, dt);
    expect(last.jawOpen.velocity).toBeCloseTo(6, 1); // 0.1 per 1/60 s
    expect(last.lipWidth.velocity).toBe(0);
    for (let i = 9; i >= 0; i--) last = m.update({ ...NEUTRAL, jawOpen: 0.1 * i }, dt);
    expect(last.jawOpen.velocity).toBeLessThan(0);
  });

  it('reports force as the push that changes velocity', () => {
    const m = new MotionTracker(0.001, 0.001);
    let s = m.update({ ...NEUTRAL }, dt);
    // Speeding up (x = t^2): positive force.
    for (let i = 1; i <= 20; i++) s = m.update({ ...NEUTRAL, lipRound: (i * dt) ** 2 }, dt);
    expect(s.lipRound.force).toBeCloseTo(2, 0);
    // Constant speed: no force.
    const v = s.lipRound.value;
    for (let i = 1; i <= 20; i++) s = m.update({ ...NEUTRAL, lipRound: v + 0.01 * i }, dt);
    expect(Math.abs(s.lipRound.force)).toBeLessThan(0.5);
  });

  it('is at rest for a still pose and ignores zero time steps', () => {
    const m = new MotionTracker();
    for (let i = 0; i < 30; i++) m.update({ jawOpen: 0.4, lipWidth: 0.2, lipRound: 0 }, dt);
    const s = m.update({ jawOpen: 0.4, lipWidth: 0.2, lipRound: 0 }, 0);
    expect(Math.abs(s.jawOpen.velocity)).toBeLessThan(1e-6);
    expect(Math.abs(s.jawOpen.force)).toBeLessThan(1e-3);
  });
});

describe('Babble Engine adapter', () => {
  it.each([
    ['zah', ['S', 'AA']], ['mee', ['M', 'IY']], ['Noo', ['N', 'UW']], ['fee', ['F', 'IY']],
    ['U', [null, 'UW']], ['o', [null, 'OW']], ['Ou', [null, 'AW']], ['ya', ['Y', 'AA']], ['H', ['HH', null]], ['!', [null, null]],
  ])('maps syllable %s to %j', (text, sounds) => {
    expect(syllableSounds(text as string)).toEqual(sounds);
  });

  it('ends syllables at silence and inserts pauses there', () => {
    // 1 s at 100 windows/s: loud 0-0.2 s, quiet 0.2-0.6 s, loud 0.6-0.9 s.
    const env = Array.from({ length: 100 }, (_, i) => ((i >= 0 && i < 20) || (i >= 60 && i < 90) ? 1 : 0));
    const segs = syllablesToSegments([{ time: 0, text: 'ba' }, { time: 0.6, text: 'oo' }], env, 0.01, 1);
    expect(segs.map((s) => s.phoneme)).toEqual(['B', 'AA', null, 'UW', null]);
    expect(segs[1].endSeconds).toBeCloseTo(0.2, 2);
    expect(segs[2].endSeconds).toBeCloseTo(0.6, 5);
  });

  it('finds the revealed character for a time', () => {
    expect(revealedIndex([0, 0.1, 0.2], 0.15)).toBe(1);
    expect(revealedIndex([0.1, 0.2], 0.05)).toBe(-1);
  });

  it.each(['sim', 'animal', 'grumble', 'droid'] as const)('style %s renders audio and drives a synced face track', (style) => {
    const u = babbleEngineUtterance('Hello there! How are you today?', { style, mood: 'happy', seed: 1 });
    const audio = u.render(48000);
    expect(Math.max(...rmsEnvelope(audio, 48000))).toBeGreaterThan(0.05);
    const track = generateFaceTrack(u.timeline);
    const jaw = track.samples.map((s) => s.jawOpen);
    expect(Math.max(...jaw)).toBeGreaterThan(0.5);
    // Mouth is closed during the gap after "there!" (silence in the audio).
    const pause = u.timeline.segments.find((s) => s.phoneme === null && s.endSeconds - s.startSeconds > 0.2);
    expect(pause).toBeDefined();
    expect(sampleFaceTrack(track, (pause!.startSeconds + pause!.endSeconds) / 2).jawOpen).toBeLessThan(0.05);
    // Jaw movement follows loudness on the shared timeline.
    expect(syncReport(audio, 48000, track).jawLoudnessCorrelation).toBeGreaterThan(0.3);
  });

  it('is deterministic for the same text, options and seed', () => {
    const a = babbleEngineUtterance('Hi there.', { style: 'sim', mood: 'neutral', seed: 3 });
    const b = babbleEngineUtterance('Hi there.', { style: 'sim', mood: 'neutral', seed: 3 });
    expect(a.timeline).toEqual(b.timeline);
    expect(a.render(48000)).toEqual(b.render(48000));
  });
});
