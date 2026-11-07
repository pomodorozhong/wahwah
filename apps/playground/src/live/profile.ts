// Voice profile: a short guided recording of one speaker's own sounds (through
// their own mic and room), used to read their live voice by comparison with
// themselves instead of with a textbook reference. The same idea as uLipSync's
// calibrated profiles: MFCC templates per sound, nearest-neighbour matching.

import { NEUTRAL, lerpControls, type FaceControls } from 'wahwah/performance';
import { VISEMES } from '../puppet/visemes';
import { fullCentroid, highBandRatio } from './features';
import { MFCC_COEFFS, mfcc } from './mfcc';
import { ULS, ulsMfcc } from './ulipsync';

export type ProfileClassId = 'silence' | 'AA' | 'IY' | 'UW' | 'EH' | 'OW' | 'M' | 'S' | 'SH';

export interface CalibrationStep {
  id: ProfileClassId;
  /** What to say, shown large. */
  prompt: string;
  /** A hint, shown small. */
  hint: string;
  seconds: number;
}

export const CALIBRATION_STEPS: CalibrationStep[] = [
  { id: 'silence', prompt: 'Stay quiet', hint: 'Measuring your room and microphone noise.', seconds: 2 },
  { id: 'AA', prompt: '“aaaa”', hint: 'As in “father”. Hold it steady, mouth wide open.', seconds: 2 },
  { id: 'IY', prompt: '“eeee”', hint: 'As in “see”. Smile wide.', seconds: 2 },
  { id: 'UW', prompt: '“oooo”', hint: 'As in “food”. Lips rounded and pushed forward.', seconds: 2 },
  { id: 'EH', prompt: '“eh-eh-eh”', hint: 'As in “bed”. Hold the “eh”.', seconds: 2 },
  { id: 'OW', prompt: '“ohhh”', hint: 'As in “go”. Round, half open.', seconds: 2 },
  { id: 'M', prompt: '“mmmm”', hint: 'Lips closed, humming.', seconds: 2 },
  { id: 'S', prompt: '“ssss”', hint: 'Teeth together, hissing.', seconds: 2 },
  { id: 'SH', prompt: '“shhhh”', hint: 'As in “quiet!”. Lips pushed forward.', seconds: 2 },
];

const VOWELS: ProfileClassId[] = ['AA', 'IY', 'UW', 'EH', 'OW'];
const LABEL: Record<ProfileClassId, string> = {
  silence: 'silence', AA: '“aa”', IY: '“ee”', UW: '“oo”', EH: '“eh”', OW: '“oh”', M: '“mm”', S: '“ss”', SH: '“sh”',
};

/** Ignore this much of each step while the speaker starts the sound. */
export const STEP_SETTLE_SECONDS = 0.35;
const MAX_TEMPLATES = 50;
const MIN_FRAMES = 15;

export interface FrameFeatures {
  mfcc: Float64Array;
  levelDb: number;
  /** Fraction of power above 4 kHz. */
  highRatio: number;
  /** Fraction of power above 8.5 kHz (near zero on 16 kHz-band "call" audio). */
  veryHighRatio: number;
  centroidHz: number;
  /** uLipSync-style MFCCs from the longer 64 ms window, when one was given. */
  uls?: Float64Array;
}

/**
 * @param frame  latest ~21 ms (1024 samples at 48 kHz)
 * @param longFrame  latest 64 ms (`ulsInputLength`), for the uLipSync-style features
 */
export function frameFeatures(frame: Float32Array, spectrumDb: Float32Array, sampleRate: number, longFrame?: Float32Array): FrameFeatures {
  let sum = 0;
  for (const v of frame) sum += v * v;
  return {
    uls: longFrame ? ulsMfcc(longFrame, sampleRate) : undefined,
    mfcc: mfcc(spectrumDb, sampleRate),
    levelDb: 20 * Math.log10(Math.max(Math.sqrt(sum / Math.max(1, frame.length)), 1e-7)),
    highRatio: highBandRatio(spectrumDb, sampleRate, 4000),
    veryHighRatio: highBandRatio(spectrumDb, sampleRate, 8500),
    centroidHz: fullCentroid(spectrumDb, sampleRate),
  };
}

