import { describe, expect, it } from 'vitest';
import { Blinker, controlsToVrmVisemes } from '../src/host/mappings';

const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);

describe('controlsToVrmVisemes', () => {
  it('is all zeros for a closed relaxed mouth', () => {
    expect(sum({ ...controlsToVrmVisemes({ jawOpen: 0, lipWidth: 0, lipRound: 0 }) })).toBe(0);
  });

  it('picks the vowel family from lip shape and the open member from the jaw', () => {
    expect(controlsToVrmVisemes({ jawOpen: 1, lipWidth: 0, lipRound: 0 }).aa).toBe(1);
    expect(controlsToVrmVisemes({ jawOpen: 0, lipWidth: 1, lipRound: 0 }).ee).toBe(1);
    expect(controlsToVrmVisemes({ jawOpen: 1, lipWidth: 1, lipRound: 0 }).ih).toBe(1);
    expect(controlsToVrmVisemes({ jawOpen: 0, lipWidth: 0, lipRound: 1 }).ou).toBe(1);
    expect(controlsToVrmVisemes({ jawOpen: 1, lipWidth: 0, lipRound: 1 }).oh).toBe(1);
  });

  it('never sums above 1 for normalized controls', () => {
    for (let j = 0; j <= 1; j += 0.25)
      for (let w = 0; w <= 1; w += 0.25)
        for (let r = 0; r <= 1 - w; r += 0.25)
          expect(sum({ ...controlsToVrmVisemes({ jawOpen: j, lipWidth: w, lipRound: r }) })).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('Blinker', () => {
  it('closes fully once mid-blink and reopens', () => {
    const b = new Blinker(() => 0);
    let peak = 0;
    let last = 1;
    for (let t = 0; t < 3; t += 0.01) {
      last = b.update(0.01);
      peak = Math.max(peak, last);
    }
    expect(peak).toBeGreaterThan(0.99);
    expect(last).toBe(0);
  });
});
