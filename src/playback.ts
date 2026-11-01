// One playback timeline for audio and animation.
// The utterance is rendered to a buffer up front, so its start time on the
// AudioContext clock is known exactly; the face reads the same clock.

export class Player {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private source: AudioBufferSourceNode | null = null;
  private startTime = 0;
  private duration = 0;
  private readonly meterBuf: Float32Array<ArrayBuffer>;
  onEnded: (() => void) | null = null;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.connect(this.ctx.destination);
    this.meterBuf = new Float32Array(this.analyser.fftSize);
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get playing(): boolean {
    return this.source !== null;
  }

  async play(samples: Float32Array<ArrayBuffer>, leadSeconds = 0.03): Promise<void> {
    this.stop();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    const buffer = this.ctx.createBuffer(1, Math.max(1, samples.length), this.ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    this.startTime = this.ctx.currentTime + leadSeconds;
    this.duration = buffer.duration;
    src.onended = () => {
      if (this.source !== src) return;
      this.source = null;
      this.onEnded?.();
    };
    src.start(this.startTime);
    this.source = src;
  }

  stop(): void {
    const src = this.source;
    if (!src) return;
    this.source = null;
    src.onended = null;
    try {
      src.stop();
    } catch {
      // Already stopped.
    }
    src.disconnect();
  }

  /**
   * Seconds since the utterance started, as heard at the speakers. Uses the
   * output timestamp so the face is not ahead of the audio by the output
   * latency. Null when nothing is playing.
   */
  position(): number | null {
    if (!this.source) return null;
    let audibleCtxTime = this.ctx.currentTime - (this.ctx.outputLatency || 0);
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      audibleCtxTime = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return Math.min(this.duration, audibleCtxTime - this.startTime);
  }

  /** Output level (RMS) right now, from the analyser. */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.meterBuf);
    let sum = 0;
    for (const v of this.meterBuf) sum += v * v;
    return Math.sqrt(sum / this.meterBuf.length);
  }
}
