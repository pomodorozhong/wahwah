// Shared settings and the rendered Rust/WASM performance contract.
import type { FaceControlTrack } from '../puppet/controls';

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

/** One audible sound or pause on the utterance timeline. */
export interface PerformanceSegment {
  /** ARPABET code, or null for a pause. */
  phoneme: string | null;
  startSeconds: number;
  endSeconds: number;
  /** Character range in the source text, for highlighting. */
  srcStart: number;
  srcEnd: number;
}

/**
 * The engine-independent part of a performance: sounds on a timeline. This is
 * all the puppet instruction generator needs.
 */
export interface Timeline {
  durationSeconds: number;
  segments: PerformanceSegment[];
}

/** A complete Rust performance, rendered once at the playback sample rate. */
export interface RenderedUtterance {
  engine: string;
  timeline: Timeline;
  warnings: string[];
  audio: Float32Array;
  track: FaceControlTrack | null;
}

export const DEFAULT_BRASS_COLOR = 0.75;

/** The segment that is sounding at `timeSeconds`, if any. */
export function segmentAt(timeline: Timeline, timeSeconds: number): PerformanceSegment | null {
  for (const s of timeline.segments) {
    if (timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds) return s;
  }
  return null;
}
