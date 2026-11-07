// The wahwah voice engine and the performance contract it produces.
export * from './performance/index.js';
export { DEFAULT_BRASS_COLOR, DEFAULT_VOICE, type VoiceSettings } from './voice/settings.js';
export {
  loadVoices,
  renderInstrument,
  renderMumble,
  renderPhonemes,
  type InstrumentPerformance,
  type MumblePerformance,
  type RustVoice,
} from './voice/rustVoice.js';
export {
  INSTRUMENTS,
  isInstrument,
  type InstrumentId,
  type InstrumentNote,
  type InstrumentOptions,
  type InstrumentPreset,
} from './voice/instruments.js';
export { DEFAULT_TROMBONE, type TromboneOptions } from './voice/trombone.js';
export { MOODS, STYLES, type Mood, type MumbleStyle } from './mumble/styles.js';
export type { MumbleOptions, MumbleScript, MumbleWord } from './mumble/generate.js';
