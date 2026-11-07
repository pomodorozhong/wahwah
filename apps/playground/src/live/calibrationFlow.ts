// Self-paced calibration flow (pure, testable): each sound is recorded only
// while the speaker is actually making it. Recording starts when the voice
// crosses a trigger level, the step completes after enough seconds of sound,
// and the speaker can redo, go back or skip at any time. The quiet step waits
// for an explicit "I'm quiet".

import { CALIBRATION_STEPS, Calibration, type CalibrationStep, type FrameFeatures, type VoiceProfile } from './profile';

export type FlowPhase =
  | 'intro' // explanation, waiting for Begin
  | 'quiet-wait' // silence step, waiting for "I'm quiet"
  | 'quiet' // measuring room noise
  | 'listening' // waiting for the speaker to start the sound
  | 'capturing' // the sound is being recorded
  | 'got-it' // brief confirmation before the next step
  | 'finished';

export interface FlowOptions {
  /** Seconds of active sound needed per step. */
  needSeconds: number;
  /** Seconds of room noise measured on the quiet step. */
  quietSeconds: number;
  /** Trigger level above the measured room noise, dB (fricatives use less). */
  triggerDb: number;
  /** Pause after a step completes, seconds. */
  confirmSeconds: number;
  /** After this long without hearing anything, show a hint. */
  hintAfterSeconds: number;
}

export const DEFAULT_FLOW: FlowOptions = {
  needSeconds: 1.5,
  quietSeconds: 1.5,
  triggerDb: 14,
  confirmSeconds: 0.8,
  hintAfterSeconds: 6,
};

/** Before the room is measured, treat this as the noise floor. */
const DEFAULT_FLOOR_DB = -60;

export interface FlowView {
  phase: FlowPhase;
  stepIndex: number;
  step: CalibrationStep | null;
  /** 0..1 progress of the current step. */
  progress: number;
  /** Level that counts as "making the sound", dBFS. */
  triggerDb: number;
  levelDb: number;
  /** Short status for the speaker. */
  status: string;
  /** Steps that have usable data. */
  done: boolean[];
}

export class CalibrationFlow {
  readonly calibration = new Calibration();
  private phase: FlowPhase = 'intro';
  private index = 0;
  private collected = 0; // seconds of active sound in this step
  private sinceOnset = 0; // seconds since the sound first started in this step
  private phaseTime = 0; // seconds in the current phase
  private floorDb = DEFAULT_FLOOR_DB;
  private levelDb = -140;
  private readonly done = CALIBRATION_STEPS.map(() => false);
  private result: VoiceProfile | null = null;

  constructor(
    private readonly sampleRate: number,
    readonly options: FlowOptions = DEFAULT_FLOW,
    readonly steps: CalibrationStep[] = CALIBRATION_STEPS,
  ) {}

  /** Leave the intro and start at the first step. */
  begin(): void {
    if (this.phase === 'intro') this.enter(0);
  }

  /** Quiet step: the speaker confirms they are silent. */
  confirmQuiet(): void {
    if (this.phase === 'quiet-wait') this.setPhase('quiet');
  }

  /** Throw away this step's recording and listen again. */
  redo(): void {
    if (this.phase === 'intro' || this.phase === 'finished') return;
    this.enter(this.index);
  }

  /** Go back one step and record it again. */
  back(): void {
    if (this.phase === 'intro' || this.phase === 'finished') return;
    this.enter(Math.max(0, this.index - 1));
  }

  /** Move on without (more) data for this step. */
  skip(): void {
    if (this.phase === 'intro' || this.phase === 'finished') return;
    this.next();
  }

  get profile(): VoiceProfile | null {
    return this.result;
  }

