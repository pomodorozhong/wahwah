// Repeatable character voices from a caller-provided hash. Call after loadVoices().
import { deriveVoice as deriveBytes, deriveVoiceHex as deriveHex } from '../wasm/wahwah_wasm.js';
import type { VoiceSettings } from './settings.js';
import type { TromboneOptions } from './trombone.js';

/** The only mapping so far. A released mapping never changes; a new one gets a new number. */
export const VOICE_MAPPING_V1 = 1;

export interface CharacterVoice {
  mapping: number;
  /** Pass as the voice settings of `renderMumble`. */
  settings: VoiceSettings;
  /** Pass as `styleId` of the Mumble options. */
  styleId: string;
  /** Pass as `seed` of the Mumble options. */
  seed: number;
  /** Pass as `brassColor` of the formant voice. */
  brassColor: number;
  /** Pass as `trombone` of the trombone voice. */
  trombone: TromboneOptions;
}

/**
 * Derives a voice from a hash of at least 16 bytes, given as bytes or as hex
 * digits (either case, no prefix). The caller hashes its own identifier with its
 * own salt, and always names the mapping version. Throws on a short hash, bad hex
 * or an unknown mapping.
 */
export function deriveVoice(hash: Uint8Array | string, mapping: number): CharacterVoice {
  return (typeof hash === 'string' ? deriveHex(hash, mapping) : deriveBytes(hash, mapping)) as CharacterVoice;
}
