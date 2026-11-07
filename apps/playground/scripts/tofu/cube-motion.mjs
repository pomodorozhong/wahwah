// The body rig of study 05 (Brush Ink). On the attack, the shoulders roll
// across the planted base. On release, the trailing shoulder carries forward.
// Use the same field for painted marks and skin so they travel together.
export const brushInkTiming = { attack:.067, release:.14, follow:.19, acting:'measured' };

export function brushInkBody(p, channel) {
  const half = .90;
  const height = Math.max(0, Math.min(1, (p.y + half) / (2 * half)));
  const x = p.x / half, z = p.z / half;
  if (channel === 'drive') {
    return p.clone().set(p.x + .155*height, p.y + .077*height*(z-x), p.z - .105*height);
  }
  if (channel === 'follow') {
    return p.clone().set(p.x + .053*height*z, p.y + .068*height*(x+z), p.z + .111*height);
  }
  return p.clone();
}
