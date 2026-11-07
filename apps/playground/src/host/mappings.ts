// Mappings from FaceControls to VRM expressions, plus shared cosmetic blinking.
// No Three.js types, so the mapping can be tested and reused by any VRM runtime.

import { type FaceControls } from 'wahwah/performance';

/** VRM 1.0 preset viseme expressions (VRM 0.x's A/I/U/E/O). */
export interface VrmVisemes {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

/**
 * Split the controls into VRM's five vowel shapes. Lip shape picks the family
 * (relaxed → aa, spread → ee/ih, rounded → ou/oh) and the jaw picks the more
 * open member of each, so the weights always sum to at most 1 and a closed
 * relaxed mouth is all zeros.
 */
export function controlsToVrmVisemes(c: FaceControls): VrmVisemes {
  const relaxed = Math.max(0, 1 - c.lipWidth - c.lipRound);
  return {
    aa: c.jawOpen * relaxed,
    ih: c.lipWidth * c.jawOpen,
    ee: c.lipWidth * (1 - c.jawOpen),
    ou: c.lipRound * (1 - c.jawOpen),
    oh: c.lipRound * c.jawOpen,
  };
}

/** Blink curve shared by hosts: 0 = open, 1 = closed. */
export class Blinker {
  private next = 2;
  private phase = -1;

  constructor(private readonly random: () => number = Math.random) {}

  update(dtSeconds: number): number {
    if (this.phase < 0) {
      this.next -= dtSeconds;
      if (this.next <= 0) this.phase = 0;
    } else {
      this.phase += dtSeconds / 0.16;
      if (this.phase >= 1) {
        this.phase = -1;
        this.next = 2 + this.random() * 3;
      }
    }
    return this.phase < 0 ? 0 : Math.sin(this.phase * Math.PI);
  }
}
