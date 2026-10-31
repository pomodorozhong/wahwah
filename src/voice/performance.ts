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
 * The shared speech performance: the internal handoff that both the audio
 * renderer and the puppet instruction generator read.
 */
export interface SpeechPerformance {
  source: string;
  settings: VoiceSettings;
  durationSeconds: number;
  segments: PerformanceSegment[];
  /** klattsch synthesis targets, consumed only by the audio renderer. */
  schedule: ScheduleEvent[];
  warnings: string[];
}

export function compilePerformance(source: string, settings: VoiceSettings): SpeechPerformance {
  const result = compileString(source, {
    baseF0: settings.pitchHz,
    rate: settings.msPerPhoneme,
    scale: settings.formantScale,
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

/** The segment that is sounding at `timeSeconds`, if any. */
export function segmentAt(performance: SpeechPerformance, timeSeconds: number): PerformanceSegment | null {
  for (const s of performance.segments) {
    if (timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds) return s;
  }
  return null;
}
