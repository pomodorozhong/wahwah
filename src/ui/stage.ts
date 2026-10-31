// Utterance stage: plays one rendered utterance on a single clock and drives the
// puppet view from its face-control track. Each playground page supplies its
// own panel and a compile() callback that returns an Utterance from any engine.

import { segmentAt, type PerformanceSegment, type Timeline, type Utterance } from '../voice/performance';
import { generateFaceTrack, sampleFaceTrack } from '../puppet/generate';
import type { FaceControlTrack, FaceControls } from '../puppet/controls';
import { rmsEnvelope, syncReport, type SyncReport } from '../analysis';
import { Player } from '../playback';
import { PuppetView, byId, fitCanvas, renderShell } from './puppetView';

export { byId, section } from './puppetView';

export interface Prepared {
  engine: string;
  performance: Timeline;
  audio: Float32Array<ArrayBuffer>;
  sampleRate: number;
  envelope: number[];
  track: FaceControlTrack | null;
  report: SyncReport | null;
}

export interface StageOptions {
  title: string;
  /** Page-specific panel content, usually built with section(). */
  panelHtml: string;
  /** Build the utterance from the page's current inputs, with any engine. */
  compile: () => Utterance;
  /** Called every frame with the playback time and active segment. */
  onFrame?: (time: number | null, segment: PerformanceSegment | null) => void;
  /** Extra fields for the window.__mumble debug hook. */
  debugState?: () => Record<string, unknown>;
}

const CONTROL_LINES: [keyof FaceControls, string][] = [['jawOpen', '#ff8a5c'], ['lipWidth', '#7ee081'], ['lipRound', '#d68cff']];

export class Stage {
  readonly view: PuppetView;
  private player: Player | null = null;
  private prepared: Prepared | null = null;
  private generatorRuns = 0;
  private playCount = 0;
  private readonly timeline: HTMLCanvasElement;
  private last = performance.now();

  constructor(root: HTMLElement, private readonly opts: StageOptions) {
    renderShell(root, {
      title: opts.title,
      panelHtml: opts.panelHtml,
      transportHtml: '<button id="play" class="primary">▶ Play</button><button id="stop">■ Stop</button>',
    });
    this.view = new PuppetView();
    this.timeline = byId('timeline');

    this.view.puppetEl.addEventListener('change', () => this.invalidate());
    byId('play').addEventListener('click', () => void this.play());
    byId('stop').addEventListener('click', () => this.stop());
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox')) return;
      if (e.code === 'Space') { e.preventDefault(); void this.play(); }
      if (e.code === 'Escape') this.stop();
    });

    Object.assign(window, { __mumble: this.debugHook() });
    requestAnimationFrame((now) => this.frame(now));
  }

  /** Inputs changed: stop, relax the face, and rebuild. */
  invalidate(): void {
    this.player?.stop();
    this.view.host.relax();
    this.prepared = null;
    this.prepare();
  }

  get current(): Prepared | null {
    return this.prepared;
  }

  prepare(): Prepared {
    if (this.prepared) return this.prepared;
    const sampleRate = this.player?.sampleRate ?? 48000;
    const utterance = this.opts.compile();
    const performance = utterance.timeline;
    const audio = utterance.render(sampleRate) as Float32Array<ArrayBuffer>;
    // Puppet disabled means the instruction generator does not run at all.
    let track: FaceControlTrack | null = null;
    if (this.view.puppetEnabled) {
      track = generateFaceTrack(performance);
      this.generatorRuns++;
    }
    const p: Prepared = {
      engine: utterance.engine,
      performance,
      audio,
      sampleRate,
      envelope: rmsEnvelope(audio, sampleRate),
      track,
      report: track ? syncReport(audio, sampleRate, track) : null,
    };
    this.prepared = p;
    const warn = byId('warnings');
    warn.hidden = utterance.warnings.length === 0;
    warn.textContent = utterance.warnings.join('; ');
    this.renderDiagnostics(p);
    return p;
  }

  async play(): Promise<void> {
    if (!this.player) {
      this.player = new Player();
      this.player.onEnded = () => this.view.host.relax();
      // Re-render only if the device runs at a different sample rate.
      if (this.prepared && this.prepared.sampleRate !== this.player.sampleRate) this.prepared = null;
    }
    const p = this.prepare();
    await this.player.play(p.audio);
    this.playCount++;
  }

  stop(): void {
    this.player?.stop();
    this.view.host.relax();
  }

  private renderDiagnostics(p: Prepared): void {
    const r = p.report;
    const rows = [
      ['engine', p.engine],
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

  private drawTimeline(time: number | null): void {
    const { g, w, h } = fitCanvas(this.timeline);
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
      for (const [k, color] of CONTROL_LINES) {
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
    let controls: FaceControls | null = null;
    if (time !== null && p) {
      segment = segmentAt(p.performance, time);
      if (p.track) controls = sampleFaceTrack(p.track, time);
    }
    this.view.update(dt, controls);
    this.view.showReadout(time, segment?.phoneme ?? null, this.player?.level() ?? 0);
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
          controls: { ...this.view.host.controls },
          level: player?.level() ?? 0,
          puppetEnabled: this.view.puppetEnabled,
          generatorRuns: this.generatorRuns,
          playCount: this.playCount,
          report: this.prepared?.report ?? null,
          engine: this.prepared?.engine ?? null,
          view: this.view.view,
          motion: this.view.motion.current,
          audioContext: player
            ? { state: player.ctx.state, sampleRate: player.ctx.sampleRate, baseLatency: player.ctx.baseLatency, outputLatency: player.ctx.outputLatency }
            : null,
          ...this.opts.debugState?.(),
        };
      },
      /** Stop playback and hold a pose, e.g. for screenshots of the rig mapping. */
      holdPose: (c: FaceControls) => {
        this.stop();
        return this.view.holdPose(c);
      },
    };
  }
}
