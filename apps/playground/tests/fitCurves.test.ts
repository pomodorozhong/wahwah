import { describe, expect, it } from 'vitest';
import { fitCurves, type FitPlotData } from '../src/ui/fitCurves';

// A 2.4 s line sped up ×1.6 throughout, so it would take 1.5 s, then cut at 1.2 s with a 400 ms linear fade.
const cut: FitPlotData = {
  seconds: 1.2,
  capSeconds: 1.2,
  fit: { naturalSeconds: 2.4, speed: 1.6, peakSpeed: 1.6, truncated: true, cutSeconds: 1.2 },
  options: { speedUp: { profile: 'constant', max: 1.6 }, cutFade: { curve: 'linear', milliseconds: 400 } },
  tail: null,
};

describe('fit curves for the playback monitor', () => {
  it('maps the original line onto the sped-up output clock', () => {
    const c = fitCurves(cut);
    expect(c.speed(0.3)).toBeCloseTo(1.6);
    expect(c.outputTime(2.4)).toBeCloseTo(1.5);
    expect(c.outputTime(1.2)).toBeCloseTo(0.75);
    expect(c.reached(0.75)).toBeCloseTo(0.5);
    expect(c.cutAt).toBe(1.2);
  });

  it('fades from the fade start to silence at the cut', () => {
    const c = fitCurves(cut);
    expect(c.fadeStart).toBeCloseTo(0.8);
    expect(c.gain(0.5)).toBeCloseTo(1);
    expect(c.gain(1.0)).toBeCloseTo(0.5);
    expect(c.gain(1.2)).toBeCloseTo(0);
  });

  it('has no fade or cut when the speed-up alone fits the line', () => {
    const c = fitCurves({ ...cut, seconds: 1.5, capSeconds: 2, fit: { ...cut.fit!, truncated: false, cutSeconds: null } });
    expect(c.fadeStart).toBeNull();
    expect(c.cutAt).toBeNull();
    expect(c.gain(1.4)).toBeCloseTo(1);
  });
});
