// Pink Trombone (pink-trombone-mod) as an articulatory "second speaker": it
// renders vowels from tongue and lip positions rather than formant tables, so
// it tests the live analyzer on a voice it was not tuned on, and provides a
// vowel-sweep test signal for the live page.

import { Synthesizer } from 'pink-trombone-mod/Synthesizer.js';

export interface TractConfig {
  /** Tongue position along the tract: ~12 back (pharynx) .. ~29 front (palate). */
  tongueIndex: number;
  /** Tract diameter at the tongue: ~2.05 constricted .. 3.5 open. */
  tongueDiameter: number;
  /** Lip opening diameter: small = rounded, 1.5 = relaxed open, 0 = closed. */
  lipDiameter: number;
  /** Open the velum so air flows through the nose (m, n). */
  nasal?: boolean;
}

/**
 * Tract shapes whose measured formants (LPC, 130 Hz voice) land near the
 * English vowels: ah ≈ 760/1160 Hz, ee ≈ 300/2010, oo ≈ 310/750, eh ≈ 500/2220.
 */
export const PT_VOWELS: Record<'AA' | 'IY' | 'UW' | 'EH', TractConfig> = {
  AA: { tongueIndex: 16.3, tongueDiameter: 2.29, lipDiameter: 1.5 },
  IY: { tongueIndex: 24.8, tongueDiameter: 2.05, lipDiameter: 1.5 },
  UW: { tongueIndex: 20.5, tongueDiameter: 2.29, lipDiameter: 0.5 },
  EH: { tongueIndex: 29, tongueDiameter: 3.02, lipDiameter: 1.5 },
};

/** Lips closed with the velum open: the hum of an "m". */
export const PT_M: TractConfig = { tongueIndex: 20, tongueDiameter: 2.8, lipDiameter: 0, nasal: true };

export interface SweepStep {
  /** Tract shape to move toward, or null for silence. */
  config: TractConfig | null;
  seconds: number;
}

function createSynth(sampleRate: number, pitchHz: number): Synthesizer {
  const synth = new Synthesizer(sampleRate);
  synth.glottis.autoWobble = false;
  synth.glottis.targetFrequency = pitchHz;
  synth.glottis.targetTenseness = 0.6;
  return synth;
}

function setTarget(synth: Synthesizer, config: TractConfig, immediate: boolean): void {
  const shaper = synth.tractShaper;
  const tract = synth.tract;
  shaper.tongueIndex = config.tongueIndex;
  shaper.tongueDiameter = config.tongueDiameter;
  shaper.velumTarget = config.nasal ? shaper.velumOpenTarget : shaper.velumClosedTarget;
  for (let i = 0; i < tract.n; i++) {
    const d = i >= tract.lipStart ? config.lipDiameter : shaper.getRestDiameter(i);
    shaper.targetDiameter[i] = d;
    if (immediate) tract.diameter[i] = d;
  }
}

/** A sequence of tract shapes; the tract glides between them at Pink Trombone's own speed. */
export function renderSweep(steps: SweepStep[], sampleRate = 48000, pitchHz = 130): Float32Array {
  const synth = createSynth(sampleRate, pitchHz);
  const first = steps.find((s) => s.config)?.config;
  if (first) setTarget(synth, first, true);
  synth.reset();
  const total = Math.round(steps.reduce((t, s) => t + s.seconds, 0) * sampleRate);
  const out = new Float32Array(total);
  let pos = 0;
  for (const step of steps) {
    const n = Math.min(total - pos, Math.round(step.seconds * sampleRate));
    synth.glottis.alwaysVoice = step.config !== null;
    if (step.config) setTarget(synth, step.config, false);
    synth.synthesize(out.subarray(pos, pos + n));
    pos += n;
  }
  return out;
}

/** A steady vowel. */
export function renderTract(config: TractConfig, sampleRate = 48000, seconds = 0.5, pitchHz = 130): Float32Array {
  return renderSweep([{ config, seconds }], sampleRate, pitchHz);
}
