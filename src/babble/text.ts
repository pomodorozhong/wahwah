// English text analysis for babble: words, punctuation, syllable counts and
// lexical stress. Heuristic on purpose: babble only needs the rhythm of the
// text, not its pronunciation, so no dictionary is bundled.

export type TextToken =
  | { kind: 'word'; text: string; start: number; end: number }
  | { kind: 'break'; strength: 'short' | 'long'; tone: 'statement' | 'question' | 'exclaim' | 'none'; start: number; end: number };

// Ellipses and dashes before single characters so they match first.
const TOKEN_RE = /(\.\.\.|…|—|–|--)|([A-Za-z0-9]+(?:['’][A-Za-z]+)*)|([.!?]+|[,;:]|\n+)/g;

export function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (m[2]) {
      tokens.push({ kind: 'word', text: m[2], start, end });
    } else if (m[1]) {
      tokens.push({ kind: 'break', strength: 'long', tone: 'none', start, end });
    } else if (m[3]) {
      const p = m[3];
      if (p.startsWith('\n')) tokens.push({ kind: 'break', strength: 'long', tone: 'statement', start, end });
      else if (p.includes('?')) tokens.push({ kind: 'break', strength: 'long', tone: 'question', start, end });
      else if (p.includes('!')) tokens.push({ kind: 'break', strength: 'long', tone: 'exclaim', start, end });
      else if (p.startsWith('.')) tokens.push({ kind: 'break', strength: 'long', tone: 'statement', start, end });
      else tokens.push({ kind: 'break', strength: 'short', tone: 'none', start, end });
    }
  }
  return tokens;
}

/** Approximate English syllable count (always >= 1). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) {
    // Numbers and symbols: roughly one syllable per two characters.
    return Math.max(1, Math.ceil(word.replace(/[^0-9]/g, '').length / 2));
  }
  if (w.length <= 3) return 1;
  let groups = w.match(/[aeiouy]+/g)?.length ?? 1;
  // Silent final -e ("make"), but not consonant + "le" ("table").
  if (/[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w)) groups--;
  // Silent -ed ("jumped") except after t/d ("wanted").
  if (/[^aeiouytd]ed$/.test(w)) groups--;
  // Silent -es ("makes") except after sibilants ("boxes").
  if (/[^aeiouysxzh]es$/.test(w) && !/(ch|sh)es$/.test(w)) groups--;
  return Math.max(1, groups);
}

const FUNCTION_WORDS = new Set(
  'a an the and or but so if of to in on at by for with from as is am are was were be been it its i me my you your he him his she her we us our they them their this that these those not no do does did has have had will would can could should shall may might must there here than then just'.split(
    ' ',
  ),
);

/**
 * Index of the stressed syllable, or -1 for unstressed function words.
 * Rules of thumb: most English words stress the first syllable; common
 * suffixes pull stress later.
 */
export function stressIndex(word: string, syllables: number): number {
  const w = word.toLowerCase();
  if (FUNCTION_WORDS.has(w.replace(/['’].*$/, ''))) return -1;
  if (syllables <= 2) return 0;
  if (/(tion|sion|cian|ic|ics|ial|ian|ious)$/.test(w)) return syllables - 2;
  if (/(ity|ical|ify|ogy|aphy)$/.test(w)) return Math.max(0, syllables - 3);
  if (/(ee|eer|ese|ette|oon)$/.test(w)) return syllables - 1;
  return 0;
}
