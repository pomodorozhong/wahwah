import { describe, expect, it } from 'vitest';
import { rmsEnvelope } from '../src/analysis';
import { NEUTRAL, sampleFaceTrack } from '@wahwah/performance';
import { INSTRUMENTS, type InstrumentOptions } from '../src/voice/instruments';
import { renderInstrument } from '../src/voice/rustVoice';

const SR = 24000;

describe.each(INSTRUMENTS)('$name through WASM', preset => {
  const options: InstrumentOptions = { ...preset, instrument: preset.id, seed: 7, moodId: 'neutral' };

  it.each([8000, 24000, 44100, 48000])('renders typed audio and a synchronized track at %i Hz', sampleRate => {
    const p = renderInstrument('Hello there!', options, sampleRate);
    expect(p.engine).toBe(preset.name);
    expect(p.audio).toBeInstanceOf(Float32Array);
    expect(p.audio.length).toBe(Math.ceil(p.timeline.durationSeconds * sampleRate));
    expect(p.audio.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    expect(Math.max(...rmsEnvelope(p.audio, sampleRate))).toBeGreaterThan(0.05);
    expect(p.track!.durationSeconds).toBe(p.timeline.durationSeconds);
    expect(p.track!.samples.at(-1)!.timeSeconds).toBe(p.timeline.durationSeconds);
    expect(sampleFaceTrack(p.track!, p.timeline.durationSeconds)).toEqual(NEUTRAL);
    expect(p.warnings).toEqual([]);
    const segments = p.timeline.segments.filter(s => s.phoneme);
    expect(segments).toHaveLength(p.notes.length);
    expect(segments.map(s => s.startSeconds)).toEqual(p.notes.map(n => n.startSeconds));
  });

  it('repeats its complete performance and responds to seed changes', () => {
    const a = renderInstrument('Hello there?', options, SR);
    expect(a).toEqual(renderInstrument('Hello there?', options, SR));
    expect(a.notes).not.toEqual(renderInstrument('Hello there?', { ...options, seed: 8 }, SR).notes);
  });

  it('moves the mouth for every note in a multi-note word', () => {
    const p = renderInstrument('information', options, SR);
    expect(p.notes).toHaveLength(4);
    for (const note of p.notes) {
      const onset = sampleFaceTrack(p.track!, note.startSeconds - 0.015);
      const middle = sampleFaceTrack(p.track!, note.startSeconds + note.durationSeconds * 0.5 - 0.02);
      expect(middle.jawOpen + middle.lipWidth + middle.lipRound).toBeGreaterThan(onset.jawOpen + onset.lipWidth + onset.lipRound + 0.1);
    }
  });

  it('skips the mouth track without changing audio', () => {
    const p = renderInstrument('Hi!', options, SR);
    const off = renderInstrument('Hi!', options, SR, false);
    expect(off.track).toBeNull(); expect(off.audio).toEqual(p.audio); expect(off.notes).toEqual(p.notes);
  });

  it('maps original text ranges to JavaScript string positions', () => {
    const text = '🧊 It’s fine — hello!';
    const p = renderInstrument(text, options, SR);
    expect(p.notes[0].srcStart).toBe(3);
    for (const note of p.notes) expect(['It’s', 'fine', 'hello']).toContain(text.slice(note.srcStart, note.srcEnd));
    for (const segment of p.timeline.segments.filter(s => s.phoneme)) expect(['It’s', 'fine', 'hello']).toContain(text.slice(segment.srcStart, segment.srcEnd));
  });

  it('responds to mood, pitch and speed', () => {
    const p = renderInstrument('Hi there.', options, SR);
    const higher = renderInstrument('Hi there.', { ...options, pitchHz: preset.pitchHz * 1.5 }, SR);
    expect(higher.notes[0].startHz / p.notes[0].startHz).toBeCloseTo(1.5, 6);
    const happy = renderInstrument('Hi there.', { ...options, moodId: 'happy' }, SR);
    const sad = renderInstrument('Hi there.', { ...options, moodId: 'sad' }, SR);
    expect(happy.timeline.durationSeconds).toBeLessThan(sad.timeline.durationSeconds);
    expect(renderInstrument('Hi there.', { ...options, speed: preset.speed * 1.5 }, SR).timeline.durationSeconds).toBeLessThan(p.timeline.durationSeconds);
  });

  it('returns short neutral silence for punctuation-only input', () => {
    const p = renderInstrument('?!...', options, SR);
    expect(p.notes).toEqual([]);
    expect(p.audio.every(v => v === 0)).toBe(true);
    expect(p.track!.samples.every(s => s.jawOpen === 0 && s.lipWidth === 0 && s.lipRound === 0)).toBe(true);
  });

  it('rejects invalid settings before allocating audio', () => {
    expect(() => renderInstrument('Hi', { ...options, pitchHz: NaN }, SR)).toThrow(/finite/);
    expect(() => renderInstrument('Hi', { ...options, speed: 0 }, SR)).toThrow(/speed/);
    expect(() => renderInstrument('Hi', options, 0)).toThrow(/Sample rate/);
  });
});