export interface QualityMessage {
  level: 'ok' | 'warn' | 'error';
  text: string;
}

export interface ProfileClass {
  id: ProfileClassId;
  levelDb: number;
  templates: number[][];
}

export interface VoiceProfile {
  kind: 'wahwah-voice-profile';
  version: 1;
  createdAt: string;
  sampleRate: number;
  noiseFloorDb: number;
  vowelLevelDb: number;
  /** Per-coefficient mean and spread used to standardize MFCCs. */
  mean: number[];
  std: number[];
  classes: ProfileClass[];
  /** Live settings derived from the recording. */
  suggested: { gateDb: number; rangeDb: number };
  /** uLipSync-style profile: the average MFCC of each sound (absent in older profiles). */
  uls?: { prototypes: Partial<Record<ProfileClassId, number[]>> };
  quality: { messages: QualityMessage[]; accuracy: Partial<Record<ProfileClassId, number>> };
}

const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Collects frames during the guided recording, then builds a profile. */
export class Calibration {
  readonly frames = new Map<ProfileClassId, FrameFeatures[]>();

  /** Forget a step's frames (to record it again). */
  clear(id: ProfileClassId): void {
    this.frames.delete(id);
  }

  /** Add a frame recorded `secondsIntoStep` after the step's prompt began. */
  add(id: ProfileClassId, f: FrameFeatures, secondsIntoStep: number): void {
    if (secondsIntoStep < STEP_SETTLE_SECONDS) return;
    if (!this.frames.has(id)) this.frames.set(id, []);
    this.frames.get(id)!.push(f);
  }

