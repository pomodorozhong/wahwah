// Guided calibration: a prompt card over the face that walks through the
// calibration steps (get ready, then hold the sound), records frames into a
// Calibration, and hands back the finished VoiceProfile.

import { CALIBRATION_STEPS, Calibration, type CalibrationStep, type FrameFeatures, type VoiceProfile } from '../live/profile';

export const READY_SECONDS = 1.2;

export interface CalibrationCallbacks {
  /** A step's "get ready" phase begins (the demo voice starts speaking here). */
  onStep?: (step: CalibrationStep, index: number) => void;
  onFinish: (profile: VoiceProfile) => void;
  onCancel?: () => void;
}

export class CalibrationRunner {
  private readonly card: HTMLDivElement;
  private calibration = new Calibration();
  private index = -1;
  private phase: 'ready' | 'record' = 'ready';
  private phaseStart = 0;
  private active = false;

  constructor(container: HTMLElement, private readonly callbacks: CalibrationCallbacks, private readonly sampleRate: () => number) {
    this.card = document.createElement('div');
    this.card.className = 'calib-card';
    this.card.hidden = true;
    this.card.innerHTML = `
      <div class="calib-step"></div>
      <div class="calib-prompt"></div>
      <div class="calib-hint"></div>
      <div class="calib-bar"><i></i></div>
      <div class="calib-level"><span>your level</span><i><em></em></i></div>
      <button type="button" class="calib-cancel">Cancel</button>`;
    container.appendChild(this.card);
    this.card.querySelector('.calib-cancel')!.addEventListener('click', () => this.cancel());
  }

  get running(): boolean {
    return this.active;
  }

  get stepId(): string | null {
    return this.active ? CALIBRATION_STEPS[this.index].id : null;
  }

  get phaseName(): string | null {
    return this.active ? this.phase : null;
  }

  start(nowMs: number): void {
    this.calibration = new Calibration();
    this.active = true;
    this.card.hidden = false;
    this.enterStep(0, nowMs);
  }

  cancel(): void {
    if (!this.active) return;
    this.active = false;
    this.card.hidden = true;
    this.callbacks.onCancel?.();
  }

  /** Call every display frame with the current input analysis. */
  frame(nowMs: number, features: FrameFeatures | null): void {
    if (!this.active) return;
    const step = CALIBRATION_STEPS[this.index];
    const t = (nowMs - this.phaseStart) / 1000;
    if (this.phase === 'ready') {
      this.setText('.calib-hint', t < READY_SECONDS ? `Get ready… ${step.hint}` : step.hint);
      this.setBar(t / READY_SECONDS, true);
      if (t >= READY_SECONDS) {
        this.phase = 'record';
        this.phaseStart = nowMs;
      }
    } else {
      if (features) this.calibration.add(step.id, features, t);
      this.setText('.calib-hint', step.hint);
      this.setBar(t / step.seconds, false);
      if (t >= step.seconds) {
        if (this.index + 1 < CALIBRATION_STEPS.length) this.enterStep(this.index + 1, nowMs);
        else this.finish();
      }
    }
    if (features) {
      const level = Math.min(1, Math.max(0, (features.levelDb + 70) / 60));
      (this.card.querySelector('.calib-level em') as HTMLElement).style.width = `${level * 100}%`;
    }
  }

  private enterStep(index: number, nowMs: number): void {
    this.index = index;
    this.phase = 'ready';
    this.phaseStart = nowMs;
    const step = CALIBRATION_STEPS[index];
    this.setText('.calib-step', `Step ${index + 1} of ${CALIBRATION_STEPS.length}`);
    this.setText('.calib-prompt', step.id === 'silence' ? step.prompt : `Say ${step.prompt}`);
    this.callbacks.onStep?.(step, index);
  }

  private finish(): void {
    this.active = false;
    this.card.hidden = true;
    this.callbacks.onFinish(this.calibration.build(this.sampleRate()));
  }

  private setText(sel: string, text: string): void {
    const el = this.card.querySelector(sel) as HTMLElement;
    if (el.textContent !== text) el.textContent = text;
  }

  private setBar(fraction: number, waiting: boolean): void {
    const bar = this.card.querySelector('.calib-bar i') as HTMLElement;
    bar.style.width = `${Math.min(1, fraction) * 100}%`;
    bar.classList.toggle('waiting', waiting);
  }
}
