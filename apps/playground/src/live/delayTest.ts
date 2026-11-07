// Delay test: analyse a recording exactly as live mode would (same estimator,
// settings, profile and audio-thread cadence), then work out when to show each
// mouth frame when the audio is played back with a chosen delay. A positive
// delay holds the audio back so the (late) mouth can catch up, the way a
// stream delays its audio to match an avatar.

import { NEUTRAL, lerpControls, type FaceControls } from 'wahwah/performance';
import { pearson } from '../analysis';
import { LiveMouthEstimator, type LiveSettings } from './estimator';
import { magnitudeSpectrumDb } from './features';
import type { VoiceProfile } from './profile';
import { ulsInputLength } from './ulipsync';

export interface MouthFrame extends FaceControls {
  /** Seconds into the recording at which this frame becomes available live. */
  t: number;
  sound: string | null;
}

export interface AnalysedRecording {
  sampleRate: number;
  duration: number;
  frames: MouthFrame[];
  /** Hop between frames, seconds. */
  hopSeconds: number;
}

/**
 * Run the live estimator over a recording at the given hop, causally: each
 * frame only sees audio up to its own time, as on the audio thread.
 */
export function analyseRecording(
  pcm: Float32Array,
  sampleRate: number,
  settings: LiveSettings,
  profile: VoiceProfile | null,
  hop = 256,
): AnalysedRecording {
  const est = new LiveMouthEstimator({ ...settings });
  est.setProfile(profile);
  const longN = ulsInputLength(sampleRate);
  const shortN = 1024;
  const padded = new Float32Array(longN + pcm.length);
  padded.set(pcm, longN); // silence before the recording, like an idle mic
  const frames: MouthFrame[] = [];
  const dt = hop / sampleRate;
  for (let end = hop; end <= padded.length; end += hop) {
    if (end < shortN) continue;
    const short = padded.subarray(end - shortN, end);
    const long = end >= longN ? padded.subarray(end - longN, end) : undefined;
    const f = est.process(short, magnitudeSpectrumDb(short), sampleRate, dt, long);
    const t = (end - longN) / sampleRate;
    if (t >= 0) frames.push({ t, jawOpen: f.jawOpen, lipWidth: f.lipWidth, lipRound: f.lipRound, sound: f.sound });
  }
  return { sampleRate, duration: pcm.length / sampleRate, frames, hopSeconds: dt };
}

/** Mouth pose shown at `t` seconds into the recording (the latest available frame, interpolated). */
export function mouthAt(rec: AnalysedRecording, t: number): FaceControls {
  const f = rec.frames;
  if (!f.length || t <= f[0].t) return { ...NEUTRAL };
  if (t >= f[f.length - 1].t) return { ...f[f.length - 1] };
  const i = Math.min(f.length - 2, Math.floor((t - f[0].t) / rec.hopSeconds));
  const a = f[i];
  const b = f[i + 1];
  return lerpControls(a, b, Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
}

/**
 * How far the mouth trails the sound in this recording, ms: the lag that best
 * lines jaw opening up with loudness (search 0-300 ms).
 */
export function measureMouthLagMs(pcm: Float32Array, rec: AnalysedRecording): number {
  const step = 0.005;
  const env: number[] = [];
  const jaw: number[] = [];
  const win = Math.round(rec.sampleRate * step);
  for (let t = 0; t + step <= rec.duration; t += step) {
    const s = Math.round(t * rec.sampleRate);
    let sum = 0;
    for (let i = s; i < s + win; i++) sum += pcm[i] * pcm[i];
    env.push(Math.sqrt(sum / win));
    jaw.push(mouthAt(rec, t + step).jawOpen);
  }
  let best = { lag: 0, r: -Infinity };
  for (let lag = 0; lag <= 60; lag++) {
    const r = pearson(env.slice(0, env.length - lag), jaw.slice(lag));
    if (r > best.r) best = { lag, r };
  }
  return best.lag * step * 1000;
}

export interface PlaybackPlan {
  /** AudioContext time to start the audio. */
  audioStart: number;
  /** AudioContext time that corresponds to recording time 0 for the mouth. */
  mouthZero: number;
}

/**
 * Schedule playback with `delayMs` of audio delay (negative: audio early).
 * The mouth follows the recording as if it were live input arriving from
 * `mouthZero`; the audio is heard `delayMs` later than that.
 */
export function planPlayback(now: number, delayMs: number, lead = 0.1): PlaybackPlan {
  const d = delayMs / 1000;
  const mouthZero = now + lead + Math.max(0, -d);
  return { audioStart: mouthZero + d, mouthZero };
}
