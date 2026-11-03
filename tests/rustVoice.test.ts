import { beforeAll, describe, expect, it } from 'vitest';
import { rmsEnvelope } from '../src/analysis';
import { moodVoice, textToBabble } from '../src/babble/generate';
import { DEFAULT_TROMBONE } from '../src/engines/trombone';
import { generateFaceTrack, sampleFaceTrack } from '../src/puppet/generate';
import { DEFAULT_VOICE } from '../src/voice/performance';
import { formantUtterance, tromboneUtterance } from '../src/voice/rustVoice';
import init from '../src/wasm/wahwah_wasm';
import wasmUrl from '../src/wasm/wahwah_wasm_bg.wasm?inline';

const SAMPLE_RATE = 24000;
const BRASS = 0.75;

const voices = [
  ['formant voice', (phonemes: string) => formantUtterance(phonemes, DEFAULT_VOICE, BRASS)],
  ['wah-wah trombone', (phonemes: string) => tromboneUtterance(phonemes, DEFAULT_VOICE, DEFAULT_TROMBONE)],
] as const;

beforeAll(async () => {
  await init({ module_or_path: wasmUrl });
});

describe.each(voices)('%s through WASM', (_name, utterance) => {
  it('renders audible audio as long as its timeline', () => {
    const voice = utterance('HH EH L OW , M IY B AA');
    const audio = voice.render(SAMPLE_RATE);
    expect(voice.warnings).toEqual([]);
    expect(audio.length).toBe(Math.ceil(voice.timeline.durationSeconds * SAMPLE_RATE));
    expect(audio.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    expect(Math.max(...rmsEnvelope(audio, SAMPLE_RATE))).toBeGreaterThan(0.05);
  });

  it('renders the same audio twice', () => {
    const voice = utterance('S AA SH IY');
    expect(voice.render(SAMPLE_RATE)).toEqual(voice.render(SAMPLE_RATE));
  });

  it('closes the mouth more on M and pauses than on open vowels', () => {
    const { timeline } = utterance('AA M AA , AA');
    const track = generateFaceTrack(timeline);
    const jawAt = (index: number) => {
      const { startSeconds, endSeconds } = timeline.segments[index];
      return sampleFaceTrack(track, (startSeconds + endSeconds) / 2).jawOpen;
    };
    const [firstVowel, m, secondVowel, pause] = [0, 1, 2, 3].map(jawAt);
    expect(m).toBeLessThan(firstVowel);
    expect(m).toBeLessThan(secondVowel);
    expect(pause).toBeLessThan(secondVowel);
  });

  it('speaks generated babble, reporting offsets the words can find', () => {
    const script = textToBabble('Hello there, how are you?', { seed: 3 });
    const voice = utterance(script.phonemes);
    expect(voice.warnings).toEqual([]);
    const sounding = voice.timeline.segments.filter((s) => s.phoneme);
    expect(sounding.length).toBeGreaterThan(script.words.length);
    for (const segment of sounding) {
      expect(segment.srcEnd).toBeLessThanOrEqual(script.phonemes.length);
      expect(script.phonemes.slice(segment.srcStart, segment.srcEnd)).toContain(segment.phoneme);
    }
  });
});

describe('voice settings through WASM', () => {
  it('applies mood settings without warnings', () => {
    const settings = moodVoice(DEFAULT_VOICE, textToBabble('Oh no!', { seed: 1 }).mood);
    expect(formantUtterance('AA', settings, 0).warnings).toEqual([]);
  });

  it('reports script problems as warnings', () => {
    expect(formantUtterance('QQ', DEFAULT_VOICE, 0).warnings).toEqual(['unknown phoneme: QQ']);
  });
});
