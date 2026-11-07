export interface TromboneOptions {
  /** 0 dark and muffled .. 1 bright and brassy. */
  brightness: number;
  /** How far the plunger opens on open vowels, 0..1. */
  wah: number;
  /** Pitch shift in semitones applied to the speech contour. */
  transpose: number;
}

export const DEFAULT_TROMBONE: TromboneOptions = { brightness: 0.45, wah: 0.85, transpose: -5 };
