// One WASM render compiles one score and returns audio, timing and mouth movement.
import init, { renderPerformance } from '../wasm/wahwah_wasm';
import { mumbleOptions, type MumbleOptions, type MumbleScript } from '../mumble/generate';
import type { TromboneOptions } from '../engines/trombone';
import type { RenderedUtterance, VoiceSettings } from './performance';

let loading: Promise<unknown> | undefined;
export function loadVoices(): Promise<unknown> {
  loading ??= init();
  return loading;
}

export type RustVoice =
  | { engine: 'formant'; brassColor: number }
  | { engine: 'trombone'; trombone: TromboneOptions };

export interface MumblePerformance extends RenderedUtterance {
  script: MumbleScript;
}

function render(source: string, settings: VoiceSettings, sampleRate: number, voice: RustVoice, puppet: boolean,
  input: 'mumble' | 'phonemes', mumble?: MumbleOptions): RenderedUtterance {
  const result = renderPerformance(source, settings, sampleRate, { ...voice, input, ...(mumble ? { mumble } : {}), puppet }) as RenderedUtterance;
  return { ...result, engine: voice.engine === 'formant' ? 'klattsch' : 'Wah-wah trombone' };
}

export function renderPhonemes(source: string, settings: VoiceSettings, sampleRate: number, voice: RustVoice, puppet = true): RenderedUtterance {
  return render(source, settings, sampleRate, voice, puppet, 'phonemes');
}

export function renderMumble(text: string, options: MumbleOptions, settings: VoiceSettings, sampleRate: number,
  voice: RustVoice, puppet = true): MumblePerformance {
  return render(text, settings, sampleRate, voice, puppet, 'mumble', mumbleOptions(options)) as MumblePerformance;
}
