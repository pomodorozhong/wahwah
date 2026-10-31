// Live voice analysis -> puppet instructions. Pure: feed it audio frames (and
// optionally a magnitude spectrum) and it returns FaceControls, so it runs the
// same on a microphone, a test signal, or in Node tests.
//
// Jaw follows loudness above an adaptive noise floor. Lip shape is an
// experimental guess from the spectral centroid: dark voiced sound (low
// centroid, like "oo") reads as rounded, bright sound (like "ee") as wide.

import { NEUTRAL, normalizeControls, type FaceControls } from '../puppet/controls';

export interface LiveSettings {
  /** Extra amplification of the jaw response, 0.5..3. */
  sensitivity: number;
  /** dB above the noise floor where the mouth starts to open. */
  gateDb: number;
  /** dB range over which the jaw goes from closed to fully open. */
  rangeDb: number;
  /** Opening and closing time constants, seconds. */
  attackSeconds: number;
  releaseSeconds: number;
  /** Estimate lipWidth/lipRound from the spectrum (experimental). */
  lipShape: boolean;
}

export const DEFAULT_LIVE: LiveSettings = {
  sensitivity: 1,
  gateDb: 8,
  rangeDb: 30,
  attackSeconds: 0.025,
  releaseSeconds: 0.08,
  lipShape: true,
};

export interface LiveFrame extends FaceControls {
  /** Input level in dBFS. */
  levelDb: number;
  /** Tracked noise floor in dBFS. */
  floorDb: number;
  /** Recent speech peak in dBFS (decays slowly). */
  peakDb: number;
  /** Level where the mouth starts to open, dBFS. */
  thresholdDb: number;
  /** Spectral centroid of the voiced band, Hz (0 when not measured). */
  centroidHz: number;
  /** Whether the input is above the gate. */
  voiced: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function rmsDb(frame: Float32Array): number {
  let sum = 0;
  for (const v of frame) sum += v * v;
  const rms = Math.sqrt(sum / Math.max(1, frame.length));
  return 20 * Math.log10(Math.max(rms, 1e-7));
}

/**
 * Centroid of a dB magnitude spectrum (as from AnalyserNode) between 150 and
 * 4000 Hz, weighting bins by linear magnitude.
 */
export function spectralCentroid(spectrumDb: Float32Array, sampleRate: number): number {
  const binHz = sampleRate / 2 / spectrumDb.length;
  let num = 0;
  let den = 0;
  for (let i = Math.ceil(150 / binHz); i < spectrumDb.length && i * binHz <= 4000; i++) {
    const mag = Math.pow(10, spectrumDb[i] / 20);
    num += i * binHz * mag;
    den += mag;
  }
  return den > 0 ? num / den : 0;
}

export class LiveMouthEstimator {
  private floorDb = -60;
  private peakDb = -40;
  private jaw = 0;
  private width = 0;
  private round = 0;
  private started = false;

  constructor(public settings: LiveSettings = { ...DEFAULT_LIVE }) {}

  reset(): void {
    this.floorDb = -60;
    this.peakDb = -40;
    this.jaw = this.width = this.round = 0;
    this.started = false;
  }

  /**
   * @param frame  latest time-domain samples (e.g. 1024 at 48 kHz)
   * @param spectrumDb  matching magnitude spectrum in dB, or null to skip lip shape
   * @param dtSeconds  time since the previous call
   */
  process(frame: Float32Array, spectrumDb: Float32Array | null, sampleRate: number, dtSeconds: number): LiveFrame {
    const s = this.settings;
    const levelDb = rmsDb(frame);
    // Noise floor: drops instantly to quieter input, creeps up slowly, so steady
    // background noise is learned within a few seconds but speech is not.
    if (!this.started) {
      this.floorDb = Math.min(levelDb, -40);
      this.started = true;
    } else if (levelDb < this.floorDb) {
      this.floorDb = levelDb;
    } else {
      this.floorDb += Math.min(levelDb - this.floorDb, 6 * dtSeconds);
    }
    this.floorDb = Math.max(this.floorDb, -90);

    // Recent peak: jumps up, decays 3 dB/s. The opening threshold sits at the
    // gate above the floor, but never more than rangeDb below the peak, so a
    // very quiet room does not pin the jaw fully open on every sound.
    const gateLevel = this.floorDb + s.gateDb;
    this.peakDb = Math.max(levelDb, this.peakDb - 3 * dtSeconds, gateLevel + 10);
    const thresholdDb = Math.max(gateLevel, this.peakDb - s.rangeDb);
    const voiced = levelDb > gateLevel;
    const jawTarget = voiced ? clamp01(((levelDb - thresholdDb) / s.rangeDb) * s.sensitivity) : 0;
    const tau = jawTarget > this.jaw ? s.attackSeconds : s.releaseSeconds;
    this.jaw += (jawTarget - this.jaw) * (1 - Math.exp(-dtSeconds / tau));

    let centroidHz = 0;
    let widthTarget = 0;
    let roundTarget = 0;
    if (s.lipShape && spectrumDb && voiced) {
      centroidHz = spectralCentroid(spectrumDb, sampleRate);
      // Dark (< ~900 Hz) reads as "oo", bright (> ~1600 Hz) as "ee".
      roundTarget = clamp01((1100 - centroidHz) / 500);
      widthTarget = clamp01((centroidHz - 1300) / 900);
    }
    const shapeK = 1 - Math.exp(-dtSeconds / 0.06);
    this.width += (widthTarget - this.width) * shapeK;
    this.round += (roundTarget - this.round) * shapeK;

    const c = normalizeControls({ jawOpen: this.jaw, lipWidth: this.width, lipRound: this.round });
    return { ...c, levelDb, floorDb: this.floorDb, peakDb: this.peakDb, thresholdDb, centroidHz, voiced };
  }

  /** Controls only, or neutral before the first frame. */
  get controls(): FaceControls {
    return this.started ? normalizeControls({ jawOpen: this.jaw, lipWidth: this.width, lipRound: this.round }) : { ...NEUTRAL };
  }
}
