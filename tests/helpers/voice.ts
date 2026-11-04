// Test signals use the same WASM boundary as the playground.
import { DEFAULT_VOICE, type VoiceSettings } from '../../src/voice/performance';
import { renderPhonemes } from '../../src/voice/rustVoice';

export const renderFormant = (source: string, settings: VoiceSettings = DEFAULT_VOICE, sampleRate = 48000, brassColor = 0) =>
  renderPhonemes(source, settings, sampleRate, { engine: 'formant', brassColor });
