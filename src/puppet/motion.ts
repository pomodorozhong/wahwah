// Motion of the face controls, for debugging: how fast each control moves
// (velocity) and how hard it is being pushed (acceleration, i.e. force for a
// unit-mass control). Works on any stream of FaceControls, whatever produced it.

import { type FaceControls } from 'wahwah/performance';

export const CHANNELS = ['jawOpen', 'lipWidth', 'lipRound'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ChannelMotion {
  value: number;
  /** Units per second; positive means the control is increasing. */
  velocity: number;
  /** Units per second squared; positive means pushed toward increasing. */
  force: number;
}

export type FaceMotion = Record<Channel, ChannelMotion>;

const zero = (): FaceMotion => ({
  jawOpen: { value: 0, velocity: 0, force: 0 },
  lipWidth: { value: 0, velocity: 0, force: 0 },
  lipRound: { value: 0, velocity: 0, force: 0 },
});

/**
 * Finite differences between successive frames, lightly smoothed so frame-time
 * jitter does not dominate the second derivative.
 */
export class MotionTracker {
  private motion = zero();
  private hasPrev = false;

  constructor(
    private readonly velocitySmoothingSeconds = 0.02,
    private readonly forceSmoothingSeconds = 0.04,
  ) {}

  update(controls: FaceControls, dtSeconds: number): FaceMotion {
    if (dtSeconds <= 0) return this.motion;
    const next = zero();
    const kv = this.hasPrev ? 1 - Math.exp(-dtSeconds / this.velocitySmoothingSeconds) : 0;
    const kf = this.hasPrev ? 1 - Math.exp(-dtSeconds / this.forceSmoothingSeconds) : 0;
    for (const ch of CHANNELS) {
      const prev = this.motion[ch];
      const value = controls[ch];
      const rawVelocity = this.hasPrev ? (value - prev.value) / dtSeconds : 0;
      const velocity = prev.velocity + (rawVelocity - prev.velocity) * kv;
      const rawForce = this.hasPrev ? (velocity - prev.velocity) / dtSeconds : 0;
      const force = prev.force + (rawForce - prev.force) * kf;
      next[ch] = { value, velocity, force };
    }
    this.hasPrev = true;
    this.motion = next;
    return next;
  }

  get current(): FaceMotion {
    return this.motion;
  }
}
