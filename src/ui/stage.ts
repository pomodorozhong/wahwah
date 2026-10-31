// Shared playground stage: face, timeline, readouts, playback and diagnostics.
// Each playground page supplies its own input panel and a compile() callback.

import './style.css';
import { renderPerformance, segmentAt, type PerformanceSegment, type SpeechPerformance } from '../voice/performance';
import { generateFaceTrack, sampleFaceTrack } from '../puppet/generate';
import type { FaceControlTrack, FaceControls } from '../puppet/controls';
import { rmsEnvelope, syncReport, type SyncReport } from '../analysis';
import { PreviewFace } from '../host/face';
import { FaceHostAdapter } from '../host/adapter';
import { Player } from '../playback';

export interface Prepared {
  performance: SpeechPerformance;
  audio: Float32Array<ArrayBuffer>;
  sampleRate: number;
  envelope: number[];
  track: FaceControlTrack | null;
  report: SyncReport | null;
}

export interface StageOptions {
  title: string;
  /** Page-specific inputs, placed above the shared controls. */
  inputsHtml: string;
  /** Build the utterance from the page's current inputs. */
  compile: () => SpeechPerformance;
  /** Called every frame with the playback time and active segment. */
  onFrame?: (time: number | null, segment: PerformanceSegment | null) => void;
  /** Extra fields for the window.__mumble debug hook. */
  debugState?: () => Record<string, unknown>;
}

const NAV = `<nav class="nav"><a href="../">Playgrounds</a></nav>`;

export class Stage {
  readonly face: PreviewFace;
  readonly host: FaceHostAdapter;
  private player: Player | null = null;
  private prepared: Prepared | null = null;
  private generatorRuns = 0;
  private playCount = 0;
  private readonly puppetEl: HTMLInputElement;
  private readonly timeline: HTMLCanvasElement;
  private last = performance.now();

