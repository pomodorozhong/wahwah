// Run the guided calibration on a synthetic voice, frame by frame like the live page.
import { Calibration, CALIBRATION_STEPS, frameFeatures, type ProfileClassId, type VoiceProfile } from '../../src/live/profile';
import { magnitudeSpectrumDb } from '../../src/live/features';
import { DEFAULT_VOICE } from '../../src/voice/performance';
import { renderFormant } from './voice';
import { renderTract, PT_VOWELS, PT_M } from '../../src/live/ptVoice';
import { SR, N, DT } from './liveEval';
import { ulsInputLength } from '../../src/live/ulipsync';

export type StepVoice = (id: ProfileClassId, seconds: number) => Float32Array;

/** Quiet room noise, as during the "stay quiet" step. */
export function roomNoise(seconds: number, amp = 1e-4): Float32Array {
  let x = 7;
  return Float32Array.from({ length: Math.round(seconds * SR) }, () => ((x = (x * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * amp);
}

export function formantVoice(formantScale = 1, pitchHz = 120): StepVoice {
  return (id, seconds) =>
    id === 'silence'
      ? roomNoise(seconds)
      : renderFormant(id, { ...DEFAULT_VOICE, formantScale, pitchHz, msPerPhoneme: seconds * 1000 }, SR).audio.subarray(0, Math.round(seconds * SR));
}

export function pinkTromboneVoice(pitchHz = 130): StepVoice {
  const k = formantVoice(1, pitchHz);
  const configs: Partial<Record<ProfileClassId, Parameters<typeof renderTract>[0]>> = {
    ...PT_VOWELS,
    OW: { tongueIndex: 18.4, tongueDiameter: 2.29, lipDiameter: 0.85 },
    M: PT_M,
  };
  return (id, seconds) => (configs[id] ? renderTract(configs[id]!, SR, seconds, pitchHz) : k(id, seconds));
}

export function calibrate(voice: StepVoice, steps = CALIBRATION_STEPS): VoiceProfile {
  const cal = new Calibration();
  for (const step of steps) {
    const audio = voice(step.id, step.seconds);
    const hop = Math.round(SR * DT);
    const longN = ulsInputLength(SR);
    for (let end = longN; end <= audio.length; end += hop) {
      const f = audio.subarray(end - N, end);
      cal.add(step.id, frameFeatures(f, magnitudeSpectrumDb(f), SR, audio.subarray(end - longN, end)), end / SR);
    }
  }
  return cal.build(SR);
}

/** Windowed-sinc low-pass: simulates a band-limited mic path (call-mode Bluetooth, telephone). */
export function lowpass(x: Float32Array, cutoffHz: number, sr = SR): Float32Array {
  const taps = 201;
  const half = (taps - 1) / 2;
  const fc = cutoffHz / sr;
  const h = new Float64Array(taps);
  for (let i = 0; i < taps; i++) {
    const m = i - half;
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    h[i] = sinc * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1)));
  }
  const y = new Float32Array(x.length);
  for (let n = half; n < x.length - half; n++) {
    let s = 0;
    for (let i = 0; i < taps; i++) s += x[n - half + i] * h[i];
    y[n] = s;
  }
  return y;
}
