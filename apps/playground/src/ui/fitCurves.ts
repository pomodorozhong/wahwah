// The curves that change while a line is fitted to a maximum duration (speed, how much
// of the line has played, and the fade volume), for the playback monitor to draw.
import type { DurationFit, FaceControlTrack, FitOptions, SpeedProfile } from 'wahwah/performance';

/** The same curves as the Rust core, for display. t runs 0 to 1 across the fade. */
export function fadeGain(fade: NonNullable<FitOptions['cutFade']>, t: number): number {
  let g: number;
  switch (fade.curve) {
    case 'none': return 1;
    case 'smooth': g = 0.5 * (1 + Math.cos(Math.PI * t)); break;
    case 'quick': g = (1 - t) * (1 - t); break;
    case 'decibel': g = (10 ** (-3 * t) - 0.001) / 0.999; break;
    default: g = 1 - t;
  }
  g **= fade.exponent ?? 1;
  const end = fade.endVolume ?? 0;
  return end + (1 - end) * g;
}

/** The gain of the volume shape `u` of the way along the line, as in the Rust core. */
export function volumeGain(volume: NonNullable<FitOptions['volume']>, u: number): number {
  return 1 + ((volume.level ?? 1) - 1) * shape(volume.profile, u);
}

const shape = (profile: SpeedProfile | undefined, u: number) =>
  profile === 'rampUp' ? u : profile === 'rampDown' ? 1 - u : profile === 'smooth' ? u * u * (3 - 2 * u) : 1;

/** Speed at u (0 to 1) along the line, as in the Rust core. */
export const speedAt = (profile: SpeedProfile | undefined, peak: number, u: number) => 1 + (peak - 1) * shape(profile, u);

/** The shortest a line can get with the speed-up alone. */
export function fastestDuration(profile: SpeedProfile | undefined, max: number, natural: number): number {
  if (!profile || profile === 'constant') return natural / max;
  let t = 0;
  const n = 400;
  for (let i = 0; i < n; i++) t += natural / n / speedAt(profile, max, (i + 0.5) / n);
  return t;
}

/** A line fitted to a maximum duration, and the rest of the line that the cut removed. */
export interface FitPlotData {
  /** Output length of the fitted line. */
  seconds: number;
  capSeconds: number;
  fit: DurationFit | null | undefined;
  options: FitOptions;
  /** The uncapped line, its times already moved onto the fitted line's sped-up clock. */
  tail: { envelope: { t: number; v: number }[]; track: FaceControlTrack | null; seconds: number } | null;
}

export interface FitCurves {
  /** Speed at output time t, from 1 to `peak`. */
  speed: (t: number) => number;
  peak: number;
  /** Fraction of the original line reached at output time t. */
  reached: (t: number) => number;
  /** Volume shape times the fade at output time t. */
  gain: (t: number) => number;
  maxGain: number;
  fadeStart: number | null;
  cutAt: number | null;
  /** Output time at which the original line's time `s` would play, for the cut tail. */
  outputTime: (s: number) => number;
}

export function fitCurves(d: FitPlotData): FitCurves {
  const end = Math.max(d.seconds, 0.01);
  const truncated = !!d.fit?.truncated;
  const fade = d.options.cutFade ?? {};
  const volume = d.options.volume ?? {};
  const profile = d.options.speedUp?.profile;
  const peak = d.fit?.peakSpeed ?? 1;
  const natural = d.fit?.naturalSeconds ?? end;
  // Output time against source time, for any speed shape.
  const steps = 400;
  const outAt: number[] = [0];
  for (let i = 0; i < steps; i++) outAt.push(outAt[i] + natural / steps / speedAt(profile, peak, (i + 0.5) / steps));
  const along = (t: number) => {
    let i = 1;
    while (i < steps && outAt[i] < t) i++;
    const span = outAt[i] - outAt[i - 1] || 1;
    return Math.min(1, Math.max(0, (i - 1 + (t - outAt[i - 1]) / span) / steps));
  };
  const outputTime = (s: number) => {
    const u = Math.min(1, Math.max(0, s / natural)) * steps;
    const i = Math.min(steps - 1, Math.floor(u));
    return outAt[i] + (outAt[i + 1] - outAt[i]) * (u - i);
  };
  const fadeSeconds = truncated && fade.curve !== 'none' ? Math.min((fade.milliseconds ?? 80) / 1000, end) : 0;
  const fadeStart = end - fadeSeconds;
  return {
    speed: (t) => speedAt(profile, peak, along(t)),
    peak,
    reached: along,
    gain: (t) => volumeGain(volume, Math.min(1, t / end)) * (t < fadeStart || fadeSeconds === 0 ? 1 : fadeGain(fade, (t - fadeStart) / fadeSeconds)),
    maxGain: Math.max(1, volume.level ?? 1),
    fadeStart: fadeSeconds > 0 ? fadeStart : null,
    cutAt: truncated ? (d.fit?.cutSeconds ?? end) : null,
    outputTime,
  };
}
