import { describe, expect, it } from 'vitest';
import { Blinker, controlsToLive2D, controlsToVrmVisemes, parseModel3 } from '../src/host/mappings';
import { renderOrderFromDrawOrders } from '../src/host/live2d';

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

describe('controlsToLive2D', () => {
  it('drives the LipSync group and MouthForm as spread minus pucker', () => {
    expect(controlsToLive2D({ jawOpen: 0.6, lipWidth: 0.1, lipRound: 0.5 }, ['ParamMouthOpenY', 'ParamA'])).toEqual({
      ParamMouthOpenY: 0.6,
      ParamA: 0.6,
      ParamMouthForm: 0.1 - 0.5,
    });
  });

  it('falls back to ParamMouthOpenY without a LipSync group', () => {
    expect(controlsToLive2D({ jawOpen: 1, lipWidth: 1, lipRound: 0 }, [])).toEqual({ ParamMouthOpenY: 1, ParamMouthForm: 1 });
  });
});

describe('parseModel3', () => {
  it('reads files, groups and head hit areas', () => {
    const s = parseModel3({
      Version: 3,
      FileReferences: { Moc: 'hiyori.moc3', Textures: ['hiyori.2048/texture_00.png'] },
      Groups: [
        { Target: 'Parameter', Name: 'LipSync', Ids: ['ParamMouthOpenY'] },
        { Target: 'Parameter', Name: 'EyeBlink', Ids: ['ParamEyeLOpen', 'ParamEyeROpen'] },
      ],
      HitAreas: [
        { Id: 'HitArea', Name: 'Body' },
        { Id: 'HitAreaHead', Name: 'Head' },
      ],
    });
    expect(s).toEqual({
      moc: 'hiyori.moc3',
      textures: ['hiyori.2048/texture_00.png'],
      lipSyncIds: ['ParamMouthOpenY'],
      eyeBlinkIds: ['ParamEyeLOpen', 'ParamEyeROpen'],
      headDrawableIds: ['HitAreaHead'],
    });
  });

  it('rejects a file without a moc', () => {
    expect(() => parseModel3({ FileReferences: {} })).toThrow(/Moc/);
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

describe('renderOrderFromDrawOrders', () => {
  it('ranks drawables by draw order, ties by index', () => {
    expect([...renderOrderFromDrawOrders([500, 200, 500, 100])]).toEqual([2, 1, 3, 0]);
  });
});
