// Mumble generation belongs to Rust. This adapter also serves the legacy live
// demo, whose JavaScript synthesizer is removed in the dependency-cleanup step.
import { generateMumble as generate } from '../wasm/wahwah_wasm';
import type { VoiceSettings } from '../voice/performance';
import { STYLES, MOODS, type MumbleStyle, type Mood } from './styles';

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

export const findStyle = (id?: string): MumbleStyle => STYLES.find(s => s.id === id) ?? STYLES[0];
export const findMood = (id?: string): Mood => MOODS.find(m => m.id === id) ?? MOODS[0];

/** Legacy JS synthesis only. Rust applies the mood itself when rendering. */
export function moodVoice(base: VoiceSettings, mood: Mood): VoiceSettings {
  return { ...base, pitchHz: base.pitchHz * mood.pitchScale, msPerPhoneme: base.msPerPhoneme * mood.rateScale,
    vibratoDepth: mood.vibratoDepth, aspiration: mood.aspiration, effort: mood.effort, tilt: mood.tilt };
}

export const wordAtPhonemeOffset = (script: MumbleScript, offset: number): MumbleWord | null =>
  script.words.find(w => offset >= w.outStart && offset < w.outEnd) ?? null;
