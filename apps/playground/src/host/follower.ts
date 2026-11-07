// Control follower: holds the controls every face host draws. It follows the
// track exactly while playing and eases back to neutral after stop, so no
// host is ever left stuck in an active mouth pose.

import { NEUTRAL, lerpControls, type FaceControls } from 'wahwah/performance';

export class ControlFollower {
  private current: FaceControls = { ...NEUTRAL };
  private relaxing = false;

  constructor(private readonly relaxSeconds = 0.08) {}

  /** Follow a control sample exactly (the track is already smoothed). */
  follow(controls: FaceControls): void {
    this.relaxing = false;
    this.current = { ...controls };
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
  }
}
