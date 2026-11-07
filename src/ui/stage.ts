// Utterance stage: plays one rendered utterance on a single clock and drives the
// puppet view from its face-control track. Each playground page supplies its
// own panel and a compile() callback that returns a rendered Rust performance.

import { segmentAt, sampleFaceTrack, type PerformanceSegment, type RenderedUtterance, type Timeline, type FaceControlTrack, type FaceControls } from '@wahwah/performance';
import { rmsEnvelope, syncReport, type SyncReport } from '../analysis';
import { Player } from '../playback';
import { beginMonitor, drawMonitorLegend, drawMonitorPlayhead, MONITOR_COLORS, MONITOR_SIGNALS } from './monitorTheme';
import { PuppetView, byId, fitCanvas, renderMode } from './puppetView';

export { byId, section } from './puppetView';

/** Keep each generated mode's draft in memory while the user tries other inputs. */
export function restoreDraft(root: HTMLElement, signal: AbortSignal, draft: Record<string, string>): void {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    ':is(#group-0, #group-1) :is(input, select, textarea)[id]',
  );
  for (const field of fields) if (field.id in draft) field.value = draft[field.id];
  signal.addEventListener('abort', () => {
    for (const field of fields) draft[field.id] = field.value;
  }, { once: true });
}

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
  /** Page-specific panel content, usually built with section(). */
  inputHtml: string;
  voiceHtml: string;
  /** Build the utterance from the page's current inputs, with any engine. */
  compile: (sampleRate: number, puppet: boolean) => RenderedUtterance;
  /** Called every frame with the playback time and active segment. */
  onFrame?: (time: number | null, segment: PerformanceSegment | null) => void;
  /** Extra fields for the window.__wahwah debug hook. */
  debugState?: () => Record<string, unknown>;
}

export class Stage {
  private frameId = 0;
  private player: Player | null = null;
  private prepared: Prepared | null = null;
  private generatorRuns = 0;
  private playCount = 0;
  private readonly timeline: HTMLCanvasElement;
  private readonly stopButton: HTMLButtonElement;
  private last = performance.now();

  constructor(root: HTMLElement, readonly view: PuppetView, private readonly signal: AbortSignal, private readonly opts: StageOptions) {
    renderMode(root, {

      inputHtml: opts.inputHtml,
      voiceHtml: opts.voiceHtml,
      transportHtml: '<button id="play" class="primary" title="Play line (Ctrl or Command + Enter)">▶ Play line</button><button id="stop" disabled title="Stop playback (Escape)">■ Stop</button>',
    });
    this.timeline = byId('timeline');

    this.view.puppetEl.addEventListener('change', () => this.invalidate(), { signal });
    byId('play').addEventListener('click', () => void this.play(), { signal });
    this.stopButton = byId<HTMLButtonElement>('stop');
    this.stopButton.addEventListener('click', () => this.stop(), { signal });
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (e.isComposing) return;
      if (e.code === 'Escape') { this.stop(); return; }
      if (t instanceof HTMLTextAreaElement && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!e.repeat) void this.play();
        return;
      }
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox')) return;
      if (e.code === 'Space' && !(t instanceof HTMLElement && t.closest('button, summary, a, input'))) { e.preventDefault(); void this.play(); }
    }, { signal });

    const debug = this.debugHook();
    Object.assign(window, { __wahwah: debug });
    this.frameId = requestAnimationFrame((now) => this.frame(now));
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(this.frameId);
      this.player?.dispose();
      this.view.follower.relax();
      if (Reflect.get(window, '__wahwah') === debug) Reflect.deleteProperty(window, '__wahwah');
    }, { once: true });
  }

  /** Inputs changed: stop, relax the face, and rebuild. */
  invalidate(): void {
    this.player?.stop();
    this.view.follower.relax();
    this.prepared = null;
    this.prepare();
  }

  get current(): Prepared | null {
    return this.prepared;
  }

  prepare(): Prepared {
    if (this.prepared) return this.prepared;
    const sampleRate = this.player?.sampleRate ?? 48000;
    const utterance = this.opts.compile(sampleRate, this.view.puppetEnabled);
    const performance = utterance.timeline;
    const audio = utterance.audio as Float32Array<ArrayBuffer>;
    // Puppet disabled means the instruction generator does not run at all.
    let track: FaceControlTrack | null = null;
    if (this.view.puppetEnabled) {
      track = utterance.track;
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
    if (this.signal.aborted) return;
    if (!this.player) {
      this.player = new Player();
      this.player.onEnded = () => this.view.follower.relax();
      // Re-render only if the device runs at a different sample rate.
      if (this.prepared && this.prepared.sampleRate !== this.player.sampleRate) this.prepared = null;
    }
    const p = this.prepare();
    await this.player.play(p.audio);
    if (!this.signal.aborted && this.player.playing) this.playCount++;
  }

  stop(): void {
    this.player?.stop();
    this.view.follower.relax();
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
    const { top, bottom } = beginMonitor(g, w, h);
    const p = this.prepared;
    if (!p) return;
    const duration = p.performance.durationSeconds || 1;
    const x = (t: number) => (t / duration) * w;
    const height = bottom - top;

    const peak = Math.max(1e-6, ...p.envelope);
    g.fillStyle = MONITOR_COLORS.fill;
    g.beginPath();
    g.moveTo(0, bottom);
    p.envelope.forEach((v, i) => g.lineTo(x(i * 0.01), bottom - (v / peak) * height));
    g.lineTo(Math.min(w, x(p.envelope.length * 0.01)), bottom);
    g.closePath();
    g.fill();

    if (p.track) {
      for (const [key, color, dash] of MONITOR_SIGNALS) {
        g.strokeStyle = color;
        g.lineWidth = 1.8;
        g.lineCap = 'round';
        g.setLineDash([...dash]);
        g.beginPath();
        p.track.samples.forEach((sample, i) => {
          const y = bottom - sample[key] * height;
          if (i === 0) g.moveTo(x(sample.timeSeconds), y);
          else g.lineTo(x(sample.timeSeconds), y);
        });
        g.stroke();
      }
    }

    // Skip labels that cannot fit, especially when the phone plot is narrow.
    g.setLineDash([]);
    g.font = '10px ui-monospace, monospace';
    g.textBaseline = 'top';
    g.fillStyle = MONITOR_COLORS.labels;
    let labelEnd = 0;
    for (const segment of p.performance.segments) {
      if (!segment.phoneme) continue;
      const left = x(segment.startSeconds) + 3;
      const right = left + g.measureText(segment.phoneme).width;
      if (left >= labelEnd && right < w) {
        g.fillText(segment.phoneme, left, 2);
        labelEnd = right + 9;
      }
    }
    drawMonitorLegend(g, w, h);
    if (time !== null) drawMonitorPlayhead(g, x(Math.max(0, time)), h);
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const time = this.player?.position() ?? null;
    if (this.stopButton.disabled !== (time === null)) this.stopButton.disabled = time === null;
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
    this.frameId = requestAnimationFrame((n) => this.frame(n));
  }

  // Hook for automated browser checks; not part of the puppet interface.
  private debugHook() {
    return {
      state: () => {
        const player = this.player;
        return {
          playing: player?.playing ?? false,
          time: player?.position() ?? null,
          controls: { ...this.view.follower.controls },
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