  build(sampleRate: number): VoiceProfile {
    const messages: QualityMessage[] = [];
    const silence = this.frames.get('silence') ?? [];
    // Clamped like the live estimator: digital silence (-140 dB) is not a real room.
    const noiseFloorDb = Math.max(-90, silence.length ? median(silence.map((f) => f.levelDb)) : -70);
    // Keep frames clearly above the noise: the speaker may start late or stop early.
    const active = (id: ProfileClassId) =>
      id === 'silence' ? silence : (this.frames.get(id) ?? []).filter((f) => f.levelDb > noiseFloorDb + 10);

    const classes: { id: ProfileClassId; frames: FrameFeatures[] }[] = [];
    for (const step of CALIBRATION_STEPS) {
      const frames = active(step.id);
      if (frames.length < MIN_FRAMES) {
        messages.push({
          level: step.id === 'silence' ? 'warn' : 'error',
          text:
            step.id === 'silence'
              ? 'Too little quiet was recorded to measure the room noise.'
              : `Not enough of your ${LABEL[step.id]} was heard (${frames.length} usable frames). Try again a little louder or closer to the mic.`,
        });
        if (step.id !== 'silence') continue;
      }
      if (frames.length) classes.push({ id: step.id, frames: thin(frames, MAX_TEMPLATES) });
    }

    // Standardize each coefficient over all templates, every class weighted equally.
    const mean = new Array(MFCC_COEFFS).fill(0);
    const std = new Array(MFCC_COEFFS).fill(0);
    for (const c of classes) for (const f of c.frames) f.mfcc.forEach((v, i) => (mean[i] += v / (c.frames.length * classes.length)));
    for (const c of classes) for (const f of c.frames) f.mfcc.forEach((v, i) => (std[i] += (v - mean[i]) ** 2 / (c.frames.length * classes.length)));
    for (let i = 0; i < MFCC_COEFFS; i++) std[i] = Math.sqrt(std[i]) || 1;

    const levels = Object.fromEntries(classes.map((c) => [c.id, median(c.frames.map((f) => f.levelDb))])) as Record<ProfileClassId, number>;
    const vowelLevels = VOWELS.map((v) => levels[v]).filter((x) => Number.isFinite(x));
    // Signal-to-noise from the raw vowel steps, so a voice drowned by noise
    // (all frames rejected above) is still measured and reported.
    const rawVowel = median(VOWELS.flatMap((v) => (this.frames.get(v) ?? []).map((f) => f.levelDb)));
    const vowelLevelDb = vowelLevels.length ? median(vowelLevels) : Number.isFinite(rawVowel) ? rawVowel : noiseFloorDb + 30;
    const snr = (Number.isFinite(rawVowel) ? rawVowel : vowelLevelDb) - noiseFloorDb;
    const gateDb = Math.round(clamp(snr * 0.25, 4, 16));
    const rangeDb = Math.round(clamp(snr - gateDb + 3, 12, 45));

    const profile: VoiceProfile = {
      kind: 'wahwah-voice-profile',
      version: 1,
      createdAt: new Date().toISOString(),
      sampleRate,
      noiseFloorDb,
      vowelLevelDb,
      mean,
      std,
      classes: classes.map((c) => ({ id: c.id, levelDb: levels[c.id], templates: c.frames.map((f) => Array.from(f.mfcc)) })),
      suggested: { gateDb, rangeDb },
      quality: { messages, accuracy: {} },
    };

    // uLipSync-style prototypes: the mean 64 ms MFCC of each recorded sound
    // (uLipSync averages its last 16 calibration frames; this averages all of them).
    const prototypes: Partial<Record<ProfileClassId, number[]>> = {};
    for (const c of classes) {
      const ulsFrames = c.frames.map((f) => f.uls).filter((u): u is Float64Array => !!u);
      if (ulsFrames.length < MIN_FRAMES / 2) continue;
      const mean = new Array(ULS.mfccNum).fill(0);
      for (const u of ulsFrames) u.forEach((v, i) => (mean[i] += v / ulsFrames.length));
      prototypes[c.id] = mean;
    }
    if (Object.keys(prototypes).length >= 2) profile.uls = { prototypes };

    // Input checks.
    if (snr < 15) messages.unshift({ level: 'warn', text: `Your voice is only ${snr.toFixed(0)} dB above the room noise. Move closer to the mic or somewhere quieter.` });
    const s = this.frames.get('S') && active('S');
    if (s && s.length >= MIN_FRAMES) {
      const hi = median(s.map((f) => f.highRatio));
      if (hi < 0.3) {
        messages.push({
          level: 'warn',
          text: `Your “ss” has little energy above 4 kHz (${(hi * 100).toFixed(0)}%). The mic seems to cut high frequencies (telephone-quality audio, e.g. some Bluetooth headsets in call mode), so “s” will be hard to spot.`,
        });
      } else if (median(s.map((f) => f.veryHighRatio)) < 0.005) {
        messages.push({
          level: 'ok',
          text: 'Your mic seems limited to about 8 kHz (common for Bluetooth headsets with the mic on). “s” is still recognizable.',
        });
      }
    }
    if (Number.isFinite(levels.M) && vowelLevelDb - levels.M < 4) {
      messages.push({ level: 'ok', text: `Your “mm” is about as loud as your vowels; closed lips are recognized by sound shape alone.` });
    }

    // How well each sound is recognized from the others (leave-one-out).
    const accuracy: Partial<Record<ProfileClassId, number>> = {};
    const confusions: [ProfileClassId, ProfileClassId, number][] = [];
    for (const c of profile.classes) {
      const counts = new Map<ProfileClassId, number>();
      c.templates.forEach((t, i) => {
        const probs = classify(profile, Float64Array.from(t), { exclude: { id: c.id, index: i } });
        const best = argmax(probs);
        counts.set(best, (counts.get(best) ?? 0) + 1);
      });
      accuracy[c.id] = (counts.get(c.id) ?? 0) / c.templates.length;
      for (const [other, n] of counts) if (other !== c.id && n / c.templates.length > 0.25) confusions.push([c.id, other, n / c.templates.length]);
    }
    profile.quality.accuracy = accuracy;
    for (const [a, b, share] of confusions) {
      messages.push({ level: 'warn', text: `${LABEL[a]} was mistaken for ${LABEL[b]} ${(share * 100).toFixed(0)}% of the time. Exaggerate the difference and record again.` });
    }
    const mean01 = Object.values(accuracy).reduce((x, y) => x + (y ?? 0), 0) / Math.max(1, Object.keys(accuracy).length);
    if (!messages.some((m) => m.level !== 'ok')) messages.unshift({ level: 'ok', text: `All ${profile.classes.length} sounds are clearly distinct (${(mean01 * 100).toFixed(0)}% recognized).` });
    return profile;
  }
}

