// Voice settings shared by the playground and the Rust/WASM voices.

export interface VoiceSettings {
  /** Base pitch in Hz (klattsch `baseF0`). */
  pitchHz: number;
  /** Milliseconds per phoneme (klattsch `rate`). Lower is faster. */
  msPerPhoneme: number;
  /** Formant scale; above 1 sounds smaller, below 1 sounds larger. */
  formantScale: number;
  /** Pitch vibrato depth. */
  vibratoDepth?: number;
  /** Breathiness, 0-1. */
  aspiration?: number;
  /** Glottal tension, 0 (lax) to 1 (tense); klattsch default 0.5. */
  effort?: number;
  /** Spectral tilt, -0.95 to 0.95; positive is brighter. */
  tilt?: number;
}

export const DEFAULT_VOICE: VoiceSettings = {
  pitchHz: 120,
  msPerPhoneme: 110,
  formantScale: 1,
};

export const DEFAULT_BRASS_COLOR = 0.75;
