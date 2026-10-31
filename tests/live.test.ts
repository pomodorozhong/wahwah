import { describe, expect, it } from 'vitest';
import { DEFAULT_LIVE, LiveMouthEstimator, rmsDb, spectralCentroid } from '../src/live/estimator';
import { DEFAULT_VOICE, compilePerformance, renderPerformance } from '../src/voice/performance';
import { rmsEnvelope, pearson } from '../src/analysis';

const SR = 48000;
const N = 1024;
const DT = 1 / 60;

const tone = (hz: number, amp: number, offset = 0) =>
  Float32Array.from({ length: N }, (_, i) => amp * Math.sin((2 * Math.PI * hz * (i + offset)) / SR));

/** dB magnitude spectrum like AnalyserNode.getFloatFrequencyData (N/2 bins). */
function spectrumDb(frame: Float32Array): Float32Array {
  const bins = frame.length / 2;
  const out = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < frame.length; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frame.length);
      re += frame[i] * w * Math.cos((2 * Math.PI * k * i) / frame.length);
      im -= frame[i] * w * Math.sin((2 * Math.PI * k * i) / frame.length);
    }
    out[k] = 20 * Math.log10(Math.max(1e-7, Math.hypot(re, im) / frame.length));
  }
  return out;
}

function run(est: LiveMouthEstimator, frames: Float32Array[], withSpectrum = false) {
  return frames.map((f) => est.process(f, withSpectrum ? spectrumDb(f) : null, SR, DT));
}

describe('live mouth estimator', () => {
  it('measures level and spectral centroid', () => {
    expect(rmsDb(tone(440, 1))).toBeCloseTo(-3, 0);
    expect(spectralCentroid(spectrumDb(tone(500, 0.5)), SR)).toBeLessThan(800);
    expect(spectralCentroid(spectrumDb(tone(2500, 0.5)), SR)).toBeGreaterThan(2000);
  });

  it('keeps the mouth closed in silence and quiet noise', () => {
    const est = new LiveMouthEstimator();
    const quiet = Array.from({ length: 60 }, (_, j) => Float32Array.from({ length: N }, (_, i) => 0.001 * Math.sin(i * 1.3 + j)));
    const out = run(est, quiet);
    expect(out.at(-1)!.jawOpen).toBeLessThan(0.02);
  });

  it('opens with a loud voice and closes again after it stops', () => {
    const est = new LiveMouthEstimator();
    run(est, Array.from({ length: 30 }, () => tone(200, 0.0005)));
    const loud = run(est, Array.from({ length: 10 }, (_, j) => tone(200, 0.3, j * N)));
    expect(loud.at(-1)!.jawOpen).toBeGreaterThan(0.7);
    // Attack is fast: open well within 100 ms.
    expect(loud[5].jawOpen).toBeGreaterThan(0.5);
    const after = run(est, Array.from({ length: 30 }, () => tone(200, 0.0005)));
    expect(after.at(-1)!.jawOpen).toBeLessThan(0.05);
  });

  it('learns steady background noise as the floor', () => {
    const est = new LiveMouthEstimator();
    run(est, Array.from({ length: 30 }, () => tone(200, 0.0005))); // quiet room
    const hum = Array.from({ length: 60 * 8 }, (_, j) => tone(120, 0.02, j * N)); // then a fan starts
    const out = run(est, hum);
    expect(out[5].jawOpen).toBeGreaterThan(0.2); // at first the hum opens the mouth
    expect(out.at(-1)!.jawOpen).toBeLessThan(0.05); // after a few seconds it is ignored
  });

  it('stays expressive against a perfectly silent background', () => {
    // Digital silence between sounds: the floor drops to -90 dB, yet a soft
    // sound must still open the mouth less than a loud one.
    const est = new LiveMouthEstimator();
    const silence = () => new Float32Array(N);
    run(est, Array.from({ length: 20 }, silence));
    const loud = run(est, Array.from({ length: 15 }, (_, j) => tone(200, 0.3, j * N))).at(-1)!;
    run(est, Array.from({ length: 10 }, silence));
    const soft = run(est, Array.from({ length: 15 }, (_, j) => tone(200, 0.03, j * N))).at(-1)!;
    expect(loud.jawOpen).toBeGreaterThan(0.9);
    expect(soft.jawOpen).toBeGreaterThan(0.1);
    expect(soft.jawOpen).toBeLessThan(loud.jawOpen - 0.4);
  });

  it('sensitivity scales the opening', () => {
    const frames = [...Array.from({ length: 30 }, () => tone(200, 0.0005)), ...Array.from({ length: 20 }, (_, j) => tone(200, 0.01, j * N))];
    const low = run(new LiveMouthEstimator({ ...DEFAULT_LIVE, sensitivity: 0.5 }), frames).at(-1)!;
    const high = run(new LiveMouthEstimator({ ...DEFAULT_LIVE, sensitivity: 2 }), frames).at(-1)!;
    expect(high.jawOpen).toBeGreaterThan(low.jawOpen * 2);
  });

  it('reads dark sound as rounded and bright sound as wide (experimental lip shape)', () => {
    const lead = Array.from({ length: 20 }, () => tone(200, 0.0005));
    const dark = run(new LiveMouthEstimator(), [...lead, ...Array.from({ length: 30 }, (_, j) => tone(450, 0.2, j * N))], true).at(-1)!;
    const bright = run(new LiveMouthEstimator(), [...lead, ...Array.from({ length: 30 }, (_, j) => tone(2400, 0.2, j * N))], true).at(-1)!;
    expect(dark.lipRound).toBeGreaterThan(0.6);
    expect(dark.lipWidth).toBeLessThan(0.1);
    expect(bright.lipWidth).toBeGreaterThan(0.6);
    expect(bright.lipRound).toBeLessThan(0.1);
  });

  it('tracks rendered speech: jaw follows the loudness envelope', () => {
    const perf = compilePerformance('AA . AA , M AA . W AA', { ...DEFAULT_VOICE, msPerPhoneme: 150 });
    const audio = renderPerformance(perf, SR);
    const hop = Math.round(SR * DT);
    const est = new LiveMouthEstimator();
    const jaw: number[] = [];
    for (let end = N; end <= audio.length; end += hop) jaw.push(est.process(audio.subarray(end - N, end), null, SR, DT).jawOpen);
    // Envelope sampled at the same hops (window ending at each hop).
    const env = rmsEnvelope(audio, SR, DT).slice(1, jaw.length + 1);
    // Best alignment within ±5 frames: the smoothing makes the jaw trail slightly.
    let best = { lag: 0, r: -1 };
    for (let lag = -5; lag <= 5; lag++) {
      const r = pearson(env.slice(Math.max(0, -lag)), jaw.slice(Math.max(0, lag)));
      if (r > best.r) best = { lag, r };
    }
    console.log(`live estimator vs speech: r=${best.r.toFixed(2)} at lag ${best.lag} frames (${(best.lag * DT * 1000).toFixed(0)} ms), r0=${pearson(env, jaw).toFixed(2)}`);
    expect(best.r).toBeGreaterThan(0.75);
    expect(best.lag).toBeGreaterThanOrEqual(0); // the jaw never leads the sound
    expect(best.lag * DT).toBeLessThanOrEqual(0.05);
  });
});
