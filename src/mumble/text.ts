// English text analysis in Rust, with UTF-16 offsets at the WASM boundary.
import { countSyllables, stressIndex, tokenizeText as tokenize } from '../wasm/wahwah_wasm';
export { countSyllables, stressIndex };

type Tone = 'statement' | 'question' | 'exclaim' | 'none';
type RawToken =
  | { kind: 'word'; text: string; start: number; end: number }
  | { kind: 'break'; mark: ',' | ';' | '.'; tone: Tone };
export type TextToken =
  | Extract<RawToken, { kind: 'word' }>
  | (Extract<RawToken, { kind: 'break' }> & { strength: 'short' | 'long' });

export function tokenizeText(text: string): TextToken[] {
  return (tokenize(text) as RawToken[]).map(t => t.kind === 'word' ? t : { ...t, strength: t.mark === ',' ? 'short' : 'long' });
}
