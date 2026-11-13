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

/** How the volume falls into a cut: not at all, in a line, along a half cosine, fast at first, or in a line in decibels. */
export type FadeCurve = 'none' | 'linear' | 'smooth' | 'quick' | 'decibel';

/** The fade into the end of a line that a maximum duration cut. Default: 80 ms, linear. */
export interface CutFade {
  /** 0 to 5000. Held to the length of the audio. */
  milliseconds?: number;
  curve?: FadeCurve;
  /** 0.1 to 8, default 1. Above 1 holds the volume longer, then drops faster. Below 1 drops sooner. */
  exponent?: number;
  /** 0 to 1, default 0. The volume the fade ends at. */
  endVolume?: number;
}

/** How the speed changes along a sped-up line: steady, faster toward the end, faster at the start, or eased. */
export type SpeedProfile = 'constant' | 'rampUp' | 'rampDown' | 'smooth';

/** How a long line is sped up before any of it is cut. Default: constant, up to 1.6 times. */
export interface SpeedUp {
  profile?: SpeedProfile;
  /** 1 to 3, default 1.6. The fastest the line gets. 1 turns the speed-up off. */
  max?: number;
}

/** The volume along a capped line, whether or not it had to be fitted, shaped like the speed-up. Default: steady at 1. */
export interface Volume {
  /** 'constant' holds `level`; the ramps move between 1 and `level`, as they do for the speed. */
  profile?: SpeedProfile;
  /** 0 to 2, default 1. Above 1 boosts, and the result is kept within full scale. */
  level?: number;
}

/** Where a line that is still too long is cut: at the cap, even inside a word, or after the last word that fits whole. */
export type CutAt = 'anywhere' | 'word';

/** Everything that shapes how a line is fitted to a maximum duration. */
export interface FitOptions {
  cutFade?: CutFade;
  speedUp?: SpeedUp;
  /** Default 'anywhere'. With 'word' the line ends where the last word that fits whole ends, and the fade shapes that ending. */
  cutAt?: CutAt;
  /** Applies to a line that was fitted, before the fade. */
  volume?: Volume;
}

/** What a maximum duration did to a line. */
export interface DurationFit {
  /** How long the line would have taken without a cap. */
  naturalSeconds: number;
  /** The average speed over the line. 1 when it was not sped up. */
  speed: number;
  /** The fastest the line got. The same as `speed` for a constant speed-up. */
  peakSpeed: number;
  /** True when the end of the line was cut, with a short fade. */
  truncated: boolean;
  /** When the line was cut, the time of the cut on the fitted line. */
  cutSeconds?: number | null;
  /** True when the cut fell between words. */
  atWord?: boolean;
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
