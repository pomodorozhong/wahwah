// Host adapter: maps host-agnostic FaceControls onto this preview face's rig.
// A different character would supply its own adapter with the same input.

import { NEUTRAL, lerpControls, type FaceControls } from '../puppet/controls';
import type { MouthShape, PreviewFace } from './face';

/** The preview rig's mapping from controls to mouth geometry. */
export function controlsToMouth(c: FaceControls): MouthShape {
  return {
    halfWidth: 0.2 + 0.1 * c.lipWidth - 0.1 * c.lipRound,
    upperOpen: 0.035 + 0.04 * c.jawOpen + 0.025 * c.lipRound,
    lowerOpen: 0.035 + 0.2 * c.jawOpen + 0.03 * c.lipRound,
    protrusion: 0.1 * c.lipRound,
    lipThickness: 0.032 + 0.016 * c.lipRound,
    cornerLift: 0.035 * c.lipWidth,
  };
}

export class FaceHostAdapter {
  private current: FaceControls = { ...NEUTRAL };
  private relaxing = false;

  constructor(private readonly face: PreviewFace, private readonly relaxSeconds = 0.08) {
    this.apply();
  }

  /** Follow a control sample exactly (the track is already smoothed). */
  follow(controls: FaceControls): void {
    this.relaxing = false;
    this.current = { ...controls };
    this.apply();
  }

  /** Ease back to neutral, e.g. after stop or when the puppet is disabled. */
  relax(): void {
    this.relaxing = true;
  }

  get controls(): FaceControls {
    return this.current;
  }

  tick(dtSeconds: number): void {
    if (!this.relaxing) return;
    const t = 1 - Math.exp(-dtSeconds / this.relaxSeconds);
    this.current = lerpControls(this.current, NEUTRAL, t);
    const done = Math.max(this.current.jawOpen, this.current.lipWidth, this.current.lipRound) < 1e-3;
    if (done) {
      this.current = { ...NEUTRAL };
      this.relaxing = false;
    }
    this.apply();
  }

  private apply(): void {
    this.face.setMouth(controlsToMouth(this.current));
    this.face.setBrowLift(this.current.jawOpen * 0.6);
  }
}
