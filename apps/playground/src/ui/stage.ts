// Utterance stage: plays one rendered utterance on a single clock and drives the
// puppet view from its face-control track. Each playground page supplies its
// own panel and a compile() callback that returns a rendered Rust performance.

import { segmentAt, sampleFaceTrack, type PerformanceSegment, type RenderedUtterance, type Timeline, type FaceControlTrack, type FaceControls } from 'wahwah/performance';
import { rmsEnvelope, syncReport, type SyncReport } from '../analysis';
import { Player } from '../playback';
import { fitCurves, type FitPlotData } from './fitCurves';
import { beginMonitor, drawMonitorPlayhead, MONITOR_COLORS, MONITOR_SERIES, monitorSeriesOn, visibleFaceSignals, type MonitorSeries } from './monitorTheme';
import { PuppetView, byId, fitCanvas, renderMode, showFitChips } from './puppetView';

export { byId, disclosure, section } from './puppetView';

/** Keep each generated mode's draft in memory while the user tries other inputs. */
export function restoreDraft(root: HTMLElement, signal: AbortSignal, draft: Record<string, string>): void {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    // Length (#group-2) keeps its own values, shared by Text and Phonemes; see lengthControls.ts.
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
  lengthHtml?: string;
  /** The current line's fit to a maximum duration, if any, drawn on the monitor. */
  fit?: () => FitPlotData | null;
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
      lengthHtml: opts.lengthHtml,
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
    // Wide screens keep this to one line above the monitor; the full text is on hover.
    warn.title = warn.textContent;
    this.renderDiagnostics(p);
    showFitChips(!!this.opts.fit?.());
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
    const p = this.prepared;
    const fit = p ? this.opts.fit?.() ?? null : null;
    const { g, w, h } = fitCanvas(this.timeline);
    const { top, bottom } = beginMonitor(g, w, h, !!fit);
    if (!p) return;
    const duration = p.performance.durationSeconds || 1;
    const tail = fit?.tail ?? null;
    const curves = fit ? fitCurves(fit) : null;
    // A cut line also shows, faintly, the part of the original line the cut removed.
    const span = Math.max(duration, tail?.seconds ?? 0);
    const x = (t: number) => (t / span) * w;
    const height = bottom - top;
    const cutX = curves?.cutAt != null && tail ? x(curves.cutAt) : null;
    if (cutX !== null) {
      g.fillStyle = MONITOR_COLORS.removed;
      g.fillRect(cutX, 0, w - cutX, bottom);
    }

    const peak = Math.max(1e-6, ...p.envelope);
    if (monitorSeriesOn('level')) {
      g.fillStyle = MONITOR_COLORS.fill;
      g.beginPath();
      g.moveTo(0, bottom);
      p.envelope.forEach((v, i) => g.lineTo(x(i * 0.01), bottom - (v / peak) * height));
      g.lineTo(Math.min(w, x(p.envelope.length * 0.01)), bottom);
      g.closePath();
      g.fill();
      if (tail && cutX !== null) {
        g.globalAlpha = 0.35;
        g.beginPath();
        g.moveTo(cutX, bottom);
        for (const point of tail.envelope) if (x(point.t) >= cutX) g.lineTo(x(point.t), bottom - Math.min(1, point.v / peak) * height);
        g.lineTo(x(tail.seconds), bottom);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
      }
    }

    const stroke = (color: string, dash: readonly number[], width = 1.8) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.setLineDash([...dash]);
    };
    for (const [key, color, dash] of visibleFaceSignals()) {
      if (p.track) {
        stroke(color, dash);
        g.beginPath();
        p.track.samples.forEach((sample, i) => {
          const y = bottom - sample[key] * height;
          if (i === 0) g.moveTo(x(sample.timeSeconds), y);
          else g.lineTo(x(sample.timeSeconds), y);
        });
        g.stroke();
      }
      if (tail?.track && cutX !== null) {
        stroke(color, dash, 1.4);
        g.globalAlpha = 0.4;
        g.beginPath();
        let started = false;
        for (const sample of tail.track.samples) {
          const px = x(sample.timeSeconds);
          if (px < cutX) continue;
          const y = bottom - sample[key] * height;
          if (!started) { g.moveTo(px, y); started = true; } else g.lineTo(px, y);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
    }

    if (curves) {
      const line = (key: MonitorSeries, value: (t: number) => number) => {
        if (!monitorSeriesOn(key)) return;
        stroke(MONITOR_SERIES[key].color, MONITOR_SERIES[key].dash, 2);
        g.beginPath();
        const n = Math.max(2, Math.floor(x(duration)));
        for (let k = 0; k <= n; k++) {
          const t = (k / n) * duration;
          const y = bottom - Math.min(1, Math.max(0, value(t))) * height;
          if (k === 0) g.moveTo(x(t), y); else g.lineTo(x(t), y);
        }
        g.stroke();
      };
      const topSpeed = Math.max(1.2, curves.peak * 1.05);
      line('speed', t => (curves.speed(t) - 1) / (topSpeed - 1));
      line('reached', curves.reached);
      line('fade', t => curves.gain(t) / curves.maxGain);
      // Markers at the fade start and the cut, labelled on the time axis.
      g.font = '10px system-ui, sans-serif';
      g.textBaseline = 'bottom';
      const marker = (t: number, color: string, label: string, align: CanvasTextAlign) => {
        stroke(color, [4, 3], 1.2);
        g.beginPath();
        g.moveTo(x(t), top);
        g.lineTo(x(t), bottom);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = color;
        g.textAlign = align;
        g.fillText(label, x(t) + (align === 'right' ? -3 : 3), h - 1);
      };
      if (curves.fadeStart !== null) marker(curves.fadeStart, MONITOR_SERIES.fade.color, 'fade', 'right');
      if (curves.cutAt !== null) marker(curves.cutAt, MONITOR_COLORS.foreground, `cut ${curves.cutAt.toFixed(1)} s`, 'left');
      g.textAlign = 'left';
      g.fillStyle = MONITOR_COLORS.labels;
      g.fillText('0 s', 2, h - 1);
      if (tail && cutX !== null && w - cutX > 150) {
        g.textAlign = 'right';
        g.fillText(`cut off · original ends ${tail.seconds.toFixed(1)} s`, w - 3, h - 1);
      }
      g.textAlign = 'left';
    }

    // Skip labels that cannot fit, especially when the plot is narrow.
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
    if (time !== null) drawMonitorPlayhead(g, x(Math.max(0, time)), bottom);
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
