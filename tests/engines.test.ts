import { describe, expect, it } from 'vitest';
import { MotionTracker } from '../src/puppet/motion';
import { NEUTRAL } from '@wahwah/performance';

describe('motion tracker (debug puppet input)', () => {
  const dt = 1 / 60;

  it('reports velocity with the direction of change', () => {
    const m = new MotionTracker(0.001, 0.001);
    m.update({ ...NEUTRAL }, dt);
    let last = m.update({ ...NEUTRAL, jawOpen: 0.1 }, dt);
    for (let i = 2; i <= 10; i++) last = m.update({ ...NEUTRAL, jawOpen: 0.1 * i }, dt);
    expect(last.jawOpen.velocity).toBeCloseTo(6, 1); // 0.1 per 1/60 s
    expect(last.lipWidth.velocity).toBe(0);
    for (let i = 9; i >= 0; i--) last = m.update({ ...NEUTRAL, jawOpen: 0.1 * i }, dt);
    expect(last.jawOpen.velocity).toBeLessThan(0);
  });

  it('reports force as the push that changes velocity', () => {
    const m = new MotionTracker(0.001, 0.001);
    let s = m.update({ ...NEUTRAL }, dt);
    // Speeding up (x = t^2): positive force.
    for (let i = 1; i <= 20; i++) s = m.update({ ...NEUTRAL, lipRound: (i * dt) ** 2 }, dt);
    expect(s.lipRound.force).toBeCloseTo(2, 0);
    // Constant speed: no force.
    const v = s.lipRound.value;
    for (let i = 1; i <= 20; i++) s = m.update({ ...NEUTRAL, lipRound: v + 0.01 * i }, dt);
    expect(Math.abs(s.lipRound.force)).toBeLessThan(0.5);
  });

  it('is at rest for a still pose and ignores zero time steps', () => {
    const m = new MotionTracker();
    for (let i = 0; i < 30; i++) m.update({ jawOpen: 0.4, lipWidth: 0.2, lipRound: 0 }, dt);
    const s = m.update({ jawOpen: 0.4, lipWidth: 0.2, lipRound: 0 }, 0);
    expect(Math.abs(s.jawOpen.velocity)).toBeLessThan(1e-6);
    expect(Math.abs(s.jawOpen.force)).toBeLessThan(1e-3);
  });
});
