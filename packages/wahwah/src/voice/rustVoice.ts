// One WASM render compiles one score and returns audio, timing and mouth movement.
import init, { renderPerformance, renderInstrument as instrument, type InitInput } from '../wasm/wahwah_wasm.js';
import { mumbleOptions, type MumbleOptions, type MumbleScript } from '../mumble/generate.js';
import type { TromboneOptions } from './trombone.js';
import type { VoiceSettings } from './settings.js';
import type { RenderedUtterance } from '../performance/index.js';
import { INSTRUMENTS, type InstrumentNote, type InstrumentOptions } from './instruments.js';

export interface InstrumentPerformance extends RenderedUtterance {
  notes: InstrumentNote[];
}

export function renderInstrument(text: string, options: InstrumentOptions, sampleRate: number, puppet = true): InstrumentPerformance {
  const result = instrument(text, { ...options, seed: options.seed >>> 0 }, sampleRate, puppet) as InstrumentPerformance;
  return { ...result, engine: INSTRUMENTS.find(p => p.id === options.instrument)!.name };
}

let loading: Promise<unknown> | undefined;
/**
 * Loads the WASM voices once. A browser bundle needs no argument. In Node, or
 * anywhere the binary is not fetched by URL, pass its bytes or a compiled module.
 */
export function loadVoices(source?: InitInput | Promise<InitInput>): Promise<unknown> {
  loading ??= init(source === undefined ? undefined : { module_or_path: source });
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