  constructor(root: HTMLElement, private readonly opts: StageOptions) {
    root.innerHTML = `
      <main class="layout">
        <section class="stage">
          <div id="face" class="face"></div>
          <canvas id="timeline" class="timeline" height="120"></canvas>
        </section>
        <aside class="panel">
          ${NAV}
          <h1>${opts.title}</h1>
          ${opts.inputsHtml}
          <p id="warnings" class="warnings" hidden></p>
          <div class="toggles">
            <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
            <label><input id="idle" type="checkbox" checked /> Idle blink &amp; sway</label>
          </div>
          <div class="buttons">
            <button id="play" class="primary">Play</button>
            <button id="stop">Stop</button>
          </div>
          <p class="hint">Space plays or replays from the start. Esc stops. Editing anything stops playback.</p>
          <div class="readout">
            <div class="row"><span>Time</span><b id="time">–</b></div>
            <div class="row"><span>Active sound</span><b id="sound">–</b></div>
            ${['jawOpen', 'lipWidth', 'lipRound']
              .map((k) => `<div class="row meter"><span>${k}</span><i><em id="${k}Bar"></em></i><b id="${k}Val">0.00</b></div>`)
              .join('')}
            <div class="row meter"><span>output RMS</span><i><em id="rmsBar" class="rms"></em></i><b id="rmsVal">0.00</b></div>
          </div>
          <details class="diag" open>
            <summary>Sync diagnostics (offline render of this utterance)</summary>
            <div id="diag">–</div>
          </details>
        </aside>
      </main>
    `;
    this.puppetEl = byId('puppet');
    this.timeline = byId('timeline');
    this.face = new PreviewFace(byId('face'));
    this.host = new FaceHostAdapter(this.face);

    this.puppetEl.addEventListener('change', () => this.invalidate());
    byId<HTMLInputElement>('idle').addEventListener('change', (e) => {
      this.face.idleMotion = (e.target as HTMLInputElement).checked;
    });
    byId('play').addEventListener('click', () => void this.play());
    byId('stop').addEventListener('click', () => this.stop());
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === 'text')) return;
      if (e.code === 'Space') { e.preventDefault(); void this.play(); }
      if (e.code === 'Escape') this.stop();
    });

    Object.assign(window, { __mumble: this.debugHook() });
    requestAnimationFrame((now) => this.frame(now));
  }

  /** Inputs changed: stop, relax the face, and rebuild. */
  invalidate(): void {
    this.player?.stop();
    this.host.relax();
    this.prepared = null;
    this.prepare();
  }

  get current(): Prepared | null {
    return this.prepared;
  }

  prepare(): Prepared {
    if (this.prepared) return this.prepared;
    const sampleRate = this.player?.sampleRate ?? 48000;
    const performance = this.opts.compile();
    const audio = renderPerformance(performance, sampleRate) as Float32Array<ArrayBuffer>;
    // Puppet disabled means the instruction generator does not run at all.
    let track: FaceControlTrack | null = null;
    if (this.puppetEl.checked) {
      track = generateFaceTrack(performance);
      this.generatorRuns++;
    }
    const p: Prepared = {
      performance,
      audio,
      sampleRate,
      envelope: rmsEnvelope(audio, sampleRate),
      track,
      report: track ? syncReport(audio, sampleRate, track) : null,
    };
    this.prepared = p;
    const warn = byId('warnings');
    warn.hidden = performance.warnings.length === 0;
    warn.textContent = performance.warnings.join('; ');
    this.renderDiagnostics(p);
    return p;
  }

  async play(): Promise<void> {
    if (!this.player) {
      this.player = new Player();
      this.player.onEnded = () => this.host.relax();
      this.prepared = null; // re-render at the device's sample rate
    }
    const p = this.prepare();
    await this.player.play(p.audio);
    this.playCount++;
  }

  stop(): void {
    this.player?.stop();
    this.host.relax();
  }

  private renderDiagnostics(p: Prepared): void {
    const r = p.report;
    const rows = [
      ['duration', `${p.performance.durationSeconds.toFixed(2)} s`],
      ['segments', String(p.performance.segments.length)],
      ['peak RMS', Math.max(0, ...p.envelope).toFixed(3)],
    ];
    if (r) {
      rows.push(
        ['distinct poses', String(r.distinctPoses)],
        ['jaw↔loudness r', r.jawLoudnessCorrelation.toFixed(2)],
        ['jaw lead', `${(r.jawLeadSeconds * 1000).toFixed(0)} ms`],
      );
    } else {
      rows.push(['puppet', 'off — generator not run']);
    }
    byId('diag').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  private showControls(c: FaceControls, phoneme: string | null, time: number | null, rms: number): void {
    byId('time').textContent = time === null ? '–' : `${Math.max(0, time).toFixed(2)} s`;
    byId('sound').textContent = phoneme ?? (time === null ? '–' : 'pause');
    for (const k of ['jawOpen', 'lipWidth', 'lipRound'] as const) {
      byId(`${k}Bar`).style.width = `${c[k] * 100}%`;
      byId(`${k}Val`).textContent = c[k].toFixed(2);
    }
    byId('rmsBar').style.width = `${Math.min(1, rms * 2) * 100}%`;
    byId('rmsVal').textContent = rms.toFixed(2);
  }

  private drawTimeline(time: number | null): void {
    const canvas = this.timeline;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const p = this.prepared;
    if (!p) return;
    const dur = p.performance.durationSeconds || 1;
    const x = (t: number) => (t / dur) * w;
    g.font = '10px ui-monospace, monospace';
    g.textBaseline = 'top';
    for (const s of p.performance.segments) {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x(s.startSeconds), 0, 1, h);
      g.fillStyle = '#8a93a8';
      g.fillText(s.phoneme ?? '·', x(s.startSeconds) + 2, 2);
    }
    const peak = Math.max(1e-6, ...p.envelope);
    g.fillStyle = 'rgba(120,170,255,0.35)';
    p.envelope.forEach((v, i) => {
      const bh = (v / peak) * (h - 18);
      g.fillRect(x(i * 0.01), h - bh, Math.max(1, x(0.01)), bh);
    });
    if (p.track) {
      const lines: [keyof FaceControls, string][] = [['jawOpen', '#ff8a5c'], ['lipWidth', '#7ee081'], ['lipRound', '#d68cff']];
      for (const [k, color] of lines) {
        g.strokeStyle = color;
        g.lineWidth = 1.5;
        g.beginPath();
        p.track.samples.forEach((s, i) => {
          const y = h - s[k] * (h - 18);
          if (i === 0) g.moveTo(x(s.timeSeconds), y); else g.lineTo(x(s.timeSeconds), y);
        });
        g.stroke();
      }
    }
    if (time !== null) {
      g.fillStyle = '#fff';
      g.fillRect(x(time), 0, 1.5, h);
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const time = this.player?.position() ?? null;
    const p = this.prepared;
    let segment: PerformanceSegment | null = null;
    if (time !== null && p) {
      segment = segmentAt(p.performance, time);
      if (p.track) this.host.follow(sampleFaceTrack(p.track, time));
    }
    this.host.tick(dt);
    this.face.render(dt);
    this.showControls(this.host.controls, segment?.phoneme ?? null, time, this.player?.level() ?? 0);
    this.drawTimeline(time);
    this.opts.onFrame?.(time, segment);
    requestAnimationFrame((n) => this.frame(n));
  }

  // Hook for automated browser checks; not part of the puppet interface.
  private debugHook() {
    return {
      state: () => {
        const player = this.player;
        return {
          playing: player?.playing ?? false,
          time: player?.position() ?? null,
          controls: { ...this.host.controls },
          level: player?.level() ?? 0,
          puppetEnabled: this.puppetEl.checked,
          generatorRuns: this.generatorRuns,
          playCount: this.playCount,
          report: this.prepared?.report ?? null,
          warnings: this.prepared?.performance.warnings ?? [],
          audioContext: player
            ? { state: player.ctx.state, sampleRate: player.ctx.sampleRate, baseLatency: player.ctx.baseLatency, outputLatency: player.ctx.outputLatency }
            : null,
          ...this.opts.debugState?.(),
        };
      },
      /** Stop playback and hold a pose, e.g. for screenshots of the rig mapping. */
      holdPose: (c: FaceControls) => {
        this.stop();
        this.host.follow(c);
        this.face.render(0);
        return this.face.renderer.domElement;
      },
    };
  }
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
