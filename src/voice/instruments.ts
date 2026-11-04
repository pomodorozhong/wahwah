// The UI and Rust read the same Talking Instruments defaults.
import presets from '../../data/instrument-presets.json';

export type InstrumentId = 'muted-horn' | 'talking-trombone' | 'ooh-choir' | 'kazoo';
export interface InstrumentPreset {
  id: InstrumentId;
  name: string;
  pitchHz: number;
  speed: number;
  expression: number;
  brightness: number;
}
export const INSTRUMENTS = presets as readonly InstrumentPreset[];
export const isInstrument = (id: string): id is InstrumentId => INSTRUMENTS.some(p => p.id === id);
export interface InstrumentOptions {
  instrument: InstrumentId;
  pitchHz: number;
  speed: number;
  expression: number;
  brightness: number;
  seed: number;
  moodId: string;
}
export interface InstrumentNote {
  startSeconds: number;
  durationSeconds: number;
  startHz: number;
  endHz: number;
  amplitude: number;
  /** UTF-16 positions in the original text. */
  srcStart: number;
  srcEnd: number;
}
