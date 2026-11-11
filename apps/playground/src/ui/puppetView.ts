// Page shell and the puppet view shared by every playground: the Tofu avatar or
// the debug puppet, the input mode and puppet controls, the control groups, and the monitor.

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
import { MONITOR_SERIES, monitorSeriesOn, setMonitorSeries, type MonitorSeries } from './monitorTheme';

export interface ShellOptions {
  /** Primary transport buttons (play/stop, start/stop mic). */
  transportHtml: string;
  /** Page-specific panel content, usually built with section(). */
  inputHtml: string;
  voiceHtml: string;
  /** Length controls that sit with the line on a phone and in the control row elsewhere. */
  lengthHtml?: string;
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
  byId('group-2').innerHTML = opts.lengthHtml ?? '';
  byId('group-2').hidden = !opts.lengthHtml;
  byId('group-3').innerHTML = (opts.analysisHtml ?? '') + section('Diagnostics', '<div id="diag">–</div>');
  byId('tab-0').textContent = opts.inputLabel ?? 'Script';
  root.querySelector<HTMLElement>('.transport .buttons')!.innerHTML = opts.transportHtml;
  root.querySelector<HTMLElement>('.meter.level span')!.textContent = opts.levelLabel ?? 'Output';
  byId('warnings').hidden = true;
  byId('warnings').textContent = '';
  showFitChips(false);
  byId<HTMLButtonElement>('tab-0').click();
}

const MODES = [
  { value: 'mumble', label: 'Text to mumble', short: 'Text' },
  { value: 'klattsch', label: 'Phoneme script', short: 'Phonemes' },
  { value: 'live', label: 'Live microphone', short: 'Microphone' },
];

const chip = (key: MonitorSeries, label: string, fit = false) =>
  `<button type="button" class="chip${fit ? ' fit-chip' : ''}" data-series="${key}" aria-pressed="${monitorSeriesOn(key)}"><i style="--chip:${MONITOR_SERIES[key].color}" aria-hidden="true"></i>${label}</button>`;

/** Show or hide the speed, reached and fade chips, which only apply to a fitted line. */
export function showFitChips(show: boolean): void {
  for (const el of document.querySelectorAll<HTMLElement>('.fit-chip, .chip-divider')) el.hidden = !show;
  document.querySelector('.playback-monitor')?.classList.toggle('has-fit', show);
}

/**
 * On a phone the play bar floats over the page with a dark scrim behind it. Fade the scrim
 * with the distance the bar still floats above its resting place, so it follows the scroll
 * and is gone once the bar settles under the last card.
 */
function followScrim(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>('.transport')!;
  const end = root.querySelector<HTMLElement>('.transport-end')!;
  const FADE_PX = 120;
  let queued = false;
  const update = () => {
    queued = false;
    const floating = end.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
    bar.style.setProperty('--scrim', String(Math.min(1, Math.max(0, floating / FADE_PX))));
  };
  const queue = () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  new ResizeObserver(queue).observe(root.querySelector('.layout')!);
  queue();
}

