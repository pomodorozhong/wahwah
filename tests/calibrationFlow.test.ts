import { describe, expect, it } from 'vitest';
import { CalibrationFlow, DEFAULT_FLOW } from '../src/live/calibrationFlow';
import { frameFeatures } from '../src/live/profile';
import { magnitudeSpectrumDb } from '../src/live/features';
import { ulsInputLength } from '../src/live/ulipsync';
import { klattschVoice, roomNoise } from './helpers/calibrate';
import { SR, N, DT } from './helpers/liveEval';

/** Feed audio to the flow frame by frame, as the live page does. */
function feed(flow: CalibrationFlow, audio: Float32Array): boolean {
  const longN = ulsInputLength(SR);
  const hop = Math.round(SR * DT);
  const padded = new Float32Array(longN + audio.length);
  padded.set(roomNoise(longN / SR));
  padded.set(audio, longN);
  let finished = false;
  for (let end = longN + hop; end <= padded.length; end += hop) {
    const f = padded.subarray(end - N, end);
    if (flow.frame(frameFeatures(f, magnitudeSpectrumDb(f), SR, padded.subarray(end - longN, end)), DT)) finished = true;
  }
  return finished;
}

const concat = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const voice = klattschVoice(1.15, 200);
const SLOW = { timeout: 60000 };

describe('self-paced calibration flow', () => {
  it('waits on the intro and the quiet step until the speaker acts', () => {
    const flow = new CalibrationFlow(SR);
    feed(flow, roomNoise(2));
    expect(flow.view().phase).toBe('intro');
    flow.begin();
    expect(flow.view().phase).toBe('quiet-wait');
    feed(flow, roomNoise(3));
    expect(flow.view().phase).toBe('quiet-wait'); // never times out on its own
    flow.confirmQuiet();
    feed(flow, roomNoise(DEFAULT_FLOW.quietSeconds + 0.2));
    expect(flow.view().done[0]).toBe(true);
  });

  it('does not record until the sound starts, however late the speaker is', SLOW, () => {
    const flow = new CalibrationFlow(SR);
    flow.begin();
    flow.confirmQuiet();
    feed(flow, roomNoise(DEFAULT_FLOW.quietSeconds + 1)); // quiet step + got-it pause
    expect(flow.view().step?.id).toBe('AA');
    feed(flow, roomNoise(4)); // the speaker takes 4 s to start
    expect(flow.view().phase).toBe('listening');
    expect(flow.view().progress).toBe(0);
    feed(flow, voice('AA', 2.2));
    expect(flow.view().done[1]).toBe(true);
  });

  it('keeps progress when the speaker pauses mid-sound and shows a hint', SLOW, () => {
    const flow = new CalibrationFlow(SR);
    flow.begin();
    flow.confirmQuiet();
    feed(flow, roomNoise(DEFAULT_FLOW.quietSeconds + 1));
    feed(flow, voice('AA', 1.0)); // not enough yet
    const mid = flow.view().progress;
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(1);
    feed(flow, roomNoise(1)); // breath
    expect(flow.view().progress).toBeCloseTo(mid, 5);
    expect(flow.view().done[1]).toBe(false);
    feed(flow, voice('AA', 1.2)); // carries on
    expect(flow.view().done[1]).toBe(true);
  });

  it('redo, back and skip', SLOW, () => {
    const flow = new CalibrationFlow(SR);
    flow.begin();
    flow.confirmQuiet();
    feed(flow, roomNoise(DEFAULT_FLOW.quietSeconds + 1));
    feed(flow, concat(voice('AA', 2.5), roomNoise(1))); // sound, then the "got it" pause
    expect(flow.view().step?.id).toBe('IY');
    flow.back();
    expect(flow.view().step?.id).toBe('AA');
    expect(flow.view().done[1]).toBe(false);
    expect(flow.calibration.frames.get('AA')).toBeUndefined();
    feed(flow, voice('AA', 1));
    flow.redo();
    expect(flow.view().progress).toBe(0);
    flow.skip();
    expect(flow.view().step?.id).toBe('IY');
  });

  it('a full self-paced session builds a good profile', SLOW, () => {
    const flow = new CalibrationFlow(SR);
    flow.begin();
    flow.confirmQuiet();
    let finished = feed(flow, roomNoise(DEFAULT_FLOW.quietSeconds + 1));
    for (const step of flow.steps.slice(1)) {
      // A different, human-ish delay before each sound.
      finished = feed(flow, concat(roomNoise(0.3 + Math.random() * 1.5), voice(step.id, 2.4), roomNoise(1))) || finished;
    }
    expect(finished).toBe(true);
    const p = flow.profile!;
    expect(p.classes.map((c) => c.id)).toEqual(flow.steps.map((s) => s.id));
    expect(p.quality.messages[0].level).toBe('ok');
    expect(p.uls).toBeDefined();
  });
});
