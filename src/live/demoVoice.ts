// Synthetic live inputs render audio through WASM, then enter the same
// TypeScript analyzer as the microphone. Call after loadVoices().
import { DEFAULT_VOICE, renderMumble, renderPhonemes } from 'wahwah';
import type { ProfileClassId } from './profile';

// Deliberately unlike the formant analyzer's adult-male reference.
export const DEMO_VOICE = { ...DEFAULT_VOICE, formantScale: 1.25, pitchHz: 230 };
const FORMANT = { engine: 'formant', brassColor: 0 } as const;

/** React to the prompt after 0.7 s, then hold the sound for about 2.6 s. */
export function demoStepAudio(id: ProfileClassId, sampleRate: number): Float32Array | null {
  if (id === 'silence') return null;
  return renderPhonemes(`p700 ${id}`, { ...DEMO_VOICE, msPerPhoneme: 2600 }, sampleRate, FORMANT, false).audio;
}

export function liveSpeechAudio(source: 'test' | 'demo', sampleRate: number): Float32Array {
  const demo = source === 'demo';
  return renderMumble(
    demo ? 'Hi! I am the demo voice. Watch my mouth: ah, ee, ooh. So soft, so sweet!'
      : 'Hello there! Testing, one two three. Can you see my mouth move? Oh, wonderful.',
    { seed: demo ? 5 : 9 }, demo ? DEMO_VOICE : DEFAULT_VOICE, sampleRate, FORMANT, false,
  ).audio;
}
