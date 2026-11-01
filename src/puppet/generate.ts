// Puppet instruction generator: speech performance -> timed face controls.
// Pure and host-agnostic; it is only called when puppet output is enabled.

import type { Timeline } from '../voice/performance';
import {
  NEUTRAL,
  lerpControls,
  normalizeControls,
  type FaceControlSample,
  type FaceControlTrack,
  type FaceControls,
} from './controls';
import { UNKNOWN_VISEME, VISEMES } from './visemes';

export interface GenerateOptions {
  /** Samples per second in the output track. */
  sampleRateHz?: number;
  /** Move the mouth this many seconds before the sound, as real mouths do. */
  anticipationSeconds?: number;
  /** Time to ease from and back to neutral at the edges of a pause. */
  restSeconds?: number;
}

export const DEFAULT_GENERATE_OPTIONS: Required<GenerateOptions> = {
  sampleRateHz: 100,
  anticipationSeconds: 0.02,
  restSeconds: 0.06,
};

interface Keyframe {
  time: number;
  pose: FaceControls;
  dominance: number;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

function buildKeyframes(performance: Timeline, opts: Required<GenerateOptions>): Keyframe[] {
  const keys: Keyframe[] = [{ time: 0, pose: { ...NEUTRAL }, dominance: 1 }];
  for (const seg of performance.segments) {
    const len = seg.endSeconds - seg.startSeconds;
    if (seg.phoneme === null) {
      // Pause: relax to neutral in the middle, keeping the edges for blending.
      if (len > opts.restSeconds * 2) {
        keys.push({ time: seg.startSeconds + opts.restSeconds, pose: { ...NEUTRAL }, dominance: 1 });
        keys.push({ time: seg.endSeconds - opts.restSeconds, pose: { ...NEUTRAL }, dominance: 1 });
      }
      continue;
    }
    const v = VISEMES[seg.phoneme] ?? UNKNOWN_VISEME;
    const shift = opts.anticipationSeconds;
    if (v.glideTo) {
      keys.push({ time: seg.startSeconds + len * 0.3 - shift, pose: v.pose, dominance: v.dominance });
      keys.push({ time: seg.startSeconds + len * 0.8 - shift, pose: v.glideTo, dominance: v.dominance });
    } else {
      keys.push({ time: seg.startSeconds + len * 0.5 - shift, pose: v.pose, dominance: v.dominance });
    }
  }
  keys.push({ time: performance.durationSeconds, pose: { ...NEUTRAL }, dominance: 1 });

  // Coarticulation: weak sounds borrow the average of their neighbours.
  const blended = keys.map((k, i) => {
    if (k.dominance >= 1 || i === 0 || i === keys.length - 1) return k;
    const ctx = lerpControls(keys[i - 1].pose, keys[i + 1].pose, 0.5);
    return { ...k, pose: lerpControls(ctx, k.pose, k.dominance) };
  });

  // Keep times monotonic after the anticipation shift.
  for (let i = 1; i < blended.length; i++) {
    if (blended[i].time < blended[i - 1].time) blended[i] = { ...blended[i], time: blended[i - 1].time };
  }
  return blended;
}

function poseAt(keys: Keyframe[], time: number): FaceControls {
  if (time <= keys[0].time) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (time <= b.time) {
      const span = b.time - a.time;
      const t = span > 0 ? (time - a.time) / span : 1;
      return lerpControls(a.pose, b.pose, smoothstep(t));
    }
  }
  return keys[keys.length - 1].pose;
}

function phonemeAt(performance: Timeline, time: number): string | null {
  for (const s of performance.segments) {
    if (time >= s.startSeconds && time < s.endSeconds) return s.phoneme;
  }
  return null;
}

export function generateFaceTrack(performance: Timeline, options: GenerateOptions = {}): FaceControlTrack {
  const opts = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const keys = buildKeyframes(performance, opts);
  const count = Math.max(2, Math.ceil(performance.durationSeconds * opts.sampleRateHz) + 1);
  const samples: FaceControlSample[] = [];
  for (let i = 0; i < count; i++) {
    const timeSeconds = Math.min(i / opts.sampleRateHz, performance.durationSeconds);
    samples.push({
      timeSeconds,
      phoneme: phonemeAt(performance, timeSeconds),
      ...normalizeControls(poseAt(keys, timeSeconds)),
    });
  }
  // The track always ends exactly at neutral.
  const last = samples[samples.length - 1];
  Object.assign(last, NEUTRAL);
  return { sampleRateHz: opts.sampleRateHz, durationSeconds: performance.durationSeconds, samples };
}

/** Controls at an arbitrary time; neutral outside the track. */
export function sampleFaceTrack(track: FaceControlTrack, timeSeconds: number): FaceControls {
  if (timeSeconds <= 0 || timeSeconds >= track.durationSeconds || track.samples.length === 0) return { ...NEUTRAL };
  const pos = timeSeconds * track.sampleRateHz;
  const i = Math.floor(pos);
  const a = track.samples[Math.min(i, track.samples.length - 1)];
  const b = track.samples[Math.min(i + 1, track.samples.length - 1)];
  return lerpControls(a, b, pos - i);
}
