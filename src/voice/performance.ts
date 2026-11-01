// Voice module: phoneme text + voice settings -> speech performance -> audio.
// Nothing here depends on Three.js or the DOM, so it runs in Node tests too.

import { compileString, renderToBuffer, type ScheduleEvent } from 'klattsch';

export interface VoiceSettings {
  /** Base pitch in Hz (klattsch `baseF0`). */
  pitchHz: number;
  /** Milliseconds per phoneme (klattsch `rate`). Lower is faster. */
  msPerPhoneme: number;
  /** Formant scale; above 1 sounds smaller, below 1 sounds larger. */
  formantScale: number;
  /** Optional expression, passed to klattsch as-is. */
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

/**
 * Something a playground can play: a timeline plus a way to render its audio.
 * Each sound engine (klattsch, Babble Engine) produces one.
 */
export interface Utterance {
  engine: string;
  timeline: Timeline;
  warnings: string[];
  render(sampleRate: number): Float32Array;
}

/**
 * The shared speech performance: the internal handoff that both the audio
 * renderer and the puppet instruction generator read.
 */
export interface SpeechPerformance extends Timeline {
  source: string;
  settings: VoiceSettings;
  /** klattsch synthesis targets, consumed only by the audio renderer. */
  schedule: ScheduleEvent[];
  warnings: string[];
}

export function compilePerformance(source: string, settings: VoiceSettings): SpeechPerformance {
  const result = compileString(source, {
    baseF0: settings.pitchHz,
    rate: settings.msPerPhoneme,
    scale: settings.formantScale,
    vibratoDepth: settings.vibratoDepth,
    aspiration: settings.aspiration,
    effort: settings.effort,
    tilt: settings.tilt,
  });
  const segments: PerformanceSegment[] = result.phrases
    .filter((p) => p.kind === 'phoneme' || p.kind === 'pause')
    .map((p) => ({
      phoneme: p.phoneme,
      startSeconds: p.tStartMs / 1000,
      endSeconds: p.tEndMs / 1000,
      srcStart: p.tokenSrcStart,
      srcEnd: p.srcEnd,
    }));
  return {
    source,
    settings,
    durationSeconds: result.totalMs / 1000,
    segments,
    schedule: result.schedule,
    warnings: result.warnings,
  };
}

/** Render the whole utterance to mono samples. */
export function renderPerformance(performance: SpeechPerformance, sampleRate: number): Float32Array {
  if (performance.schedule.length === 0) return new Float32Array(0);
  return renderToBuffer({
    sampleRate,
    schedule: performance.schedule,
    totalMs: performance.durationSeconds * 1000,
  });
}

/** Wrap a klattsch performance as a playable utterance. */
export function klattschUtterance(performance: SpeechPerformance): Utterance {
  return {
    engine: 'klattsch',
    timeline: performance,
    warnings: performance.warnings,
    render: (sampleRate) => renderPerformance(performance, sampleRate),
  };
}

/** The segment that is sounding at `timeSeconds`, if any. */
export function segmentAt(timeline: Timeline, timeSeconds: number): PerformanceSegment | null {
  for (const s of timeline.segments) {
    if (timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds) return s;
  }
  return null;
}
