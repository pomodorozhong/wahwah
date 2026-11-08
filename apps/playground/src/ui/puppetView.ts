// Page shell and the puppet view shared by every playground: the Tofu avatar or
// the debug puppet, the input mode and puppet controls, and the live meters.

import './style.css';
import './writing-spread.css';
import './settings.css';
import './script-editor.css';
import { type FaceControls } from 'wahwah/performance';
import { MotionTracker, type FaceMotion } from '../puppet/motion';
import { ControlFollower } from '../host/follower';
import { DebugPuppet } from '../host/debug';
import { FaceRenderer } from '../host/renderer';
import type { FaceHost } from '../host/host';
import type { VrmFace } from '../host/vrm';

export interface ShellOptions {
  /** Primary transport buttons (play/stop, start/stop mic). */
  transportHtml: string;
  /** Page-specific panel content, usually built with section(). */
  inputHtml: string;
  voiceHtml: string;
  inputLabel?: string;
  analysisHtml?: string;
  /** Label for the fourth meter. */
  levelLabel?: string;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function section(title: string, body: string): string {
  return `<section class="section"><h3>${title}</h3><div class="section-body">${body}</div></section>`;
}

export function disclosure(title: string, body: string): string {
  return `<details class="section"><summary>${title}</summary><div class="section-body">${body}</div></details>`;
}

const meter = (id: string, label: string) =>
  `<div class="meter ${id}"><span>${label}</span><b id="${id}Val">0.00</b><i><em id="${id}Bar"></em></i></div>`;

/** Update the editor, transport and analysis for a new input while retaining the stage and rig. */
export function renderMode(root: HTMLElement, opts: ShellOptions): void {
  byId('group-0').innerHTML = opts.inputHtml + '<div id="calibrationTools"></div>';
  byId('group-1').innerHTML = opts.voiceHtml;
  byId('group-3').innerHTML = (opts.analysisHtml ?? '') + section('Diagnostics', '<div id="diag">–</div>');
  byId('tab-0').textContent = opts.inputLabel ?? 'Script';
  root.querySelector<HTMLElement>('.transport .buttons')!.innerHTML = opts.transportHtml;
  root.querySelector<HTMLElement>('.meter.level span')!.textContent = opts.levelLabel ?? 'Output';
  byId('warnings').hidden = true;
  byId('warnings').textContent = '';
  byId<HTMLButtonElement>('tab-0').click();
}

export function renderShell(root: HTMLElement): void {
  const groups = [
    { label: 'Script', body: '' },
    { label: 'Voice', body: '' },
    { label: 'Puppet', body: section('Appearance and motion', `<div class="view-opts">
            <label>View <select id="view"><option value="tofu">Tofu cube</option><option value="debug">Debug (instructions)</option></select></label>
            <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
            <label><input id="idle" type="checkbox" checked /> Idle motion</label>
          </div>`) },
    { label: 'Analysis', body: '' },
  ];
  root.innerHTML = `
    <main class="studio">
      <header class="mast">
        <div class="mast-titles"><span class="brand"><svg class="brand-mark" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="currentColor"/><path d="M7 13v5m5-10v15m6-18v17m5-13v9" fill="none" stroke="#f7ce4f" stroke-width="2.5" stroke-linecap="round"/></svg>wahwah</span><h1>Voice playground</h1></div>
        <label class="input-switch" for="inputMode">Input mode
          <select id="inputMode">
            <option value="mumble">Text to mumble</option>
            <option value="klattsch">Phoneme script</option>
            <option value="live">Live microphone</option>
          </select>
        </label>
      </header>
      <div class="layout">
        <section class="workspace" aria-label="Playground controls">
          <nav class="group-switch" aria-label="Control groups" role="tablist">${groups.map((g,i) => `<button type="button" id="tab-${i}" role="tab" aria-controls="group-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${g.label}</button>`).join('')}</nav>
          <div class="panel">${groups.map((g,i) => `<section id="group-${i}" role="tabpanel" aria-labelledby="tab-${i}" ${i ? 'hidden' : ''}>${g.body}</section>`).join('')}</div>
          <p id="warnings" class="warnings" hidden></p>
        </section>
        <div class="transport"><div class="buttons"></div>
          <div class="status"><span>Elapsed <b id="time">–</b></span><span>Sound <b id="sound">–</b></span></div>
        </div>
        <section class="stage" aria-label="Puppet preview">
          <div id="face" class="face">
            <p id="faceStatus" class="face-status" hidden></p>
            <div class="preview-head">
              <h2><span class="preview-full">Puppet preview</span><span class="preview-short">Preview</span></h2>
              <div id="cameraTools" hidden>
                <span class="camera-hint">Drag to rotate · Shift-drag to pan · Scroll to zoom</span>
                <span class="touch-hint">Drag to rotate · Two fingers to pan or pinch</span>
                <button type="button" id="resetView">Reset view</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <section class="playback-monitor" aria-label="Playback monitor">
        <div class="monitor-signals"><h2>Playback monitor</h2><div class="meters">
          ${meter('jawOpen', 'Jaw')}${meter('lipWidth', 'Width')}${meter('lipRound', 'Round')}${meter('level', 'Output')}
        </div></div>
        <canvas id="timeline" class="timeline" aria-label="Playback timeline"></canvas>
      </section>
    </main>`;
  const panel = root.querySelector<HTMLElement>('.panel')!;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.group-switch button'));
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const item of buttons) {
        const selected = item === button;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        byId(item.getAttribute('aria-controls')!).hidden = !selected;
      }
      panel.scrollTop = 0;
    });
    button.addEventListener('keydown', event => {
      const at = buttons.indexOf(button);
      const to = {
        ArrowRight: (at + 1) % buttons.length,
        ArrowLeft: (at + buttons.length - 1) % buttons.length,
        Home: 0,
        End: buttons.length - 1,
      }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      buttons[to].focus();
      buttons[to].click();
    });
  }
}

export type PuppetViewMode = 'tofu' | 'debug';

export class PuppetView {
  readonly renderer: FaceRenderer;
  readonly follower = new ControlFollower();
  readonly debugPuppet: DebugPuppet;
  readonly motion = new MotionTracker();
  readonly puppetEl: HTMLInputElement;
  private mode: PuppetViewMode = 'tofu';
  private host: FaceHost | null = null;
  private tofu: Promise<VrmFace> | null = null;
  private idle = true;
  private readonly statusEl: HTMLElement;

  constructor() {
    const container = byId('face');
    this.renderer = new FaceRenderer(container);
    byId('resetView').addEventListener('click', () => this.host?.navigation?.reset());
    this.debugPuppet = new DebugPuppet(container);
    this.puppetEl = byId('puppet');
    this.statusEl = byId('faceStatus');
    byId<HTMLSelectElement>('view').addEventListener('change', (e) => void this.setMode((e.target as HTMLSelectElement).value as PuppetViewMode));
    byId<HTMLInputElement>('idle').addEventListener('change', (e) => {
      this.idle = (e.target as HTMLInputElement).checked;
      if (this.host) this.host.idleMotion = this.idle;
    });
    void this.setMode('tofu');
  }

  get puppetEnabled(): boolean {
    return this.puppetEl.checked;
  }

  get view(): PuppetViewMode {
    return this.mode;
  }

  async setMode(mode: PuppetViewMode): Promise<void> {
    this.mode = mode;
    byId<HTMLSelectElement>('view').value = mode;
    this.renderer.canvas.hidden = mode === 'debug';
    this.debugPuppet.visible = mode === 'debug';
    this.host = null;
    this.renderer.setHost(null, false);
    byId('cameraTools').hidden = true;
    this.showStatus(mode === 'debug' ? '' : 'Loading…');
    if (mode === 'tofu') {
      const host = await this.tofuHost();
      if (this.mode === mode) this.useHost(host);
    }
  }

  private useHost(host: FaceHost): void {
    this.host = host;
    host.idleMotion = this.idle;
    const interactive = this.mode !== 'debug' && !!host.navigation;
    byId('cameraTools').hidden = !interactive;
    this.renderer.setHost(host, interactive);
  }

  private tofuHost(): Promise<VrmFace> {
    this.tofu ??= import('../host/vrm').then(async ({ VrmFace }) => {
      const host = new VrmFace();
      await host.load(`${import.meta.env.BASE_URL}tofu/corner-cut.vrm`, 'Tofu cube');
      return host;
    });
    return this.tofu;
  }

  private showStatus(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.hidden = !text;
  }

  /**
   * Advance one frame. Pass controls to follow them exactly, or null to let
   * the face keep easing (e.g. back to neutral after stop).
   */
  update(dtSeconds: number, controls: FaceControls | null): FaceMotion {
    if (controls) this.follower.follow(controls);
    this.follower.tick(dtSeconds);
    const motion = this.motion.update(this.follower.controls, dtSeconds);
    if (this.mode === 'debug') {
      this.showStatus('');
      this.debugPuppet.render(motion, this.puppetEnabled);
    } else {
      this.host?.setControls(this.follower.controls);
      this.renderer.render(dtSeconds);
      if (this.host) this.showStatus(this.host.status);
    }
    return motion;
  }

  showReadout(time: number | null, sound: string | null, level: number): void {
    byId('time').textContent = time === null ? '–' : `${Math.max(0, time).toFixed(2)} s`;
    byId('sound').textContent = sound ?? (time === null ? '–' : 'pause');
    const c = this.follower.controls;
    for (const k of ['jawOpen', 'lipWidth', 'lipRound'] as const) {
      byId(`${k}Bar`).style.width = `${c[k] * 100}%`;
      byId(`${k}Val`).textContent = c[k].toFixed(2);
    }
    byId('levelBar').style.width = `${Math.min(1, level * 2) * 100}%`;
    byId('levelVal').textContent = level.toFixed(2);
  }

  /** Stop following anything and hold a pose, e.g. for screenshots. */
  holdPose(c: FaceControls): HTMLCanvasElement {
    this.follower.follow(c);
    this.host?.setControls(c);
    this.renderer.render(0);
    return this.renderer.canvas;
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
