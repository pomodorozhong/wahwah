// Guided calibration card over the face, driven by the self-paced
// CalibrationFlow: an intro, then one prompt per sound that records only while
// the speaker makes it, with Back / Redo / Skip and a level meter that shows
// the line to cross.

import { CalibrationFlow, type FlowPhase } from '../live/calibrationFlow';
import { CALIBRATION_STEPS, type CalibrationStep, type FrameFeatures, type VoiceProfile } from '../live/profile';

export interface CalibrationCallbacks {
  /** A step starts listening (again); the demo voice speaks here. */
  onStep?: (step: CalibrationStep, index: number) => void;
  onFinish: (profile: VoiceProfile) => void;
  onCancel?: () => void;
}

const dbToMeter = (db: number) => Math.min(1, Math.max(0, (db + 80) / 70));

export class CalibrationRunner {
  private readonly card: HTMLDivElement;
  private flow: CalibrationFlow | null = null;
  private lastFrameMs = 0;
  private lastStepKey = '';

  constructor(container: HTMLElement, private readonly callbacks: CalibrationCallbacks, private readonly sampleRate: () => number) {
    this.card = document.createElement('div');
    this.card.className = 'calib-card';
    this.card.hidden = true;
    this.card.innerHTML = `
      <div class="calib-step"></div>
      <div class="calib-prompt"></div>
      <div class="calib-hint"></div>
      <div class="calib-dots"></div>
      <div class="calib-bar"><i></i></div>
      <div class="calib-level"><span>your level</span><i><em></em><b class="calib-trigger" title="start the sound above this line"></b></i></div>
      <div class="calib-status" aria-live="polite"></div>
      <div class="calib-actions">
        <button type="button" data-act="begin" class="primary">Begin</button>
        <button type="button" data-act="quiet" class="primary">I’m quiet</button>
        <button type="button" data-act="back">← Back</button>
        <button type="button" data-act="redo">Redo</button>
        <button type="button" data-act="skip">Skip</button>
        <button type="button" data-act="cancel">Cancel</button>
      </div>`;
    container.appendChild(this.card);
    this.card.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.act;
      if (act) this.act(act);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.flow) return;
      const phase = this.flow.view().phase;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.act(phase === 'intro' ? 'begin' : phase === 'quiet-wait' ? 'quiet' : 'none');
      } else if (e.key === 'Escape') this.act('cancel');
      else if (e.key.toLowerCase() === 'r' && !(e.target instanceof HTMLInputElement)) this.act('redo');
    });
  }

  get running(): boolean {
    return this.flow !== null;
  }

  get stepId(): string | null {
    const v = this.flow?.view();
    return v?.step?.id ?? null;
  }

  get phaseName(): FlowPhase | null {
    return this.flow?.view().phase ?? null;
  }

  start(nowMs: number): void {
    this.flow = new CalibrationFlow(this.sampleRate());
    this.lastFrameMs = NaN; // the first frame defines the clock (it may be audio time)
    void nowMs;
    this.lastStepKey = '';
    this.card.hidden = false;
    this.render();
  }

  /** For the demo voice: answer the quiet step automatically. */
  confirmQuiet(): void {
    this.flow?.confirmQuiet();
    this.render();
  }

  cancel(): void {
    if (!this.flow) return;
    this.flow = null;
    this.card.hidden = true;
    this.callbacks.onCancel?.();
  }

  /** Call every analysis frame with the current input features. */
  frame(nowMs: number, features: FrameFeatures | null): void {
    if (!this.flow) return;
    const dt = Number.isNaN(this.lastFrameMs) ? 0 : Math.min(0.1, Math.max(0, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;
    if (features && this.flow.frame(features, dt)) {
      const profile = this.flow.profile!;
      this.flow = null;
      this.card.hidden = true;
      this.callbacks.onFinish(profile);
      return;
    }
    this.render();
  }

  private act(action: string): void {
    const flow = this.flow;
    if (!flow) return;
    if (action === 'begin') flow.begin();
    else if (action === 'quiet') flow.confirmQuiet();
    else if (action === 'back') flow.back();
    else if (action === 'redo') flow.redo();
    else if (action === 'skip') flow.skip();
    else if (action === 'cancel') return this.cancel();
    else return;
    this.lastStepKey = ''; // re-announce the step (the demo voice speaks again)
    this.render();
  }

  private render(): void {
    const flow = this.flow;
    if (!flow) return;
    const v = flow.view();
    const step = v.step;
    // Announce a newly entered step once.
    const key = `${v.stepIndex}:${v.phase === 'listening' || v.phase === 'quiet-wait' ? 'start' : 'run'}`;
    if (step && key !== this.lastStepKey && (v.phase === 'listening' || v.phase === 'quiet-wait')) {
      this.lastStepKey = key;
      this.callbacks.onStep?.(step, v.stepIndex);
    }
    this.setText('.calib-step', v.phase === 'intro' ? 'Voice calibration' : `Sound ${v.stepIndex + 1} of ${CALIBRATION_STEPS.length}`);
    this.setText(
      '.calib-prompt',
      v.phase === 'intro' ? 'Teach the face your voice' : step ? (step.id === 'silence' ? step.prompt : `Say ${step.prompt}`) : '',
    );
    this.setText(
      '.calib-hint',
      v.phase === 'intro'
        ? '9 short sounds, about a minute at your own pace. Press Begin (or Enter).'
        : step?.hint ?? '',
    );
    this.setText('.calib-status', v.status);
    const dots = this.card.querySelector('.calib-dots') as HTMLElement;
    const dotsHtml = CALIBRATION_STEPS.map((s, i) => `<span class="${v.done[i] ? 'done' : ''}${i === v.stepIndex && v.phase !== 'intro' ? ' now' : ''}" title="${s.prompt}"></span>`).join('');
    if (dots.innerHTML !== dotsHtml) dots.innerHTML = dotsHtml;
    const bar = this.card.querySelector('.calib-bar i') as HTMLElement;
    bar.style.width = `${v.progress * 100}%`;
    bar.classList.toggle('waiting', v.phase === 'listening');
    bar.classList.toggle('ok', v.phase === 'got-it');
    (this.card.querySelector('.calib-level em') as HTMLElement).style.width = `${dbToMeter(v.levelDb) * 100}%`;
    const trig = this.card.querySelector('.calib-trigger') as HTMLElement;
    trig.style.left = `${dbToMeter(v.triggerDb) * 100}%`;
    trig.hidden = !(v.phase === 'listening' || v.phase === 'capturing');
    const show = (act: string, on: boolean) => ((this.card.querySelector(`[data-act="${act}"]`) as HTMLElement).hidden = !on);
    const inStep = v.phase !== 'intro';
    show('begin', v.phase === 'intro');
    show('quiet', v.phase === 'quiet-wait');
    show('back', inStep && v.stepIndex > 0);
    show('redo', inStep);
    show('skip', inStep);
  }

  private setText(sel: string, text: string): void {
    const el = this.card.querySelector(sel) as HTMLElement;
    if (el.textContent !== text) el.textContent = text;
  }
}
