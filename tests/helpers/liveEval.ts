// Feed audio through the live estimator frame by frame, as the live page does.
import { LiveMouthEstimator, DEFAULT_LIVE, type LiveFrame, type ShapeMode } from '../../src/live/estimator';
import type { VoiceProfile } from '../../src/live/profile';
import { magnitudeSpectrumDb } from '../../src/live/features';

export const SR = 48000;
export const N = 1024;
export const DT = 1 / 60;

export function runLive(audio: Float32Array, shapeMode: ShapeMode = 'formants', lead = 0.3, profile: VoiceProfile | null = null): LiveFrame[] {
  const est = new LiveMouthEstimator({ ...DEFAULT_LIVE, shapeMode, ...(profile ? { gateDb: profile.suggested.gateDb, rangeDb: profile.suggested.rangeDb } : {}) });
  est.setProfile(profile);
  // A little near-silence first, like a room before someone speaks.
  const pad = new Float32Array(Math.round(lead * SR));
  for (let i = 0; i < pad.length; i++) pad[i] = 1e-4 * Math.sin(i * 0.37);
  const x = new Float32Array(pad.length + audio.length);
  x.set(pad);
  x.set(audio, pad.length);
  const hop = Math.round(SR * DT);
  const frames: LiveFrame[] = [];
  for (let end = N; end <= x.length; end += hop) {
    const f = x.subarray(end - N, end);
    const fr = est.process(f, magnitudeSpectrumDb(f), SR, DT);
    if (end - N >= pad.length) frames.push(fr);
  }
  return frames;
}

/** Mean of the controls over the middle part of a held sound. */
export function heldPose(frames: LiveFrame[]) {
  const mid = frames.slice(Math.floor(frames.length * 0.4), Math.floor(frames.length * 0.8));
  const avg = (k: 'jawOpen' | 'lipWidth' | 'lipRound') => mid.reduce((s, f) => s + f[k], 0) / Math.max(1, mid.length);
  const counts = new Map<string, number>();
  for (const f of mid) if (f.sound) counts.set(f.sound, (counts.get(f.sound) ?? 0) + 1);
  const sound = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { jawOpen: avg('jawOpen'), lipWidth: avg('lipWidth'), lipRound: avg('lipRound'), sound };
}
