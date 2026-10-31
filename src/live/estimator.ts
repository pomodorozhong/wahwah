// Live voice analysis -> puppet instructions. Pure: feed it audio frames (and
// a magnitude spectrum) and it returns FaceControls, so it runs the same on a
// microphone, a test signal, or in Node tests.
//
// Jaw: loudness above an adaptive noise floor, capped relative to a decaying
// recent peak. Mouth shape (mode 'formants'): F1/F2 from LPC are matched to
// reference vowels with an adaptive speaker scale; unvoiced hiss is read as
// s / sh / f by its frequency; a quiet voiced hum is read as closed lips (m/b).
// Mode 'profile' instead matches MFCCs against the speaker's own calibration
// recordings (see profile.ts), which absorbs their accent, mic and room.
// Mode 'centroid' keeps the earlier brightness-only guess for comparison.

import { NEUTRAL, normalizeControls, type FaceControls } from '../puppet/controls';
import { VISEMES } from '../puppet/visemes';
import { estimateFormants, fullCentroid, highBandRatio, periodicity } from './features';
import { bestScale, matchVowel } from './vowels';
import { mfcc } from './mfcc';
import { argmax, classPose, classify, isVowel, vowelPose, type ProfileClassId, type VoiceProfile } from './profile';

export type ShapeMode = 'profile' | 'formants' | 'centroid' | 'off';

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
  /** How lip shape is estimated. */
  shapeMode: ShapeMode;
}

export const DEFAULT_LIVE: LiveSettings = {
  sensitivity: 1,
  gateDb: 8,
  rangeDb: 30,
  attackSeconds: 0.025,
  releaseSeconds: 0.08,
  shapeMode: 'formants',
};

export type SoundClass = 'silence' | 'vowel' | 'closure' | 'fricative' | 'voiced';

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
  /** 0..1 periodicity of the frame (1 = clearly pitched). */
  periodicity: number;
  pitchHz: number;
  /** First two formants, Hz (0 when not measured). */
  f1: number;
  f2: number;
  /** Adaptive speaker scale (1 = reference adult male). */
  speakerScale: number;
  /** What the frame was read as, and the closest sound code ("AA", "S", "M" …). */
  soundClass: SoundClass;
  sound: string | null;
  /** Profile mode: smoothed probability of each calibrated sound. */
  probabilities: Partial<Record<ProfileClassId, number>> | null;
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

/** Fraction of power below `splitHz`, within the 50 Hz .. 5 kHz band. */
function lowBandRatio(spectrumDb: Float32Array, sampleRate: number, splitHz: number): number {
  const binHz = sampleRate / 2 / spectrumDb.length;
  let lo = 0;
  let total = 0;
  for (let k = Math.ceil(50 / binHz); k < spectrumDb.length && k * binHz <= 5000; k++) {
    const p = 10 ** (spectrumDb[k] / 10);
    total += p;
    if (k * binHz < splitHz) lo += p;
  }
  return total > 0 ? lo / total : 0;
}

/** Internal tuning, exported for experiments and tests. */
export const TUNING = {
  /** Share of the jaw that comes from loudness alone (the rest from the vowel's openness). */
  jawLoudnessShare: 0.25,
  /** Closure: dB below the recent peak, and share of power below 500 Hz. */
  closureDropDb: 8,
  closureLowRatio: 0.95,
};

export class LiveMouthEstimator {
  private floorDb = -60;
  private peakDb = -40;
  private jaw = 0;
  private width = 0;
  private round = 0;
  private logScale = 0;
  private lastVowelPose: FaceControls = { ...NEUTRAL };
  private started = false;
  private profile: VoiceProfile | null = null;
  private probs: Partial<Record<ProfileClassId, number>> = {};

  constructor(public settings: LiveSettings = { ...DEFAULT_LIVE }) {}

  /** Use a speaker's calibration profile (for shapeMode 'profile'). */
  setProfile(profile: VoiceProfile | null): void {
    this.profile = profile;
    this.probs = {};
  }

  get hasProfile(): boolean {
    return this.profile !== null;
  }

  reset(): void {
    this.floorDb = -60;
    this.peakDb = -40;
    this.jaw = this.width = this.round = 0;
    this.logScale = 0;
    this.lastVowelPose = { ...NEUTRAL };
    this.probs = {};
    this.started = false;
  }

