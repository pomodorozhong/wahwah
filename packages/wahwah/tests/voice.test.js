import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, loadVoices, renderMumble, sampleFaceTrack, NEUTRAL } from '../src/index';

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
