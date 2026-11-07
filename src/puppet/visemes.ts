import poses from '../../data/mouth-poses.json';
import type { FaceControls } from '@wahwah/performance';

export interface Viseme {
  pose: FaceControls;
  glideTo?: FaceControls;
  /** Vowels and closures hold their shape; weak sounds borrow their neighbours. */
  dominance: number;
}

// The same embedded data supplies Rust's track generator and trombone plunger.
// This import is synchronous and safe on the live audio thread without WASM.
export const VISEMES: Record<string, Viseme> = poses.visemes;
export const UNKNOWN_VISEME: Viseme = poses.unknown;