  /**
   * @param frame  latest time-domain samples (e.g. 1024 at 48 kHz)
   * @param spectrumDb  matching magnitude spectrum in dB, or null to skip shape estimation
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
    const loud = voiced ? clamp01(((levelDb - thresholdDb) / s.rangeDb) * s.sensitivity) : 0;

    let jawTarget = loud;
    let widthTarget = 0;
    let roundTarget = 0;
    let centroidHz = 0;
    let soundClass: SoundClass = voiced ? 'voiced' : 'silence';
    let sound: string | null = null;
    let per = { value: 0, pitchHz: 0 };
    let formants = { f1: 0, f2: 0 };
    let probabilities: Partial<Record<ProfileClassId, number>> | null = null;

    if (spectrumDb && s.shapeMode === 'profile' && this.profile) {
      // Match against the speaker's own recordings; smooth the per-sound
      // probabilities over ~50 ms so single odd frames do not flicker.
      const raw = voiced ? classify(this.profile, mfcc(spectrumDb, sampleRate)) : { silence: 1 };
      const k = 1 - Math.exp(-dtSeconds / 0.05);
      const ids = new Set([...Object.keys(this.probs), ...Object.keys(raw)] as ProfileClassId[]);
      for (const id of ids) this.probs[id] = (this.probs[id] ?? 0) + ((raw[id] ?? 0) - (this.probs[id] ?? 0)) * k;
      probabilities = { ...this.probs };
      const best = argmax(this.probs);
      sound = best === 'silence' ? null : best;
      if (!voiced) {
        soundClass = 'silence';
        jawTarget = 0;
      } else {
        // Soft blend over the calibrated sounds. "silence" has no say while the
        // voice is audible (sounds the profile has never heard, like t, k or l,
        // would otherwise snap the mouth shut), and each sound contributes its
        // own pose: vowels opened by loudness, mm closed, ss teeth together.
        const speech = (Object.entries(this.probs) as [ProfileClassId, number][]).filter(([id]) => id !== 'silence');
        const total = speech.reduce((t, [, p]) => t + p, 0);
        const vowel = vowelPose(this.probs);
        const share = TUNING.jawLoudnessShare;
        jawTarget = widthTarget = roundTarget = 0;
        if (total > 0) {
          for (const [id, p] of speech) {
            const w = p / total;
            const pose = isVowel(id) ? vowel ?? classPose(id) : classPose(id);
            const jaw = isVowel(id) ? loud * (share + (1 - share) * Math.min(1, pose.jawOpen / 0.9)) : pose.jawOpen;
            const shape = isVowel(id) ? Math.min(1, loud * 2) : 1;
            jawTarget += w * jaw;
            widthTarget += w * pose.lipWidth * shape;
            roundTarget += w * pose.lipRound * shape;
          }
        } else {
          jawTarget = loud * share;
        }
        const top = speech.sort((x, y) => y[1] - x[1])[0]?.[0];
        soundClass = top === 'M' ? 'closure' : top === 'S' || top === 'SH' ? 'fricative' : top ? 'vowel' : 'voiced';
        sound = top ?? null;
      }
    } else if (voiced && spectrumDb && s.shapeMode === 'centroid') {
      centroidHz = spectralCentroid(spectrumDb, sampleRate);
      // Dark (< ~900 Hz) reads as "oo", bright (> ~1600 Hz) as "ee".
      roundTarget = clamp01((1100 - centroidHz) / 500);
      widthTarget = clamp01((centroidHz - 1300) / 900);
    } else if (voiced && spectrumDb && s.shapeMode === 'formants') {
      per = periodicity(frame, sampleRate);
      const hissy = highBandRatio(spectrumDb, sampleRate, 2500) > 0.35;
      if (per.value < 0.45 && hissy) {
        // Unvoiced hiss: place it by where the noise sits.
        centroidHz = fullCentroid(spectrumDb, sampleRate);
        sound = centroidHz > 5200 ? 'S' : centroidHz > 2800 ? 'SH' : 'F';
        soundClass = 'fricative';
        const pose = VISEMES[sound].pose;
        jawTarget = pose.jawOpen;
        widthTarget = pose.lipWidth;
        roundTarget = pose.lipRound;
      } else if (per.value >= 0.6 && levelDb < this.peakDb - TUNING.closureDropDb && lowBandRatio(spectrumDb, sampleRate, 500) > TUNING.closureLowRatio) {
        // A pitched hum with nearly all its power below 500 Hz, well below
        // recent speech: lips closed (m, n murmur, b voice bar). The low-band
        // share alone cannot tell "m" from "oo" (both ~0.97-1.0), so this also
        // needs the drop in level that real nasal murmurs have. Neither test
        // synth models that drop, so this rule is unverified on real speech.
        soundClass = 'closure';
        sound = 'M';
        jawTarget = 0;
        widthTarget = VISEMES.M.pose.lipWidth;
      } else if (per.value >= 0.5) {
        formants = estimateFormants(frame, sampleRate);
        if (formants.f1 > 0 && formants.f2 > 0) {
          // Speaker scale adapts slowly (time constant ~2 s) toward the best fit.
          const k = 1 - Math.exp(-dtSeconds / 2);
          this.logScale += (Math.log(bestScale(formants.f1, formants.f2)) - this.logScale) * k;
          const m = matchVowel(formants.f1, formants.f2, Math.exp(this.logScale));
          this.lastVowelPose = m.pose;
          soundClass = 'vowel';
          sound = m.code;
        }
        // Vowel shape, opened as far as the loudness allows.
        const pose = this.lastVowelPose;
        const share = TUNING.jawLoudnessShare;
        jawTarget = loud * (share + (1 - share) * Math.min(1, pose.jawOpen / 0.9));
        widthTarget = pose.lipWidth * Math.min(1, loud * 2);
        // Rounding from the vowel match only: mixing in spectral darkness raised
        // klattsch scores but made Pink Trombone's "ee" look rounded, because
        // darkness depends on the voice, not just the lips.
        roundTarget = pose.lipRound * Math.min(1, loud * 2);
      }
    }

    const tau = jawTarget > this.jaw ? s.attackSeconds : s.releaseSeconds;
    this.jaw += (jawTarget - this.jaw) * (1 - Math.exp(-dtSeconds / tau));
    const shapeK = 1 - Math.exp(-dtSeconds / 0.04);
    this.width += (widthTarget - this.width) * shapeK;
    this.round += (roundTarget - this.round) * shapeK;

    const c = normalizeControls({ jawOpen: this.jaw, lipWidth: this.width, lipRound: this.round });
    return {
      ...c,
      levelDb,
      floorDb: this.floorDb,
      peakDb: this.peakDb,
      thresholdDb,
      centroidHz,
      voiced,
      periodicity: per.value,
      pitchHz: per.pitchHz,
      f1: formants.f1,
      f2: formants.f2,
      speakerScale: Math.exp(this.logScale),
      soundClass,
      sound,
      probabilities,
    };
  }

  /** Controls only, or neutral before the first frame. */
  get controls(): FaceControls {
    return this.started ? normalizeControls({ jawOpen: this.jaw, lipWidth: this.width, lipRound: this.round }) : { ...NEUTRAL };
  }
}
