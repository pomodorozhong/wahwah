// Live voice analysis on the audio thread. The same LiveMouthEstimator the
// main thread uses runs here every `hop` samples (256 = 5.3 ms at 48 kHz),
// instead of once per screen refresh, so its timing no longer depends on the
// display or on the tab being in front. Results are posted to the page.

/// <reference path="./audioworklet.d.ts" />
import { LiveMouthEstimator, type LiveFrame, type LiveSettings } from './estimator';
import { magnitudeSpectrumDb } from './features';
import { frameFeatures, type FrameFeatures, type VoiceProfile } from './profile';
import { ulsInputLength } from './ulipsync';

const SHORT = 1024;
const BUFFER = 4096;

export type ToWorklet =
  | { type: 'settings'; settings: LiveSettings }
  | { type: 'profile'; profile: VoiceProfile | null }
  | { type: 'enabled'; puppet: boolean }
  | { type: 'calibrating'; on: boolean }
  | { type: 'reset' };

export interface FromWorklet {
  type: 'frame';
  /** AudioContext time at the end of the analysed audio, seconds. */
  time: number;
  /** RMS of the short window (for the level meter). */
  level: number;
  frame: LiveFrame | null;
  features: FrameFeatures | null;
  /** Analysis time for this hop, ms (audio-thread budget check). */
  costMs: number;
}

class MouthAnalysisProcessor extends AudioWorkletProcessor {
  private readonly ring = new Float32Array(BUFFER);
  private write = 0;
  private sinceHop = 0;
  private readonly hop: number;
  private readonly estimator = new LiveMouthEstimator();
  private puppet = true;
  private calibrating = false;
  private readonly shortFrame = new Float32Array(SHORT);
  private readonly longFrame: Float32Array;

  constructor(options?: { processorOptions?: unknown }) {
    super(options);
    this.hop = (options?.processorOptions as { hop?: number } | undefined)?.hop ?? 256;
    this.longFrame = new Float32Array(ulsInputLength(sampleRate));
    this.port.onmessage = (e: MessageEvent<ToWorklet>) => {
      const m = e.data;
      if (m.type === 'settings') this.estimator.settings = m.settings;
      else if (m.type === 'profile') this.estimator.setProfile(m.profile);
      else if (m.type === 'enabled') this.puppet = m.puppet;
      else if (m.type === 'calibrating') this.calibrating = m.on;
      else if (m.type === 'reset') this.estimator.reset();
    };
  }

  process(inputs: Float32Array[][]): boolean {
    // No connected input (e.g. between test clips) is analysed as silence, so
    // frames keep flowing and the calibration's quiet step can complete.
    const input = inputs[0]?.[0];
    const n = input?.length ?? 128;
    for (let i = 0; i < n; i++) {
      this.ring[this.write] = input ? input[i] : 0;
      this.write = (this.write + 1) % BUFFER;
    }
    this.sinceHop += n;
    if (this.sinceHop >= this.hop) {
      this.sinceHop = 0;
      this.analyse();
    }
    return true;
  }

  /** Copy the newest `out.length` samples (oldest first) out of the ring. */
  private latest(out: Float32Array): Float32Array {
    const start = (this.write - out.length + BUFFER) % BUFFER;
    for (let i = 0; i < out.length; i++) out[i] = this.ring[(start + i) % BUFFER];
    return out;
  }

  private analyse(): void {
    const t0 = Date.now();
    const short = this.latest(this.shortFrame);
    const long = this.latest(this.longFrame);
    let sum = 0;
    for (const v of short) sum += v * v;
    const level = Math.sqrt(sum / SHORT);
    const spectrum = magnitudeSpectrumDb(short);
    const dt = this.hop / sampleRate;
    const frame = this.puppet ? this.estimator.process(short, spectrum, sampleRate, dt, long) : null;
    const features = this.calibrating ? frameFeatures(short, spectrum, sampleRate, long) : null;
    const msg: FromWorklet = { type: 'frame', time: currentTime, level, frame, features, costMs: Date.now() - t0 };
    this.port.postMessage(msg);
  }
}

registerProcessor('mouth-analysis', MouthAnalysisProcessor);
