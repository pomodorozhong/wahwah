// Babble Engine as a second sound source. It does its own text-to-babble and
// synthesis; this adapter turns its output into the same Timeline the puppet
// instruction generator already reads, so the face works unchanged.
//
// Babble Engine reports only syllable start times and the invented syllable
// text, so mouth shapes come from the syllable's letters and syllable ends come
// from the rendered audio's loudness.

import { render, styles, type Mood, type RenderOptions, type StyleId, type Syllable } from 'babble-engine';
import { rmsEnvelope } from '../analysis';
import type { PerformanceSegment, Timeline, Utterance } from '../voice/performance';

export interface BabbleEngineOptions {
  style: StyleId;
  voice?: string;
  mood: Mood;
  seed: number;
}

export const BE_STYLES = styles();

const VOWELS: [RegExp, string][] = [
  [/^(ou|ow|au|aw)/, 'AW'],
  [/^(ai|ay|ei|ey)/, 'EY'],
  [/^(oi|oy)/, 'OY'],
  [/^(ee|ea|ie|i|y)/, 'IY'],
  [/^(oo|ue|u)/, 'UW'],
  [/^(oh|oa|o)/, 'OW'],
  [/^(eh|e)/, 'EH'],
  [/^(ah|aa|a)/, 'AA'],
];

const CONSONANTS: [RegExp, string][] = [
  [/^sh/, 'SH'], [/^ch/, 'CH'], [/^th/, 'TH'], [/^ng/, 'NG'],
  [/^m/, 'M'], [/^b/, 'B'], [/^p/, 'P'], [/^f/, 'F'], [/^v/, 'V'], [/^w/, 'W'],
  [/^j/, 'JH'], [/^[sz]/, 'S'], [/^t/, 'T'], [/^d/, 'D'], [/^n/, 'N'], [/^l/, 'L'],
  [/^[kcqx]/, 'K'], [/^g/, 'G'], [/^r/, 'R'], [/^h/, 'HH'],
];

const firstMatch = (table: [RegExp, string][], s: string) => table.find(([re]) => re.test(s))?.[1] ?? null;

/**
 * Approximate ARPABET codes for an invented syllable such as "zah", "Noo" or a
 * single letter: [onset consonant or null, vowel or null].
 */
export function syllableSounds(text: string): [string | null, string | null] {
  const t = text.toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return [null, null];
  const vowelAt = t.search(/[aeiouy]/);
  if (vowelAt === -1) return [firstMatch(CONSONANTS, t) ?? 'N', null];
  const onset = vowelAt > 0 ? firstMatch(CONSONANTS, t.slice(0, vowelAt)) ?? 'N' : null;
  // A lone "y" before nothing else is a vowel ("y" -> IY); "ya" has onset Y.
  const nucleus = t.slice(vowelAt);
  if (vowelAt === 0 && nucleus.startsWith('y') && nucleus.length > 1) return ['Y', firstMatch(VOWELS, nucleus.slice(1))];
  return [onset, firstMatch(VOWELS, nucleus)];
}

/**
 * Build timeline segments from syllable start times and the loudness envelope.
 * A syllable ends at the next syllable or when the audio goes quiet, whichever
 * is first; quiet gaps become pauses so the mouth can close.
 */
export function syllablesToSegments(
  syllables: Syllable[],
  envelope: number[],
  windowSeconds: number,
  durationSeconds: number,
): PerformanceSegment[] {
  const peak = Math.max(1e-6, ...envelope);
  const quiet = (t: number) => (envelope[Math.floor(t / windowSeconds)] ?? 0) < peak * 0.06;
  const segments: PerformanceSegment[] = [];
  const pause = (start: number, end: number, i: number) => {
    if (end - start > 0.02) segments.push({ phoneme: null, startSeconds: start, endSeconds: end, srcStart: i, srcEnd: i });
  };
  if (syllables.length && syllables[0].time > 0) pause(0, syllables[0].time, 0);
  syllables.forEach((syl, i) => {
    const start = syl.time;
    const limit = i + 1 < syllables.length ? syllables[i + 1].time : durationSeconds;
    // End at the first 30 ms of quiet after a short minimum.
    let end = limit;
    for (let t = start + 0.06; t + 0.03 <= limit; t += windowSeconds) {
      if (quiet(t) && quiet(t + windowSeconds) && quiet(t + 2 * windowSeconds)) {
        end = t;
        break;
      }
    }
    const [onset, vowel] = syllableSounds(syl.text);
    const len = end - start;
    if (onset && vowel) {
      const split = start + Math.min(0.06, len * 0.35);
      segments.push({ phoneme: onset, startSeconds: start, endSeconds: split, srcStart: i, srcEnd: i + 1 });
      segments.push({ phoneme: vowel, startSeconds: split, endSeconds: end, srcStart: i, srcEnd: i + 1 });
    } else {
      segments.push({ phoneme: vowel ?? onset, startSeconds: start, endSeconds: end, srcStart: i, srcEnd: i + 1 });
    }
    pause(end, limit, i + 1);
  });
  return segments;
}

export interface BabbleEngineUtterance extends Utterance {
  /** Seconds at which each character of the input text is reached. */
  reveal: number[];
  syllables: Syllable[];
}

export function babbleEngineUtterance(text: string, opts: BabbleEngineOptions, sampleRate = 48000): BabbleEngineUtterance {
  const options: RenderOptions = { style: opts.style, voice: opts.voice, mood: opts.mood, seed: opts.seed, sampleRate };
  const result = render(text, options);
  const windowSeconds = 0.01;
  const envelope = rmsEnvelope(result.pcm, result.sampleRate, windowSeconds);
  const timeline: Timeline = {
    durationSeconds: result.duration,
    segments: syllablesToSegments(result.syllables, envelope, windowSeconds, result.duration),
  };
  return {
    engine: `Babble Engine (${result.style}/${result.voice})`,
    timeline,
    warnings: [],
    reveal: result.reveal,
    syllables: result.syllables,
    render: (sr) => (sr === result.sampleRate ? result.pcm : render(text, { ...options, sampleRate: sr }).pcm),
  };
}

/** Index of the last character revealed at `timeSeconds`, or -1. */
export function revealedIndex(reveal: number[], timeSeconds: number): number {
  let idx = -1;
  for (let i = 0; i < reveal.length; i++) if (reveal[i] <= timeSeconds) idx = i;
  return idx;
}