/** Evenly spaced subset. */
function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

export function argmax(probs: Partial<Record<ProfileClassId, number>>): ProfileClassId {
  let best: ProfileClassId = 'silence';
  let bestP = -1;
  for (const [id, p] of Object.entries(probs) as [ProfileClassId, number][]) {
    if (p > bestP) {
      bestP = p;
      best = id;
    }
  }
  return best;
}

/**
 * k-nearest-neighbour match of one frame's MFCCs against the profile's
 * templates, in standardized units. Returns a probability per sound.
 */
export function classify(
  profile: VoiceProfile,
  coeffs: Float64Array,
  opts: { k?: number; exclude?: { id: ProfileClassId; index: number } } = {},
): Partial<Record<ProfileClassId, number>> {
  const k = opts.k ?? 9;
  const z = Array.from(coeffs, (v, i) => (v - profile.mean[i]) / profile.std[i]);
  const near: { id: ProfileClassId; d: number }[] = [];
  for (const c of profile.classes) {
    c.templates.forEach((t, idx) => {
      if (opts.exclude && opts.exclude.id === c.id && opts.exclude.index === idx) return;
      let d = 0;
      for (let i = 0; i < z.length; i++) d += (z[i] - (t[i] - profile.mean[i]) / profile.std[i]) ** 2;
      near.push({ id: c.id, d });
    });
  }
  near.sort((a, b) => a.d - b.d);
  const probs: Partial<Record<ProfileClassId, number>> = {};
  let total = 0;
  for (const { id, d } of near.slice(0, k)) {
    const w = 1 / (Math.sqrt(d) + 0.1);
    probs[id] = (probs[id] ?? 0) + w;
    total += w;
  }
  for (const id of Object.keys(probs) as ProfileClassId[]) probs[id]! /= total;
  return probs;
}

/** The mouth pose for a profile sound. */
export function classPose(id: ProfileClassId): FaceControls {
  return id === 'silence' ? { ...NEUTRAL } : VISEMES[id].pose;
}

/** Blend vowel poses by their probabilities (vowels only, renormalized). */
export function vowelPose(probs: Partial<Record<ProfileClassId, number>>): FaceControls | null {
  let wsum = 0;
  let pose: FaceControls = { ...NEUTRAL };
  for (const id of VOWELS) {
    const p = probs[id] ?? 0;
    if (p <= 0) continue;
    wsum += p;
    pose = lerpControls(pose, classPose(id), p / wsum);
  }
  return wsum > 0 ? pose : null;
}

export const isVowel = (id: ProfileClassId) => VOWELS.includes(id);

export function serializeProfile(p: VoiceProfile): string {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return JSON.stringify({
    ...p,
    mean: p.mean.map(round),
    std: p.std.map(round),
    classes: p.classes.map((c) => ({ ...c, templates: c.templates.map((t) => t.map(round)) })),
    uls: p.uls && { prototypes: Object.fromEntries(Object.entries(p.uls.prototypes).map(([k, v]) => [k, v!.map(round)])) },
  });
}

/** Parse and sanity-check a saved profile; throws with a readable message. */
export function parseProfile(text: string): VoiceProfile {
  const p = JSON.parse(text) as VoiceProfile;
  // Profiles saved before the rename to wahwah carry the old kind.
  if ((p?.kind as string) === 'mumble-voice-profile') p.kind = 'wahwah-voice-profile';
  if (p?.kind !== 'wahwah-voice-profile' || p.version !== 1) throw new Error('Not a wahwah voice profile (version 1).');
  if (!Array.isArray(p.classes) || p.mean?.length !== MFCC_COEFFS || p.std?.length !== MFCC_COEFFS) throw new Error('The profile is incomplete.');
  for (const c of p.classes) {
    if (!c.templates.every((t) => Array.isArray(t) && t.length === MFCC_COEFFS && t.every(Number.isFinite))) throw new Error(`Sound ${c.id} has bad data.`);
  }
  if (p.uls) {
    for (const [id, v] of Object.entries(p.uls.prototypes)) {
      if (!Array.isArray(v) || v.length !== ULS.mfccNum || !v.every(Number.isFinite)) throw new Error(`uLipSync data for ${id} is bad.`);
    }
  }
  return p;
}