export function renderShell(root: HTMLElement): void {
  // On a phone the tabs show one group at a time; wider layouts show them together.
  const tabs = [
    { label: 'Script', controls: 'group-0 group-2' },
    { label: 'Voice', controls: 'group-1' },
    { label: 'Analysis', controls: 'group-3' },
  ];
  root.innerHTML = `
    <main class="studio" data-tab="0">
      <header class="mast">
        <div class="mast-titles"><span class="brand"><svg class="brand-mark" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="currentColor"/><path d="M7 13v5m5-10v15m6-18v17m5-13v9" fill="none" stroke="#f7ce4f" stroke-width="2.5" stroke-linecap="round"/></svg>wahwah</span><h1>Voice playground</h1></div>
        <div class="mast-actions">
          <fieldset class="segmented input-switch" id="inputMode"><legend class="sr-only">Input mode</legend>
            ${MODES.map(m => `<label><input type="radio" name="inputMode" value="${m.value}" /><span class="long">${m.label}</span><span class="short" aria-hidden="true">${m.short}</span></label>`).join('')}
          </fieldset>
          <button type="button" id="analysisToggle" class="analysis-toggle" aria-pressed="false" aria-controls="group-3">Analysis</button>
        </div>
      </header>
      <div class="layout">
        <section class="stage" aria-labelledby="previewTitle">
          <div id="face" class="face">
            <p id="faceStatus" class="face-status" hidden></p>
            <div class="preview-head">
              <h2 id="previewTitle" class="sr-only">Puppet preview</h2>
              <fieldset class="segmented view-switch" id="view"><legend class="sr-only">View</legend>
                <label><input type="radio" name="view" id="view-tofu" value="tofu" checked /><span>Tofu</span></label>
                <label><input type="radio" name="view" id="view-debug" value="debug" /><span title="Debug (instructions)">Debug</span></label>
              </fieldset>
              <details class="puppet-menu">
                <summary>Puppet</summary>
                <div class="puppet-options">
                  <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
                  <label><input id="idle" type="checkbox" checked /> Idle motion</label>
                </div>
              </details>
              <div id="cameraTools" hidden>
                <button type="button" id="resetView" aria-label="Reset view"><span class="reset-text">Reset<span class="reset-long"> view</span></span></button>
              </div>
            </div>
          </div>
        </section>
        <nav class="group-switch" aria-label="Control groups" role="tablist">${tabs.map((t, i) => `<button type="button" id="tab-${i}" role="tab" aria-controls="${t.controls}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`).join('')}</nav>
        <section class="editor" aria-label="Line">
          <div id="group-0" class="panel" role="tabpanel" aria-labelledby="tab-0" data-tab="0"></div>
          <p id="warnings" class="warnings" hidden></p>
          <div class="transport"><div class="buttons"></div>
            <div class="status"><span>Elapsed <b id="time">–</b></span><span>Sound <b id="sound">–</b></span></div>
          </div>
          <div class="transport-end" aria-hidden="true"></div>
        </section>
        <section class="controls" aria-label="Voice and length">
          <div id="group-1" class="panel" role="tabpanel" aria-labelledby="tab-1" data-tab="1"></div>
          <div id="group-2" class="panel" data-tab="0" hidden></div>
        </section>
        <section id="group-3" class="panel analysis" role="tabpanel" aria-labelledby="tab-2" data-tab="2"></section>
      </div>
      <section class="playback-monitor" aria-label="Playback monitor">
        <div class="monitor-signals"><h2>Playback monitor</h2><div class="meters">
          ${meter('jawOpen', 'Jaw')}${meter('lipWidth', 'Width')}${meter('lipRound', 'Round')}${meter('level', 'Output')}
        </div></div>
        <div class="monitor-plot">
          <div class="monitor-chips" role="group" aria-label="Plotted signals">
            ${chip('jaw', 'Jaw')}${chip('width', 'Width')}${chip('round', 'Round')}${chip('level', 'Level')}<span class="chip-divider" aria-hidden="true" hidden></span>${chip('speed', 'Speed', true)}${chip('reached', 'Reached', true)}${chip('fade', 'Fade', true)}
          </div>
          <canvas id="timeline" class="timeline" aria-label="Playback timeline"></canvas>
        </div>
      </section>
    </main>`;
  const studio = root.querySelector<HTMLElement>('.studio')!;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.group-switch button'));
  for (const [index, button] of buttons.entries()) {
    button.addEventListener('click', () => {
      for (const item of buttons) {
        const selected = item === button;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      }
      studio.dataset.tab = String(index);
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
  followScrim(root);
  const analysis = byId<HTMLButtonElement>('analysisToggle');
  analysis.addEventListener('click', () => {
    const on = analysis.getAttribute('aria-pressed') !== 'true';
    analysis.setAttribute('aria-pressed', String(on));
    studio.classList.toggle('show-analysis', on);
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>('.monitor-chips .chip')) {
    button.addEventListener('click', () => {
      const key = button.dataset.series as MonitorSeries;
      setMonitorSeries(key, !monitorSeriesOn(key));
      button.setAttribute('aria-pressed', String(monitorSeriesOn(key)));
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
    byId('view').addEventListener('change', (e) => void this.setMode((e.target as HTMLInputElement).value as PuppetViewMode));
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
    byId<HTMLInputElement>(`view-${mode}`).checked = true;
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
