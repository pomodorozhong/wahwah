// A stacked plot of everything that changes while a line is fitted to a maximum duration:
// speed, the source time reached, the fade volume, the audio that results, and the mouth.
import type { DurationFit, FaceControlTrack, FitOptions, SpeedProfile } from 'wahwah/performance';
import { fitCanvas } from './puppetView';

export interface FadePlotData {
  audio: Float32Array;
  sampleRate: number;
  capSeconds: number;
  fit: DurationFit | null | undefined;
  options: FitOptions;
  track: FaceControlTrack | null;
}

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

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function drawFadePlot(canvas: HTMLCanvasElement, d: FadePlotData): void {
  const { g, w, h } = fitCanvas(canvas);
  if (!w || !h) return;
  const text = css('--text'), muted = css('--muted'), line = css('--line');
  const end = Math.max(d.audio.length / d.sampleRate, 0.01);
  const truncated = !!d.fit?.truncated;
  const fade = d.options.cutFade ?? {};
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
  const speedNow = (t: number) => speedAt(profile, peak, along(t));
  const left = 46, right = 8, top = 6, bottom = 18;
  const gap = 6;
  const panels = 5;
  const ph = (h - top - bottom - gap * (panels - 1)) / panels;
  const x = (s: number) => left + (s / end) * (w - left - right);
  const y = (i: number) => top + i * (ph + gap);

  const atWord = !!d.fit?.atWord;
  const cutAt = d.fit?.cutSeconds ?? d.capSeconds;
  const fadeSeconds = truncated && fade.curve !== 'none' ? Math.min((fade.milliseconds ?? 80) / 1000, end) : 0;
  const fadeStart = end - fadeSeconds;

  g.font = '10px system-ui, sans-serif';
  const panel = (i: number, label: string, lo: number, hi: number, fmt: (v: number) => string) => {
    const y0 = y(i);
    g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(left + 0.5, y0 + 0.5, w - left - right - 1, ph - 1);
    g.fillStyle = muted; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText(fmt(hi), left - 4, y0);
    g.textBaseline = 'bottom'; g.fillText(fmt(lo), left - 4, y0 + ph);
    g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = text; g.fillText(label, left + 4, y0 + 2);
    return (v: number) => y0 + ph - ((v - lo) / (hi - lo)) * ph;
  };
  const path = (fn: (t: number) => number, py: (v: number) => number, color: string, fill = false) => {
    const n = Math.max(2, Math.floor(w - left - right));
    g.beginPath();
    for (let k = 0; k <= n; k++) { const s = (k / n) * end; g[k ? 'lineTo' : 'moveTo'](x(s), py(fn(s))); }
    g.strokeStyle = color; g.lineWidth = 2; g.stroke();
    if (fill) { g.lineTo(x(end), py(0)); g.lineTo(x(0), py(0)); g.closePath(); g.globalAlpha = 0.2; g.fillStyle = color; g.fill(); g.globalAlpha = 1; }
  };

  // 1. Speed
  const pSpeed = panel(0, 'Speed', 1, Math.max(1.2, peak * 1.05), (v) => `×${v.toFixed(1)}`);
  path(speedNow, pSpeed, css('--jaw'));
  // 2. Source time reached
  const reach = (t: number) => along(t) * natural;
  const pSrc = panel(1, 'Line reached', 0, Math.max(natural, end), (v) => `${v.toFixed(1)} s`);
  path(reach, pSrc, css('--round'));
  if (truncated) { g.setLineDash([3, 3]); g.strokeStyle = muted; g.beginPath(); g.moveTo(x(0), pSrc(natural)); g.lineTo(x(end), pSrc(natural)); g.stroke(); g.setLineDash([]); }
  // 3. Fade volume
  const volume = d.options.volume ?? {};
  const pGain = panel(2, 'Volume (shape × fade)', 0, Math.max(1, volume.level ?? 1), (v) => `${Math.round(v * 100)}%`);
  path((s) => volumeGain(volume, s / end) * (s < fadeStart || fadeSeconds === 0 ? 1 : fadeGain(fade, (s - fadeStart) / fadeSeconds)), pGain, css('--width'), true);
  if (!truncated) {
    const cutBelow = fastestDuration(profile, d.options.speedUp?.max ?? 1.6, natural);
    g.fillStyle = text; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`No fade: this line is not cut. Set the cap below ${cutBelow.toFixed(1)} s to cut it.`, (left + w - right) / 2, y(2) + ph / 2);
  }
  // 4. Audio peak per column
  const pAudio = panel(3, 'Audio level', 0, 1, (v) => v.toFixed(1));
  const cols = Math.floor(w - left - right);
  const per = d.audio.length / cols;
  g.fillStyle = css('--level');
  for (let c = 0; c < cols; c++) {
    let peak = 0;
    for (let i = Math.floor(c * per), e = Math.min(d.audio.length, Math.floor((c + 1) * per)); i < e; i++) peak = Math.max(peak, Math.abs(d.audio[i]));
    const yy = pAudio(Math.min(1, peak));
    g.fillRect(left + c, yy, 1, pAudio(0) - yy);
  }
  // 5. Mouth
  const pJaw = panel(4, 'Mouth open', 0, 1, (v) => v.toFixed(1));
  if (d.track?.samples.length) {
    g.beginPath();
    d.track.samples.forEach((sample, k) => { g[k ? 'lineTo' : 'moveTo'](x(Math.min(sample.timeSeconds, end)), pJaw(sample.jawOpen)); });
    g.strokeStyle = css('--jaw'); g.lineWidth = 1.5; g.stroke();
  }

  // Markers across every panel
  g.setLineDash([4, 3]); g.lineWidth = 1;
  const marker = (s: number, color: string) => { g.strokeStyle = color; g.beginPath(); g.moveTo(x(s), top); g.lineTo(x(s), y(panels - 1) + ph); g.stroke(); };
  if (fadeSeconds > 0) marker(fadeStart, css('--width'));
  if (truncated || d.fit) marker(Math.min(d.capSeconds, end), text);
  if (atWord) marker(Math.min(cutAt, end), css('--round'));
  g.setLineDash([]);

  // Time axis
  g.fillStyle = muted; g.textBaseline = 'top'; g.textAlign = 'center';
  const step = end > 8 ? 2 : end > 3 ? 1 : 0.5;
  for (let s = 0; s <= end + 1e-6; s += step) g.fillText(`${s.toFixed(step < 1 ? 1 : 0)} s`, x(s), y(panels - 1) + ph + 3);
}
