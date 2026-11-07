import { type FaceControls } from 'wahwah/performance';

interface Timing {
  attack: number;
  release: number;
  follow: number;
  fps?: number;
  acting?: 'curious' | 'brisk' | 'measured';
  glanceSide?: number;
}

const delivery = {
  curious:  { hold:.42, up:.74, lift:1.00, release:.31 },
  measured: { hold:.64, up:-.54, lift:.79, release:.39 },
  brisk:    { hold:.26, up:.37, lift:.93, release:.20 },
};
const approach = (from:number, to:number, dt:number, seconds:number) =>
  from + (to-from) * -Math.expm1(-dt/seconds);

/** Two independent controls for geometry authored in each puppet. The
 * crossing of these signals on release gives a trailing part time to land. */
export class StudyMotion {
  drive = 0;
  follow = 0;
  gazeX = 0;
  gazeY = 0;
  brow = 0;
  private silence = 1;
  private sinceAccent = 1;
  private phraseTime = 0;
  private previousJaw = 0;
  private phrase = 0;
  constructor(readonly timing: Timing) {}

  update(controls: FaceControls, dt: number, breath = 0): void {
    const effort = Math.min(1, 1.4 * controls.jawOpen + .76 * controls.lipWidth + .91 * controls.lipRound + breath);
    if (dt === 0) {
      // Pose buttons and screenshots show the settled posture for this sound.
      this.drive = this.follow = effort;
      // The comparison sheet holds poses via zero-delta renders. This also
      // resets its acting clock so repeated plays start from the same gaze.
      this.gazeX = this.gazeY = this.brow = 0;
      this.silence = this.sinceAccent = 1;
      this.phrase = this.phraseTime = this.previousJaw = 0;
      return;
    }
    const duration = effort > this.drive ? this.timing.attack : this.timing.release;
    this.drive += (effort - this.drive) * -Math.expm1(-dt / duration);
    this.follow += (this.drive - this.follow) * -Math.expm1(-dt / this.timing.follow);
    this.act(controls, dt);
  }

  private act(c: FaceControls, dt: number): void {
    const score = delivery[this.timing.acting ?? 'curious'];
    // Quiet gaps separate phrases. A lip closure inside a word is too short
    // to send the eyes off in a new direction.
    const speaking = Math.max(c.jawOpen,c.lipWidth,c.lipRound) > .13;
    if (speaking && this.silence >= .19) {
      this.phrase++;
      this.phraseTime = 0;
      this.sinceAccent = 0;
    } else if (speaking && this.sinceAccent > .36 && c.jawOpen > .42 && (c.jawOpen-this.previousJaw) / dt > 1.3) {
      this.sinceAccent = 0;
    }
    this.silence = speaking ? 0 : this.silence + dt;
    this.phraseTime += dt;
    this.sinceAccent += dt;
    this.previousJaw = c.jawOpen;

    // Glance aside first, then fix on the listener through the rest of the
    // phrase. The brows arrive a beat after the eyes and release on their own.
    const engaged = this.phrase > 0 && this.silence < .26;
    const glancing = this.phraseTime < score.hold;
    const side = (this.timing.glanceSide ?? 1) * (this.phrase % 2 ? 1 : -1);
    const x = engaged ? side * (glancing ? .92 : -.38) : 0;
    const y = engaged ? (glancing ? score.up : -.17 * Math.sign(score.up)) : 0;
    this.gazeX = approach(this.gazeX,x,dt,engaged ? .043 : .16);
    this.gazeY = approach(this.gazeY,y,dt,engaged ? .057 : .19);
    const age = this.sinceAccent;
    const accent = this.phrase > 0 && age > .055 ? score.lift * Math.exp(-Math.max(0,age-.17) / score.release) : 0;
    this.brow = approach(this.brow,accent,dt,accent > this.brow ? .045 : .095);
  }
}
