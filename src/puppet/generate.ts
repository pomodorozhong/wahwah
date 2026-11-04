// Sample a Rust-generated face track on the host's playback clock.
import { NEUTRAL, lerpControls, type FaceControlTrack, type FaceControls } from './controls';

/** Controls at an arbitrary time; neutral outside the track. */
export function sampleFaceTrack(track: FaceControlTrack, timeSeconds: number): FaceControls {
  if (timeSeconds <= 0 || timeSeconds >= track.durationSeconds || track.samples.length === 0) return { ...NEUTRAL };
  const pos = timeSeconds * track.sampleRateHz;
  const i = Math.floor(pos);
  const a = track.samples[Math.min(i, track.samples.length - 1)];
  const b = track.samples[Math.min(i + 1, track.samples.length - 1)];
  return lerpControls(a, b, pos - i);
}
