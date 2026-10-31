// Page shell and the puppet view shared by every playground: the 3D face or
// the debug puppet, the transport bar's puppet options, and the live meters.

import './style.css';
import type { FaceControls } from '../puppet/controls';
import { MotionTracker, type FaceMotion } from '../puppet/motion';
import { PreviewFace } from '../host/face';
import { FaceHostAdapter } from '../host/adapter';
import { DebugPuppet } from '../host/debug';

export interface ShellOptions {
  title: string;
  /** Primary transport buttons (play/stop, start/stop mic). */
  transportHtml: string;
  /** Page-specific panel content, usually built with section(). */
  panelHtml: string;
  /** Label for the fourth meter. */
  levelLabel?: string;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** A collapsible panel section. */
export function section(title: string, body: string, open = true): string {
  return `<details class="section"${open ? ' open' : ''}><summary>${title}</summary><div class="section-body">${body}</div></details>`;
}

const meter = (id: string, label: string) =>
  `<div class="meter ${id}"><span>${label}</span><b id="${id}Val">0.00</b><i><em id="${id}Bar"></em></i></div>`;

export function renderShell(root: HTMLElement, opts: ShellOptions): void {
  root.innerHTML = `
    <main class="layout">
      <section class="stage">
        <div id="face" class="face"></div>
        <div class="transport">
          <div class="buttons">${opts.transportHtml}</div>
          <div class="status"><span>time</span><b id="time">–</b><span>sound</span><b id="sound">–</b></div>
          <div class="view-opts">
            <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
            <label>View <select id="view"><option value="face">Face</option><option value="debug">Debug (instructions)</option></select></label>
            <label><input id="idle" type="checkbox" checked /> Idle motion</label>
          </div>
        </div>
        <div class="meters">
          ${meter('jawOpen', 'jawOpen')}${meter('lipWidth', 'lipWidth')}${meter('lipRound', 'lipRound')}${meter('level', opts.levelLabel ?? 'output RMS')}
        </div>
        <canvas id="timeline" class="timeline"></canvas>
      </section>
      <aside class="panel">
        <header><h1>${opts.title}</h1><nav class="nav"><a href="../">All playgrounds</a></nav></header>
        ${opts.panelHtml}
        <p id="warnings" class="warnings" hidden></p>
        ${section('Diagnostics', '<div id="diag">–</div>', false)}
      </aside>
    </main>
  `;
}

export type PuppetViewMode = 'face' | 'debug';

export class PuppetView {
  readonly face: PreviewFace;
  readonly host: FaceHostAdapter;
  readonly debugPuppet: DebugPuppet;
  readonly motion = new MotionTracker();
  readonly puppetEl: HTMLInputElement;
  private mode: PuppetViewMode = 'face';

  constructor() {
    const container = byId('face');
    this.face = new PreviewFace(container);
    this.host = new FaceHostAdapter(this.face);
    this.debugPuppet = new DebugPuppet(container);
    this.puppetEl = byId('puppet');
    byId<HTMLSelectElement>('view').addEventListener('change', (e) => this.setMode((e.target as HTMLSelectElement).value as PuppetViewMode));
    byId<HTMLInputElement>('idle').addEventListener('change', (e) => {
      this.face.idleMotion = (e.target as HTMLInputElement).checked;
    });
    this.setMode('face');
  }

  get puppetEnabled(): boolean {
    return this.puppetEl.checked;
  }

  get view(): PuppetViewMode {
    return this.mode;
  }

  setMode(mode: PuppetViewMode): void {
    this.mode = mode;
    byId<HTMLSelectElement>('view').value = mode;
    this.face.renderer.domElement.hidden = mode !== 'face';
    this.debugPuppet.visible = mode === 'debug';
  }

  /**
   * Advance one frame. Pass controls to follow them exactly, or null to let
   * the face keep easing (e.g. back to neutral after stop).
   */
  update(dtSeconds: number, controls: FaceControls | null): FaceMotion {
    if (controls) this.host.follow(controls);
    this.host.tick(dtSeconds);
    const motion = this.motion.update(this.host.controls, dtSeconds);
    if (this.mode === 'face') this.face.render(dtSeconds);
    else this.debugPuppet.render(motion, this.puppetEnabled);
    return motion;
  }

  showReadout(time: number | null, sound: string | null, level: number): void {
    byId('time').textContent = time === null ? '–' : `${Math.max(0, time).toFixed(2)} s`;
    byId('sound').textContent = sound ?? (time === null ? '–' : 'pause');
    const c = this.host.controls;
    for (const k of ['jawOpen', 'lipWidth', 'lipRound'] as const) {
      byId(`${k}Bar`).style.width = `${c[k] * 100}%`;
      byId(`${k}Val`).textContent = c[k].toFixed(2);
    }
    byId('levelBar').style.width = `${Math.min(1, level * 2) * 100}%`;
    byId('levelVal').textContent = level.toFixed(2);
  }

  /** Stop following anything and hold a pose, e.g. for screenshots. */
  holdPose(c: FaceControls): HTMLCanvasElement {
    this.host.follow(c);
    this.face.render(0);
    return this.face.renderer.domElement;
  }
}

/** Match the canvas backing store to its CSS size; returns a 2D context in CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
