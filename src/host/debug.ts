// Debug puppet: a second host that draws only the instructions. A schematic
// mouth shows each control's value; arrows show where each control is moving
// (solid: velocity) and how hard it is being pushed (outlined: force).

import type { FaceMotion, Channel } from '../puppet/motion';

const COLORS: Record<Channel, string> = { jawOpen: '#ff8a5c', lipWidth: '#7ee081', lipRound: '#d68cff' };
const LABELS: Record<Channel, string> = { jawOpen: 'jaw', lipWidth: 'width', lipRound: 'round' };
/** Pixels per unit/s for velocity arrows and per unit/s² for force arrows. */
const VELOCITY_PX = 45;
const FORCE_PX = 1.6;
const MAX_ARROW = 150;

export class DebugPuppet {
  readonly canvas = document.createElement('canvas');
  private readonly ghosts: { w: number; h: number; r: number }[] = [];

  constructor(container: HTMLElement) {
    this.canvas.className = 'debug-puppet';
    container.appendChild(this.canvas);
  }

  set visible(v: boolean) {
    this.canvas.hidden = !v;
  }

  render(motion: FaceMotion, puppetEnabled: boolean): void {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2230';
    g.fillRect(0, 0, W, H);

    const scale = Math.min(W / 520, (H - 110) / 340, 1.6);
    const cx = W / 2;
    const cy = (H - 100) / 2;
    const jaw = motion.jawOpen.value;
    const wide = motion.lipWidth.value;
    const round = motion.lipRound.value;
    // Mouth schematic: width spreads the lips and rounding narrows them.
    const halfW = (60 + 60 * wide - 50 * round) * scale;
    const top = (6 + 10 * jaw) * scale;
    const bottom = (6 + 120 * jaw) * scale;
    const ring = (24 + 30 * round) * scale;

    // Fading ghosts of recent shapes show the path the mouth took.
    this.ghosts.push({ w: halfW, h: bottom, r: round });
    if (this.ghosts.length > 12) this.ghosts.shift();
    this.ghosts.forEach((gh, i) => {
      g.strokeStyle = `rgba(230,233,240,${0.03 + (i / this.ghosts.length) * 0.08})`;
      g.lineWidth = 1;
      ellipse(g, cx, cy + (gh.h - top) / 2, gh.w, (gh.h + top) / 2);
      g.stroke();
    });

    g.strokeStyle = puppetEnabled ? '#e6e9f0' : '#4a5168';
    g.lineWidth = 2;
    ellipse(g, cx, cy + (bottom - top) / 2, halfW, (bottom + top) / 2);
    g.stroke();
    // Rounding ring: grows as the lips protrude.
    g.setLineDash([4, 4]);
    g.strokeStyle = COLORS.lipRound;
    g.globalAlpha = 0.35 + 0.65 * round;
    ellipse(g, cx, cy + (bottom - top) / 2, ring, ring * 0.8);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    if (!puppetEnabled) {
      label(g, cx, cy - 40 * scale, 'puppet output off', '#8a93a8', 'center');
    } else {
      // Jaw: vertical, from the bottom lip. Down = opening.
      arrowPair(g, cx, cy + bottom + 6, 0, 1, motion.jawOpen.velocity, motion.jawOpen.force, COLORS.jawOpen);
      // Width: horizontal, from both corners. Outward = widening.
      const midY = cy + (bottom - top) / 2;
      arrowPair(g, cx + halfW + 6, midY, 1, 0, motion.lipWidth.velocity, motion.lipWidth.force, COLORS.lipWidth);
      arrowPair(g, cx - halfW - 6, midY, -1, 0, motion.lipWidth.velocity, motion.lipWidth.force, COLORS.lipWidth);
      // Round: diagonal, out from the ring. Outward = rounding/protruding.
      const d = Math.SQRT1_2;
      arrowPair(g, cx + ring * d, midY - ring * 0.8 * d, d, -d, motion.lipRound.velocity, motion.lipRound.force, COLORS.lipRound);
    }

    this.drawTable(g, motion, W, H);
  }

  private drawTable(g: CanvasRenderingContext2D, motion: FaceMotion, W: number, H: number): void {
    const y0 = H - 92;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, y0 - 8, W, 100);
    g.font = '11px ui-monospace, monospace';
    g.textBaseline = 'middle';
    label(g, 12, y0 + 2, 'solid arrow = velocity (direction, speed)   outlined = force (push)', '#8a93a8', 'left');
    const colX = [12, 70, Math.max(170, W * 0.42), Math.max(260, W * 0.62), Math.max(350, W * 0.82)];
    label(g, colX[2], y0 + 20, 'value', '#8a93a8', 'left');
    label(g, colX[3], y0 + 20, 'velocity/s', '#8a93a8', 'left');
    label(g, colX[4], y0 + 20, 'force/s²', '#8a93a8', 'left');
    (['jawOpen', 'lipWidth', 'lipRound'] as const).forEach((ch, i) => {
      const y = y0 + 38 + i * 17;
      const m = motion[ch];
      label(g, colX[0], y, LABELS[ch], COLORS[ch], 'left');
      g.fillStyle = '#141821';
      g.fillRect(colX[1], y - 4, colX[2] - colX[1] - 16, 8);
      g.fillStyle = COLORS[ch];
      g.fillRect(colX[1], y - 4, (colX[2] - colX[1] - 16) * m.value, 8);
      label(g, colX[2], y, m.value.toFixed(2), '#e6e9f0', 'left');
      label(g, colX[3], y, signed(m.velocity, 2), '#e6e9f0', 'left');
      label(g, colX[4], y, signed(m.force, 0), '#e6e9f0', 'left');
    });
  }
}

const signed = (v: number, digits: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  g.beginPath();
  g.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
}

function label(g: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, align: CanvasTextAlign): void {
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(text, x, y);
}

/**
 * Velocity (solid) and force (outlined) arrows along the axis (dx, dy), which
 * points in the control's increasing direction. Negative values flip them.
 */
function arrowPair(g: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, velocity: number, force: number, color: string): void {
  const perpX = -dy * 7;
  const perpY = dx * 7;
  arrow(g, x - perpX / 2, y - perpY / 2, dx, dy, velocity * VELOCITY_PX, color, true);
  arrow(g, x + perpX, y + perpY, dx, dy, force * FORCE_PX, color, false);
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, length: number, color: string, solid: boolean): void {
  const len = Math.max(-MAX_ARROW, Math.min(MAX_ARROW, length));
  if (Math.abs(len) < 3) return;
  const ex = x + dx * len;
  const ey = y + dy * len;
  const ux = dx * Math.sign(len);
  const uy = dy * Math.sign(len);
  const head = 9;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = solid ? 3 : 1.5;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(ex - ux * head * 0.6, ey - uy * head * 0.6);
  g.stroke();
  g.beginPath();
  g.moveTo(ex, ey);
  g.lineTo(ex - ux * head - uy * head * 0.5, ey - uy * head + ux * head * 0.5);
  g.lineTo(ex - ux * head + uy * head * 0.5, ey - uy * head - ux * head * 0.5);
  g.closePath();
  if (solid) g.fill();
  else g.stroke();
}
