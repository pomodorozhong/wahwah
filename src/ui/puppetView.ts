// Page shell and the puppet view shared by every playground: the 3D face or
// the debug puppet, the input mode and puppet controls, and the live meters.

import './style.css';
import './writing-spread.css';
import './settings.css';
import './script-editor.css';
import type { FaceControls } from '../puppet/controls';
import { MotionTracker, type FaceMotion } from '../puppet/motion';
import localModels from 'virtual:local-models';
import { PreviewFace } from '../host/face';
import { ControlFollower } from '../host/follower';
import { DebugPuppet } from '../host/debug';
import { FaceRenderer } from '../host/renderer';
import type { FaceHost } from '../host/host';
import type { VrmFace } from '../host/vrm';
import type { Live2DFace } from '../host/live2d';

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
            <label>View <select id="view"><option value="face">Preview face</option><option value="vrm">VRM model</option><option value="live2d">Live2D model</option><option value="debug">Debug (instructions)</option></select></label>
            <label id="modelLabel" hidden>Model <select id="model"></select></label>
            <input id="vrmFile" type="file" accept=".vrm" hidden />
            <input id="live2dFolder" type="file" webkitdirectory hidden />
            <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
            <label><input id="idle" type="checkbox" checked /> Idle motion</label>
          </div>`) },
    { label: 'Analysis', body: '' },
  ];
  root.innerHTML = `
    <main class="studio">
      <header class="mast">
        <div class="mast-titles"><span class="brand"><svg class="brand-mark" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="currentColor"/><path d="M7 13v5m5-10v15m6-18v17m5-13v9" fill="none" stroke="#f7ce4f" stroke-width="2.5" stroke-linecap="round"/></svg>wahwah</span><h1>Voice studio</h1></div>
        <label class="input-switch" for="inputMode">Input mode
          <select id="inputMode">
            <option value="babble">Text to babble</option>
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
          <div class="preview-head"><h2>Puppet preview</h2><div id="cameraTools" hidden>
            <span class="camera-hint">Drag to rotate · Shift-drag to pan · Scroll to zoom</span>
            <span class="touch-hint">Drag to rotate · Two fingers to pan or pinch</span>
            <button type="button" id="resetView">Reset view</button>
          </div></div>
          <div id="face" class="face"><p id="faceStatus" class="face-status" hidden></p></div>
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

export type PuppetViewMode = 'face' | 'vrm' | 'live2d' | 'debug';
type ModelMode = 'vrm' | 'live2d';

const MODELS_URL = `${import.meta.env.BASE_URL}models/`;
const OPEN_FILE = '__open__';

export class PuppetView {
  readonly renderer: FaceRenderer;
  readonly face = new PreviewFace();
  readonly follower = new ControlFollower();
  readonly debugPuppet: DebugPuppet;
  readonly motion = new MotionTracker();
  readonly puppetEl: HTMLInputElement;
  private mode: PuppetViewMode = 'face';
  private host: FaceHost = this.face;
  private vrm: VrmFace | null = null;
  private live2d: Live2DFace | null = null;
  private idle = true;
  private readonly modelEl: HTMLSelectElement;
  private readonly statusEl: HTMLElement;
  /** The model picked for each host, kept while switching views. */
  private readonly picked: Record<ModelMode, string> = { vrm: localModels.vrm[0] ?? '', live2d: localModels.live2d[0] ?? '' };
  private readonly loading = new Set<ModelMode>();

  constructor() {
    const container = byId('face');
    this.renderer = new FaceRenderer(container);
    byId('resetView').addEventListener('click', () => this.host.navigation?.reset());
    this.debugPuppet = new DebugPuppet(container);
    this.puppetEl = byId('puppet');
    this.modelEl = byId('model');
    this.statusEl = byId('faceStatus');
    byId<HTMLSelectElement>('view').addEventListener('change', (e) => void this.setMode((e.target as HTMLSelectElement).value as PuppetViewMode));
    byId<HTMLInputElement>('idle').addEventListener('change', (e) => {
      this.idle = (e.target as HTMLInputElement).checked;
      this.host.idleMotion = this.idle;
    });
    this.modelEl.addEventListener('change', () => this.onModelPicked());
    byId<HTMLInputElement>('vrmFile').addEventListener('change', (e) => this.openVrmFile(e.target as HTMLInputElement));
    byId<HTMLInputElement>('live2dFolder').addEventListener('change', (e) => this.openLive2DFolder(e.target as HTMLInputElement));
    void this.setMode('face');
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
    byId('modelLabel').hidden = mode !== 'vrm' && mode !== 'live2d';
    if (mode === 'vrm' || mode === 'live2d') {
      this.fillModelList(mode);
      const host = mode === 'vrm' ? await this.vrmHost() : await this.live2dHost();
      if (this.mode !== mode) return;
      this.useHost(host);
      const picked = this.picked[mode];
      if (host.status && picked && !picked.startsWith('blob:') && !this.loading.has(mode)) this.loadLocal(mode, picked);
    } else this.useHost(this.face);
  }

