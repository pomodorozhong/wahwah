// Puppet instruction format. Host-agnostic: no Three.js types here.

/**
 * All controls are animation values in [0, 1], not physical measurements.
 * - jawOpen:  0 = closed (lips touching), 1 = fully open.
 * - lipWidth: 0 = relaxed, 1 = wide/spread (as in "ee").
 * - lipRound: 0 = unrounded, 1 = fully rounded/protruded (as in "oo").
 * Width and rounding pull against each other; the generator guarantees
 * lipWidth + lipRound <= 1, so a host can treat (lipWidth - lipRound) as a
 * single spread-vs-pucker axis if it wants.
 * Neutral (all zero) is a relaxed, closed mouth.
 */
export interface FaceControls {
  jawOpen: number;
  lipWidth: number;
  lipRound: number;
}

export interface FaceControlSample extends FaceControls {
  /** Seconds relative to the utterance's playback start. */
  timeSeconds: number;
  /** ARPABET code of the sound active at this time, or null. Informational. */
  phoneme: string | null;
}

export interface FaceControlTrack {
  sampleRateHz: number;
  durationSeconds: number;
  samples: FaceControlSample[];
}

export const NEUTRAL: Readonly<FaceControls> = Object.freeze({ jawOpen: 0, lipWidth: 0, lipRound: 0 });

export const CONTROL_RANGES = {
  jawOpen: [0, 1],
  lipWidth: [0, 1],
  lipRound: [0, 1],
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Clamp to range and enforce lipWidth + lipRound <= 1 (rounding wins). */
export function normalizeControls(c: FaceControls): FaceControls {
  const jawOpen = clamp01(c.jawOpen);
  const lipRound = clamp01(c.lipRound);
  const lipWidth = Math.min(clamp01(c.lipWidth), 1 - lipRound);
  return { jawOpen, lipWidth, lipRound };
}

export function lerpControls(a: FaceControls, b: FaceControls, t: number): FaceControls {
  return {
    jawOpen: a.jawOpen + (b.jawOpen - a.jawOpen) * t,
    lipWidth: a.lipWidth + (b.lipWidth - a.lipWidth) * t,
    lipRound: a.lipRound + (b.lipRound - a.lipRound) * t,
  };
}
