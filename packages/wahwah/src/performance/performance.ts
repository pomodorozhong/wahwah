// The rendered performance contract: audio, a timeline and an optional face track.
import type { FaceControlTrack } from './controls.js';

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

/** What a maximum duration did to a line. */
export interface DurationFit {
  /** How long the line would have taken without a cap. */
  naturalSeconds: number;
  /** 1 when the line was not sped up, at most 1.6. */
  speed: number;
  /** True when the end of the line was cut, with a short fade. */
  truncated: boolean;
}

/** A complete Rust performance, rendered once at the playback sample rate. */
export interface RenderedUtterance {
  engine: string;
  timeline: Timeline;
  warnings: string[];
  audio: Float32Array;
  track: FaceControlTrack | null;
  /** Set only when a maximum duration shortened the line. */
  fit?: DurationFit | null;
}

/** The segment that is sounding at `timeSeconds`, if any. */
export function segmentAt(timeline: Timeline, timeSeconds: number): PerformanceSegment | null {
  for (const s of timeline.segments) {
    if (timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds) return s;
  }
  return null;
}
