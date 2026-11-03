// Voice adapter: the Rust voices behind the playground's Utterance interface.
// Rust holds no state between calls, so each utterance keeps its script and
// settings and passes them again to render at the device sample rate.

import init, { compile, renderFormant, renderTrombone } from '../wasm/wahwah_wasm';
import type { TromboneOptions } from '../engines/trombone';
import type { Timeline, Utterance, VoiceSettings } from './performance';

interface CompiledTimeline extends Timeline {
  warnings: string[];
}

let loading: Promise<unknown> | undefined;

/** Load the WASM module. Call once before creating voices. */
export function loadVoices(): Promise<unknown> {
  loading ??= init();
  return loading;
}

const compileTimeline = (phonemes: string, settings: VoiceSettings) => compile(phonemes, settings) as CompiledTimeline;

/** The klattsch formant voice with an amount of Trombone color from 0 to 1. */
export function formantUtterance(phonemes: string, settings: VoiceSettings, brassColor: number): Utterance {
  const timeline = compileTimeline(phonemes, settings);
  return {
    engine: 'klattsch',
    timeline,
    warnings: timeline.warnings,
    render: (sampleRate) => renderFormant(phonemes, settings, sampleRate, brassColor),
  };
}

export function tromboneUtterance(phonemes: string, settings: VoiceSettings, options: TromboneOptions): Utterance {
  const timeline = compileTimeline(phonemes, settings);
  return {
    engine: 'Wah-wah trombone',
    timeline,
    warnings: timeline.warnings,
    render: (sampleRate) => renderTrombone(phonemes, settings, sampleRate, options),
  };
}