  /** Feed one analysis frame. Returns true when the profile has just been built. */
  frame(f: FrameFeatures, dtSeconds: number): boolean {
    this.levelDb = f.levelDb;
    this.phaseTime += dtSeconds;
    const step = this.steps[this.index];
    switch (this.phase) {
      case 'quiet':
        this.calibration.add(step.id, f, this.phaseTime + 1); // no settle skip for silence
        if (this.phaseTime >= this.options.quietSeconds) {
          const frames = this.calibration.frames.get(step.id) ?? [];
          const levels = frames.map((x) => x.levelDb).sort((a, b) => a - b);
          if (levels.length) this.floorDb = Math.max(-90, levels[levels.length >> 1]);
          this.done[this.index] = true;
          this.setPhase('got-it');
        }
        break;
      case 'listening':
        if (f.levelDb > this.trigger(step)) {
          this.sinceOnset = 0;
          this.setPhase('capturing');
          this.capture(step, f, dtSeconds);
        }
        break;
      case 'capturing':
        this.sinceOnset += dtSeconds;
        this.capture(step, f, dtSeconds);
        break;
      case 'got-it':
        if (this.phaseTime >= this.options.confirmSeconds) this.next();
        break;
      default:
        break;
    }
    if (this.phase === 'finished' && !this.result) {
      this.result = this.calibration.build(this.sampleRate);
      return true;
    }
    return false;
  }

  view(): FlowView {
    const step = this.phase === 'intro' || this.phase === 'finished' ? null : this.steps[this.index];
    let progress = 0;
    if (this.phase === 'quiet') progress = this.phaseTime / this.options.quietSeconds;
    else if (this.phase === 'capturing' || this.phase === 'listening') progress = this.collected / this.options.needSeconds;
    else if (this.phase === 'got-it') progress = 1;
    return {
      phase: this.phase,
      stepIndex: this.index,
      step,
      progress: Math.min(1, progress),
      triggerDb: step ? this.trigger(step) : this.floorDb + this.options.triggerDb,
      levelDb: this.levelDb,
      status: this.status(),
      done: [...this.done],
    };
  }

  private capture(step: CalibrationStep, f: FrameFeatures, dt: number): void {
    // Only frames with the sound actually present count toward the step.
    if (f.levelDb > this.trigger(step)) {
      this.calibration.add(step.id, f, this.sinceOnset);
      if (this.sinceOnset >= 0.35) this.collected += dt;
    }
    if (this.collected >= this.options.needSeconds) {
      this.done[this.index] = true;
      this.setPhase('got-it');
    }
  }

  private trigger(step: CalibrationStep): number {
    // Hissing and humming are quieter than open vowels.
    const db = step.id === 'S' || step.id === 'SH' || step.id === 'M' ? this.options.triggerDb - 6 : this.options.triggerDb;
    return this.floorDb + db;
  }

  private enter(index: number): void {
    this.index = index;
    const step = this.steps[index];
    this.calibration.clear(step.id);
    this.done[index] = false;
    this.collected = 0;
    this.sinceOnset = 0;
    this.setPhase(step.id === 'silence' ? 'quiet-wait' : 'listening');
  }

  private next(): void {
    if (this.index + 1 < this.steps.length) this.enter(this.index + 1);
    else this.setPhase('finished');
  }

  private setPhase(p: FlowPhase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  private status(): string {
    switch (this.phase) {
      case 'intro':
        return 'Each sound records only while you make it. Start when you are ready and hold it until the bar fills.';
      case 'quiet-wait':
        return 'Click “I’m quiet” (or press Enter), then stay silent for a moment.';
      case 'quiet':
        return 'Measuring your room…';
      case 'listening':
        if (this.collected > 0) return 'Keep going: start the sound again to fill the bar.';
        if (this.phaseTime > this.options.hintAfterSeconds) return 'Not hearing you yet. Check the level meter crosses the line, or move closer to the mic.';
        return 'Start the sound whenever you are ready.';
      case 'capturing':
        return 'Recording. Keep holding it…';
      case 'got-it':
        return '✓ Got it';
      case 'finished':
        return 'Done.';
    }
  }
}