  private useHost(host: FaceHost): void {
    this.host = host;
    host.idleMotion = this.idle;
    const interactive = this.mode !== 'debug' && !!host.navigation;
    byId('cameraTools').hidden = !interactive;
    this.renderer.setHost(host, interactive);
  }

  private async vrmHost(): Promise<VrmFace> {
    if (!this.vrm) {
      const { VrmFace } = await import('../host/vrm');
      this.vrm ??= new VrmFace();
    }
    return this.vrm;
  }

  private async live2dHost(): Promise<Live2DFace> {
    if (!this.live2d) {
      const { Live2DFace } = await import('../host/live2d');
      this.live2d ??= new Live2DFace();
    }
    return this.live2d;
  }

  private fillModelList(mode: ModelMode): void {
    const files = mode === 'vrm' ? localModels.vrm : localModels.live2d;
    const name = (f: string) => f.split('/').pop()!.replace(/\.(vrm|model3\.json)$/, '');
    const open = mode === 'vrm' ? 'Open .vrm file…' : 'Open model folder…';
    this.modelEl.innerHTML =
      files.map((f) => `<option value="${f}">${name(f)}</option>`).join('') + `<option value="${OPEN_FILE}">${open}</option>`;
    const picked = this.picked[mode];
    this.modelEl.value = picked && (files.includes(picked) || picked.startsWith('blob:')) ? picked : files[0] ?? OPEN_FILE;
    if (picked.startsWith('blob:')) {
      this.modelEl.insertAdjacentHTML('afterbegin', `<option value="${picked}">opened file</option>`);
      this.modelEl.value = picked;
    }
  }

  private onModelPicked(): void {
    const mode = this.mode;
    if (mode !== 'vrm' && mode !== 'live2d') return;
    const value = this.modelEl.value;
    if (value === OPEN_FILE) {
      this.modelEl.value = this.picked[mode] || OPEN_FILE;
      byId(mode === 'vrm' ? 'vrmFile' : 'live2dFolder').click();
      return;
    }
    if (value.startsWith('blob:')) return;
    this.picked[mode] = value;
    this.loadLocal(mode, value);
  }

  private loadLocal(mode: ModelMode, file: string): void {
    const label = file.split('/').pop()!;
    const url = MODELS_URL + file;
    this.loading.add(mode);
    const done = () => this.loading.delete(mode);
    if (mode === 'vrm') void this.vrmHost().then((h) => h.load(url, label)).finally(done);
    else {
      const dir = url.slice(0, url.lastIndexOf('/') + 1);
      const core = localModels.cubismCore ? MODELS_URL + localModels.cubismCore : `${MODELS_URL}live2d/live2dcubismcore.min.js`;
      void this.live2dHost().then((h) => h.load(core, url, (p) => dir + p, label)).finally(done);
    }
  }

  private openVrmFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const url = this.blobUrl(file);
    this.picked.vrm = url;
    this.fillModelList('vrm');
    void this.vrmHost().then((h) => h.load(url, file.name));
  }

  /** A picked Live2D folder: its files become blob URLs keyed by relative path. */
  private openLive2DFolder(input: HTMLInputElement): void {
    const files = [...(input.files ?? [])];
    input.value = '';
    const settings = files.find((f) => f.name.endsWith('.model3.json'));
    if (!settings) {
      void this.live2dHost().then((h) => (h.status = 'That folder has no .model3.json file.'));
      return;
    }
    const path = (f: File) => f.webkitRelativePath || f.name;
    const base = path(settings).slice(0, path(settings).lastIndexOf('/') + 1);
    const byPath = new Map(files.map((f) => [path(f), f]));
    const coreFile = files.find((f) => /live2dcubismcore(\.min)?\.js$/.test(f.name));
    const core = coreFile
      ? this.blobUrl(coreFile)
      : localModels.cubismCore
        ? MODELS_URL + localModels.cubismCore
        : `${MODELS_URL}live2d/live2dcubismcore.min.js`;
    const resolve = (p: string) => {
      const f = byPath.get(normalizePath(base + p));
      return f ? this.blobUrl(f) : `missing:${p}`;
    };
    const url = this.blobUrl(settings);
    this.picked.live2d = url;
    this.fillModelList('live2d');
    void this.live2dHost().then((h) => h.load(core, url, resolve, settings.name));
  }

  private blobUrl(file: File): string {
    return URL.createObjectURL(file);
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
      this.host.setControls(this.follower.controls);
      this.renderer.render(dtSeconds);
      this.showStatus(this.host.status);
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
    this.host.setControls(c);
    this.renderer.render(0);
    return this.renderer.canvas;
  }
}

/** Collapse "a/./b" and "a/x/../b" in paths from model3.json. */
function normalizePath(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
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
