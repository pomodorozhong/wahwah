import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE, type VoiceSettings } from '../src/voice/performance';
import { DEFAULT_TROMBONE } from '../src/voice/trombone';
import { renderPhonemes, renderMumble } from '../src/voice/rustVoice';
import { rmsEnvelope, syncReport } from '../src/analysis';

const SR = 48000;
const slow = { ...DEFAULT_VOICE, msPerPhoneme: 250 };

/** Pitch by autocorrelation over a window, Hz. */
function pitchAt(audio: Float32Array, t: number, lo = 50, hi = 400): number {
  const start = Math.floor(t * SR);
  const n = 2048;
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(SR / hi); lag <= Math.floor(SR / lo); lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += audio[start + i] * audio[start + i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  return SR / bestLag;
}

/** Spectral centroid over a window, Hz (naive DFT, coarse bins). */
function centroidAt(audio: Float32Array, t: number): number {
  const start = Math.floor(t * SR);
  const n = 2048;
  let num = 0;
  let den = 0;
  for (let f = 50; f < 5000; f += 25) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      const a = (2 * Math.PI * f * i) / SR;
      re += audio[start + i] * w * Math.cos(a);
      im -= audio[start + i] * w * Math.sin(a);
    }
    const mag = Math.hypot(re, im);
    num += f * mag;
    den += mag;
  }
  return num / den;
}

const render = (source: string, settings: VoiceSettings = slow) =>
  renderPhonemes(source, settings, SR, { engine: 'trombone', trombone: { ...DEFAULT_TROMBONE, transpose: 0 } });
const mid = (perf: ReturnType<typeof render>, i: number) => (perf.timeline.segments[i].startSeconds + perf.timeline.segments[i].endSeconds) / 2;

describe('wah-wah trombone engine', () => {
  it('plays at the speech pitch and follows pitch glides', () => {
    const perf = render('AA AA(+60)', { ...slow, msPerPhoneme: 600 });
    expect(pitchAt(perf.audio, 0.2)).toBeCloseTo(DEFAULT_VOICE.pitchHz, 0);
    expect(pitchAt(perf.audio, 1.1)).toBeGreaterThan(DEFAULT_VOICE.pitchHz + 50);
  });

  it('sounds brighter on an open vowel than a rounded one (the "wah")', () => {
    const perf = render('AA , UW', { ...slow, msPerPhoneme: 500 });
    const audio = perf.audio;
    expect(centroidAt(audio, mid(perf, 0))).toBeGreaterThan(centroidAt(audio, mid(perf, 2)) * 1.3);
  });

  it('renders deterministic, audible, normalized audio whose loudness the jaw follows', () => {
    const sentence = () => renderMumble('Hello class. Please open your books to page forty two.', { seed: 4 }, DEFAULT_VOICE, SR,
      { engine: 'trombone', trombone: DEFAULT_TROMBONE });
    const u = sentence();
    const a = u.audio;
    expect(a).toEqual(sentence().audio);
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.7, 2);
    expect(Math.max(...rmsEnvelope(a, SR))).toBeGreaterThan(0.1);
    const report = syncReport(a, SR, u.track!);
    expect(report.jawLoudnessCorrelation).toBeGreaterThan(0.45);
    expect(Math.abs(report.jawLeadSeconds)).toBeLessThanOrEqual(0.06);
  });
});
