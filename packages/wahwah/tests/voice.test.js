import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, VOICE_MAPPING_V1, deriveVoice, loadVoices, renderMumble, sampleFaceTrack, NEUTRAL } from '../src/index';

const SAMPLE_RATE = 24000;

beforeAll(async () => {
  await loadVoices(readFileSync(new URL('../src/wasm/wahwah_wasm_bg.wasm', import.meta.url)));
});

describe('renderMumble', () => {
  it('renders audio, a timeline and a face track', () => {
    const utterance = renderMumble('Hello there!', { seed: 3 }, DEFAULT_VOICE, SAMPLE_RATE, { engine: 'formant', brassColor: 0.75 });
    expect(utterance.audio.length).toBeGreaterThan(SAMPLE_RATE / 4);
    expect(utterance.audio.some((v) => Math.abs(v) > 0.01)).toBe(true);
    expect(utterance.timeline.segments.length).toBeGreaterThan(0);
    expect(utterance.track).not.toBeNull();
  });

  it('is repeatable for the same seed and neutral outside the track', () => {
    const render = () => renderMumble('Hello there!', { seed: 3 }, DEFAULT_VOICE, SAMPLE_RATE, { engine: 'formant', brassColor: 0.75 });
    const a = render();
    expect(render().timeline).toEqual(a.timeline);
    expect(sampleFaceTrack(a.track, a.track.durationSeconds + 1)).toEqual(NEUTRAL);
  });
});

describe('deriveVoice', () => {
  const hex = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');

  it('matches the frozen mapping 1 values, from bytes or hex', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i);
    const voice = deriveVoice(bytes, VOICE_MAPPING_V1);
    expect(voice).toEqual(deriveVoice(hex, 1));
    expect(voice).toEqual(deriveVoice(hex.toUpperCase(), 1));
    expect(voice.settings).toEqual({ pitchHz: 155, msPerPhoneme: 128, formantScale: 1.13 });
    expect(voice.styleId).toBe('grumbly');
    expect(voice.seed).toBe(763329912);
  });

  it('feeds the render call', () => {
    const v = deriveVoice(hex, 1);
    const utterance = renderMumble('Hello there!', { seed: v.seed, styleId: v.styleId }, v.settings, SAMPLE_RATE, { engine: 'formant', brassColor: v.brassColor });
    expect(utterance.audio.length).toBeGreaterThan(0);
  });

  it('rejects a short hash, bad hex and an unknown mapping', () => {
    expect(() => deriveVoice(new Uint8Array(15), 1)).toThrow(/at least 16/);
    expect(() => deriveVoice('zz'.repeat(16), 1)).toThrow(/hex/);
    expect(() => deriveVoice(hex, 2)).toThrow(/mapping/i);
  });
});
