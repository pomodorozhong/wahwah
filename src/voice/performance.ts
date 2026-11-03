// Voice module: phoneme text + voice settings -> speech performance -> audio.
// Nothing here depends on Three.js or the DOM, so it runs in Node tests too.

import { compileString, renderToBuffer, type ScheduleEvent } from 'klattsch';
import { DEFAULT_TROMBONE, renderTrombone } from '../engines/trombone';
import type { FaceControlTrack } from '../puppet/controls';

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

/** A complete Rust performance, rendered once at the playback sample rate. */
export interface RenderedUtterance {
  engine: string;
  timeline: Timeline;
  warnings: string[];
  audio: Float32Array;
  track: FaceControlTrack | null;
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

export const DEFAULT_BRASS_COLOR = 0.75;

/** Change the resonances of voiced sounds on the compiled klattsch score. */
function colorBrass(event: ScheduleEvent, amount: number): ScheduleEvent {
  const t = event.target;
  // Pauses, bursts and noise consonants keep their original articulation.
  if (!t.voicing || t.isStop || !t.F1) return event;
  const weight = amount * t.voicing;
  const mix = (dry: number, brass: number) => dry + weight * (brass - dry);
  // F1 rises as a vowel opens. Use that movement to sweep the mute above
  // a broad lower resonance that carries the body of the horn.
  const opening = Math.max(0, Math.min(1, (t.F1 - 200) / 600));
  const bell = 360 + 1700 * opening;
  // Broader resonances pass more energy; keep vowels level with consonants.
  const level = 1 - 0.64 * weight;
  return { ...event, target: {
    ...t,
    effort: mix(t.effort, 0.95),
    F1: mix(t.F1, 1.7 * t.F0 + 75), BW1: mix(t.BW1, 250),
    F2: mix(t.F2, bell), BW2: mix(t.BW2, bell * 0.26),
    F3: mix(t.F3, bell * 1.85), BW3: mix(t.BW3, bell * 0.38),
    A1: t.A1 * level * (1 - weight * 0.30),
    A2: t.A2 * level,
    A3: t.A3 * level * (1 - weight * 0.50),
  } };
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
export function renderPerformance(performance: SpeechPerformance, sampleRate: number, brassColor = 0): Float32Array {
  if (performance.schedule.length === 0) return new Float32Array(0);
  const speech = renderToBuffer({
    sampleRate,
    schedule: brassColor > 0 ? performance.schedule.map(e => colorBrass(e, Math.min(1, brassColor))) : performance.schedule,
    totalMs: performance.durationSeconds * 1000,
  });
  if (brassColor > DEFAULT_BRASS_COLOR) {
    const amount = (Math.min(1, brassColor) - DEFAULT_BRASS_COLOR) / (1 - DEFAULT_BRASS_COLOR);
    mixTrombone(performance, speech, sampleRate, amount);
  }
  return speech;
}

/** Hand voiced sounds to the horn, following each klattsch onset, closure and release. */
function mixTrombone(performance: SpeechPerformance, speech: Float32Array, sampleRate: number, amount: number): void {
  const horn = renderTrombone(performance, sampleRate, { ...DEFAULT_TROMBONE, transpose: 0 }, 'speech');
  // Follow syllable loudness without imprinting individual pitch cycles on the horn.
  const smoothing = 1 - Math.exp(-1 / (sampleRate * 0.012));
  let voicePower = 0;
  let hornPower = 0;
  let blend = 0;
  let targetBlend = 0;
  let increment = 0;
  let rampLeft = 0;
  let next = 0;
  const events = performance.schedule;
  for (let i = 0; i < Math.min(speech.length, horn.length); i++) {
    while (next < events.length && Math.floor(events[next].atMs * sampleRate / 1000) <= i) {
      const { target, transitionMs } = events[next++];
      targetBlend = target.isStop ? 0 : amount * (target.voicing ?? 0);
      rampLeft = Math.max(1, Math.floor(transitionMs * sampleRate / 1000));
      increment = (targetBlend - blend) / rampLeft;
    }
    if (rampLeft > 0) {
      rampLeft--;
      blend = rampLeft === 0 ? targetBlend : blend + increment;
    }
    const voice = speech[i];
    const brass = horn[i];
    voicePower += smoothing * (voice * voice - voicePower);
    hornPower += smoothing * (brass * brass - hornPower);
    const gain = Math.min(3.5, Math.sqrt(voicePower / Math.max(0.0016, hornPower)));
    speech[i] = voice + blend * (Math.tanh(brass * gain) - voice);
  }
}

/** Wrap a klattsch performance as a playable utterance. */
export function klattschUtterance(performance: SpeechPerformance, brassColor = 0): Utterance {
  return {
    engine: 'klattsch',
    timeline: performance,
    warnings: performance.warnings,
    render: (sampleRate) => renderPerformance(performance, sampleRate, brassColor),
  };
}

/** The segment that is sounding at `timeSeconds`, if any. */
export function segmentAt(timeline: Timeline, timeSeconds: number): PerformanceSegment | null {
  for (const s of timeline.segments) {
    if (timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds) return s;
  }
  return null;
}
