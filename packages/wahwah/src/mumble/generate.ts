// Mumble generation belongs to Rust. Call after loadVoices().
import { generateMumble as generate } from '../wasm/wahwah_wasm.js';
import type { MumbleStyle, Mood } from './styles.js';

export interface MumbleOptions {
  seed: number;
  styleId?: string;
  moodId?: string;
}

export interface MumbleWord {
  text: string;
  /** UTF-16 positions in the input text, as used by JavaScript strings. */
  srcStart: number;
  srcEnd: number;
  outStart: number;
  outEnd: number;
  spelled: string;
}

export interface MumbleScript {
  phonemes: string;
  words: MumbleWord[];
  style: MumbleStyle;
  mood: Mood;
}

/** JS numeric seeds become a deterministic unsigned 32-bit seed. */
export const mumbleOptions = (options: MumbleOptions): MumbleOptions => ({ ...options, seed: options.seed >>> 0 });

/** Call after loadVoices(); generation itself is synchronous. */
export function generateMumble(text: string, options: MumbleOptions): MumbleScript {
  return generate(text, mumbleOptions(options)) as MumbleScript;
}

export const wordAtPhonemeOffset = (script: MumbleScript, offset: number): MumbleWord | null =>
  script.words.find(w => offset >= w.outStart && offset < w.outEnd) ?? null;
