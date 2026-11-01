import { describe, expect, it } from 'vitest';
import { countSyllables, stressIndex, tokenizeText } from '../src/babble/text';
import { moodVoice, textToBabble, wordAtPhonemeOffset, findMood } from '../src/babble/generate';
import { MOODS, STYLES } from '../src/babble/styles';
import { DEFAULT_VOICE, compilePerformance, renderPerformance } from '../src/voice/performance';
import { generateFaceTrack } from '../src/puppet/generate';
import { rmsEnvelope } from '../src/analysis';

const vowelCount = (phonemes: string) =>
  phonemes.split(' ').filter((t) => /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)\b/.test(t)).length;

describe('English text analysis', () => {
  it.each([
    ['cat', 1], ['make', 1], ['jumped', 1], ['table', 2], ['wanted', 2], ['boxes', 2],
    ['banana', 3], ['beautiful', 3], ['information', 4], ['I', 1], ['42', 1], ['2026', 2],
  ])('%s has %i syllable(s)', (word, n) => {
    expect(countSyllables(word as string)).toBe(n);
  });

  it('stresses content words and leaves function words unstressed', () => {
    expect(stressIndex('the', 1)).toBe(-1);
    expect(stressIndex('banana', 3)).toBe(0);
    expect(stressIndex('information', 4)).toBe(2);
    expect(stressIndex('cat', 1)).toBe(0);
  });

  it('splits words and classifies punctuation', () => {
    const toks = tokenizeText("Wait, what?! It's fine... really.");
    expect(toks.map((t) => (t.kind === 'word' ? t.text : `[${t.strength}/${t.tone}]`))).toEqual([
      'Wait', '[short/none]', 'what', '[long/question]', "It's", 'fine', '[long/none]', 'really', '[long/statement]',
    ]);
  });
});

describe('text-to-babble', () => {
  const text = 'Hello there! How are you today? I made a banana cake, obviously.';

  it('is deterministic for the same text, style, mood and seed', () => {
    expect(textToBabble(text, { seed: 7 })).toEqual(textToBabble(text, { seed: 7 }));
  });

  it('changes when the seed changes', () => {
    expect(textToBabble(text, { seed: 7 }).phonemes).not.toBe(textToBabble(text, { seed: 8 }).phonemes);
  });

  it('gives the same word the same sounds wherever it appears', () => {
    const s = textToBabble('Banana, I said banana!', { seed: 3 });
    const sounds = (w: string) => w.replace(/['(+\-0-9)]/g, '').toUpperCase();
    expect(sounds(s.words[0].spelled)).toBe(sounds(s.words[3].spelled));
  });

  it('keeps the rhythm: one invented syllable per English syllable', () => {
    const s = textToBabble('banana information cat', { seed: 1 });
    expect(vowelCount(s.phonemes)).toBe(3 + 4 + 1);
  });

  it('turns punctuation into pauses and collapses runs of it', () => {
    const s = textToBabble('Wait, what?! Fine.', { seed: 1 });
    const marks = s.phonemes.split(' ').filter((t) => /^[,;.]$/.test(t));
    expect(marks).toEqual([',', '.', '.']);
    expect(s.phonemes.startsWith('.') || s.phonemes.startsWith(',')).toBe(false);
  });

  it('rises at the end of a question and falls at the end of a statement', () => {
    const mood = findMood('neutral');
    const q = textToBabble('Are you there?', { seed: 1, moodId: 'neutral' });
    const st = textToBabble('You are there.', { seed: 1, moodId: 'neutral' });
    const lastGlide = (p: string) => Number(p.match(/\(([+-]\d+)\)(?!.*\()/)?.[1] ?? 0);
    expect(lastGlide(q.phonemes)).toBe(mood.questionRise);
    expect(lastGlide(st.phonemes)).toBe(mood.statementFall);
  });

  it('maps every phoneme back to the English word that produced it', () => {
    const s = textToBabble(text, { seed: 2 });
    const perf = compilePerformance(s.phonemes, DEFAULT_VOICE);
    for (const seg of perf.segments.filter((x) => x.phoneme)) {
      const w = wordAtPhonemeOffset(s, seg.srcStart);
      expect(w).not.toBeNull();
      expect(text.slice(w!.srcStart, w!.srcEnd)).toBe(w!.text);
    }
  });

  it.each(STYLES.flatMap((st) => MOODS.map((m) => [st.id, m.id] as const)))(
    'style %s / mood %s compiles without klattsch warnings',
    (styleId, moodId) => {
      const s = textToBabble(text, { seed: 11, styleId, moodId });
      expect(compilePerformance(s.phonemes, moodVoice(DEFAULT_VOICE, s.mood)).warnings).toEqual([]);
    },
  );

  it('handles empty and punctuation-only text', () => {
    expect(textToBabble('', { seed: 1 }).phonemes).toBe('');
    expect(textToBabble('?!...', { seed: 1 }).phonemes).toBe('');
  });

  it('moods change pitch and speed', () => {
    const happy = moodVoice(DEFAULT_VOICE, findMood('happy'));
    const sad = moodVoice(DEFAULT_VOICE, findMood('sad'));
    expect(happy.pitchHz).toBeGreaterThan(sad.pitchHz);
    expect(happy.msPerPhoneme).toBeLessThan(sad.msPerPhoneme);
    const durHappy = compilePerformance(textToBabble(text, { seed: 1, moodId: 'happy' }).phonemes, happy).durationSeconds;
    const durSad = compilePerformance(textToBabble(text, { seed: 1, moodId: 'sad' }).phonemes, sad).durationSeconds;
    expect(durHappy).toBeLessThan(durSad);
  });

  it('renders audible babble with a moving face track', () => {
    const s = textToBabble(text, { seed: 5 });
    const perf = compilePerformance(s.phonemes, moodVoice(DEFAULT_VOICE, s.mood));
    const env = rmsEnvelope(renderPerformance(perf, 48000), 48000);
    expect(Math.max(...env)).toBeGreaterThan(0.1);
    const jaw = generateFaceTrack(perf).samples.map((x) => x.jawOpen);
    expect(Math.max(...jaw) - Math.min(...jaw)).toBeGreaterThan(0.5);
  });
});
