import type { FaceControls } from '../puppet/controls';

// Match the line samples and meter colors to the signal they represent.
export const MONITOR_SIGNALS: readonly [keyof FaceControls, string, readonly number[]][] = [
  ['jawOpen', '#fff2ca', []],
  ['lipWidth', '#79b6ad', [6, 3]],
  ['lipRound', '#e4ba55', [1, 3]],
];

export const MONITOR_COLORS = {
  fill: '#c8a03b73',
  foreground: '#fff2ca',
  labels: '#d8caa8',
  grid: '#655a3a',
  floor: '#998c6b',
  threshold: '#e4ba55',
};

/** Lay out the shared time-series plot between its phoneme and legend bands. */
export function beginMonitor(g: CanvasRenderingContext2D, w: number, h: number): { top: number; bottom: number } {
  const top = h < 60 ? 12 : 16;
  const bottom = h - 14;
  g.setLineDash([]);
  g.lineCap = 'butt';
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#302d24';
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

export function drawMonitorLegend(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.font = '10px system-ui, sans-serif';
  g.textBaseline = 'middle';
  let x = 4;
  const labels = ['Jaw', 'Width', 'Round'];
  for (const [i, [, color, dash]] of MONITOR_SIGNALS.entries()) {
    const label = labels[i];
    if (x + 20 + g.measureText(label).width > w) break;
    g.strokeStyle = color;
    g.lineWidth = 1.8;
    g.lineCap = 'round';
    g.setLineDash([...dash]);
    g.beginPath();
    g.moveTo(x, h - 6);
    g.lineTo(x + 13, h - 6);
    g.stroke();
    g.fillStyle = MONITOR_COLORS.labels;
    g.fillText(label, x + 18, h - 6);
    x += 18 + g.measureText(label).width + 14;
  }
  g.setLineDash([]);
  g.lineCap = 'butt';
  g.fillStyle = '#c8a03b';
  if (x + 50 < w) {
    g.fillRect(x, h - 10, 10, 7);
    g.fillStyle = MONITOR_COLORS.labels;
    g.fillText('Level', x + 15, h - 6);
  }
}

export function drawMonitorPlayhead(g: CanvasRenderingContext2D, x: number, h: number): void {
  g.setLineDash([]);
  g.strokeStyle = MONITOR_COLORS.foreground;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, h - 13);
  g.stroke();
  g.fillStyle = MONITOR_COLORS.foreground;
  g.beginPath();
  g.moveTo(x - 3, 0);
  g.lineTo(x + 3, 0);
  g.lineTo(x, 5);
  g.fill();
}
