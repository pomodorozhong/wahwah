import { type FaceControls } from 'wahwah/performance';

export type MonitorSeries = 'jaw' | 'width' | 'round' | 'level' | 'speed' | 'reached' | 'fade';

/** Colors and dashes for every plotted signal; the chips above the plot use the same colors. */
// The monitor is light, so these are darker versions of the first dark-monitor colors.
export const MONITOR_SERIES: Record<MonitorSeries, { color: string; dash: readonly number[] }> = {
  jaw: { color: '#29261e', dash: [] },
  width: { color: '#2f7d73', dash: [6, 3] },
  round: { color: '#a8760f', dash: [1, 3] },
  level: { color: '#e0b84f', dash: [] },
  speed: { color: '#3f8a2c', dash: [] },
  reached: { color: '#6f57bd', dash: [3, 3] },
  fade: { color: '#cf6a1c', dash: [] },
};

// Width and Round stay off at first so the jaw, level and fit curves read clearly.
const shown = new Set<MonitorSeries>(['jaw', 'level', 'speed', 'fade']);
export const monitorSeriesOn = (key: MonitorSeries): boolean => shown.has(key);
export function setMonitorSeries(key: MonitorSeries, on: boolean): void {
  if (on) shown.add(key); else shown.delete(key);
}

const FACE_SERIES: readonly [keyof FaceControls, MonitorSeries][] = [['jawOpen', 'jaw'], ['lipWidth', 'width'], ['lipRound', 'round']];

/** The mouth signals the chips currently show, with their colors and dashes. */
export function visibleFaceSignals(): [keyof FaceControls, string, readonly number[]][] {
  return FACE_SERIES.filter(([, key]) => shown.has(key)).map(([control, key]) => [control, MONITOR_SERIES[key].color, MONITOR_SERIES[key].dash]);
}

export const MONITOR_COLORS = {
  background: '#fbf1cf',
  fill: '#e0b84f99',
  foreground: '#29261e',
  labels: '#6e5f38',
  grid: '#e3d29c',
  floor: '#8f8260',
  threshold: '#b8871c',
  /** The part of a line the cut removed. */
  removed: '#efe2b8',
};

/** Lay out the shared time-series plot below its phoneme band and above its time axis. */
export function beginMonitor(g: CanvasRenderingContext2D, w: number, h: number, axis = false): { top: number; bottom: number } {
  const top = h < 60 ? 12 : 16;
  const bottom = h - (axis ? 14 : 4);
  g.setLineDash([]);
  g.lineCap = 'butt';
  g.clearRect(0, 0, w, h);
  g.fillStyle = MONITOR_COLORS.background;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = MONITOR_COLORS.grid;
  g.lineWidth = 0.5;
  g.beginPath();
  for (const fraction of [0.25, 0.5, 0.75]) {
    const y = top + fraction * (bottom - top);
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
  g.stroke();
  return { top, bottom };
}

export function drawMonitorPlayhead(g: CanvasRenderingContext2D, x: number, h: number): void {
  g.setLineDash([]);
  g.strokeStyle = MONITOR_COLORS.foreground;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, h);
  g.stroke();
  g.fillStyle = MONITOR_COLORS.foreground;
  g.beginPath();
  g.moveTo(x - 3, 0);
  g.lineTo(x + 3, 0);
  g.lineTo(x, 5);
  g.fill();
}
