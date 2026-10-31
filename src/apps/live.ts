// Live playground: real-time microphone (or test signal) -> live voice
// analysis -> puppet instructions -> face or debug puppet.

import { DEFAULT_LIVE, LiveMouthEstimator, type LiveFrame, type ShapeMode } from '../live/estimator';
import { REFERENCE_VOWELS } from '../live/vowels';
import { renderSweep, PT_VOWELS } from '../live/ptVoice';
import { NEUTRAL, type FaceControls } from '../puppet/controls';
import { compilePerformance, renderPerformance, DEFAULT_VOICE } from '../voice/performance';
import { moodVoice, textToBabble } from '../babble/generate';
import { PuppetView, byId, fitCanvas, renderShell, section } from '../ui/puppetView';

const FFT = 1024;
const HISTORY_SECONDS = 6;

const slider = (id: string, label: string, min: number, max: number, step: number, value: number) =>
  `<label class="field slider">${label} <output id="${id}Out"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

renderShell(document.querySelector<HTMLDivElement>('#app')!, {
  title: 'Live mic playground',
  levelLabel: 'input level',
  transportHtml: '<button id="start" class="primary">● Start</button><button id="stop" disabled>■ Stop</button>',
  panelHtml:
    section(
      'Source',
      `<label class="field">Input
        <select id="source">
          <option value="mic">Microphone</option>
          <option value="test">Test signal: babble sentence (klattsch, played aloud)</option>
          <option value="sweep">Test signal: vowel sweep ah·ee·oo·eh (Pink Trombone, played aloud)</option>
        </select>
      </label>
      <label class="field" id="deviceField">Microphone device <select id="device"><option value="">Default</option></select></label>
      <label><input id="monitor" type="checkbox" /> Hear the microphone (use headphones)</label>
      <p class="hint" id="sourceHint">Your audio stays in this page; nothing is recorded or sent anywhere.</p>`,
    ) +
    section(
      'Response',
      `${slider('sensitivity', 'Sensitivity', 0.5, 3, 0.05, DEFAULT_LIVE.sensitivity)}
      ${slider('gate', 'Gate above noise floor', 2, 24, 1, DEFAULT_LIVE.gateDb)}
      ${slider('range', 'Loudness range to full open', 10, 50, 1, DEFAULT_LIVE.rangeDb)}
      ${slider('attack', 'Open time', 5, 120, 5, DEFAULT_LIVE.attackSeconds * 1000)}
      ${slider('release', 'Close time', 20, 300, 10, DEFAULT_LIVE.releaseSeconds * 1000)}
      <label class="field">Mouth shape from
        <select id="shapeMode">
          <option value="formants">Formants: vowels, s/sh/f, closed lips</option>
          <option value="centroid">Brightness only (earlier method)</option>
          <option value="off">Loudness only (jaw)</option>
        </select>
      </label>`,
    ) +
    section(
      'Vowel map',
      `<canvas id="vowelMap" class="vowel-map"></canvas>
      <p class="hint">Your F1 (openness, down) and F2 (front, left) against the reference vowels, scaled to your voice. The dot is now; the trail is the last second.</p>`,
    ) +
    section(
      'Latency',
      `<div id="latency">Start the input to measure.</div>
      <p class="hint">Mic-to-mouth delay is input latency + analysis window + open-time smoothing + one display frame. Lower the open time for snappier motion, at the cost of jitter.</p>`,
      false,
    ),
});

const view = new PuppetView();
const estimator = new LiveMouthEstimator();
const timeline = byId<HTMLCanvasElement>('timeline');
const sourceEl = byId<HTMLSelectElement>('source');
const deviceEl = byId<HTMLSelectElement>('device');
const monitorEl = byId<HTMLInputElement>('monitor');
const startBtn = byId<HTMLButtonElement>('start');
const stopBtn = byId<HTMLButtonElement>('stop');

interface Running {
  ctx: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream | null;
  nodes: AudioNode[];
  monitor: GainNode | null;
  started: number;
}
let running: Running | null = null;
let lastFrame: LiveFrame | null = null;
let frameDts: number[] = [];
let estimatorRuns = 0;
const history: { t: number; levelDb: number; floorDb: number; thresholdDb: number; c: FaceControls }[] = [];
const timeBuf = new Float32Array(FFT);
const specBuf = new Float32Array(FFT / 2);

function readSettings(): void {
  const num = (id: string) => Number(byId<HTMLInputElement>(id).value);
  estimator.settings = {
    sensitivity: num('sensitivity'),
    gateDb: num('gate'),
    rangeDb: num('range'),
    attackSeconds: num('attack') / 1000,
    releaseSeconds: num('release') / 1000,
    shapeMode: byId<HTMLSelectElement>('shapeMode').value as ShapeMode,
  };
  byId('sensitivityOut').textContent = `×${num('sensitivity').toFixed(2)}`;
  byId('gateOut').textContent = `${num('gate')} dB`;
  byId('rangeOut').textContent = `${num('range')} dB`;
  byId('attackOut').textContent = `${num('attack')} ms`;
  byId('releaseOut').textContent = `${num('release')} ms`;
}

function testSignal(ctx: AudioContext, kind: 'test' | 'sweep'): AudioBufferSourceNode {
  let pcm: Float32Array<ArrayBuffer>;
  if (kind === 'sweep') {
    // Pink Trombone gliding between vowel shapes: a voice the analyzer was not tuned on.
    const v = PT_VOWELS;
    pcm = renderSweep(
      [v.AA, v.IY, v.UW, v.EH, v.AA, v.UW, v.IY].flatMap((config) => [{ config, seconds: 0.55 }, { config: null, seconds: 0.12 }]),
      ctx.sampleRate,
      140,
    ) as Float32Array<ArrayBuffer>;
  } else {
    const script = textToBabble('Hello there! Testing, one two three. Can you see my mouth move? Oh, wonderful.', { seed: 9 });
    const perf = compilePerformance(script.phonemes, moodVoice(DEFAULT_VOICE, script.mood));
    pcm = renderPerformance(perf, ctx.sampleRate) as Float32Array<ArrayBuffer>;
  }
  const buffer = ctx.createBuffer(1, pcm.length + ctx.sampleRate, ctx.sampleRate); // 1 s gap between loops
  buffer.copyToChannel(pcm, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

async function start(): Promise<void> {
  stop();
  startBtn.disabled = true;
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT;
  analyser.smoothingTimeConstant = 0;
  let stream: MediaStream | null = null;
  const nodes: AudioNode[] = [];
  let monitor: GainNode | null = null;
  try {
    if (sourceEl.value === 'mic') {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceEl.value ? { exact: deviceEl.value } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      monitor = ctx.createGain();
      monitor.gain.value = monitorEl.checked ? 1 : 0;
      src.connect(monitor).connect(ctx.destination);
      nodes.push(src, monitor);
      void listDevices();
    } else {
      const src = testSignal(ctx, sourceEl.value as 'test' | 'sweep');
      src.connect(analyser);
      src.connect(ctx.destination);
      src.start();
      nodes.push(src);
    }
    await ctx.resume();
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close();
    startBtn.disabled = false;
    byId('sourceHint').textContent = `Could not start input: ${(err as Error).message}`;
    return;
  }
  estimator.reset();
  history.length = 0;
  frameDts = [];
  running = { ctx, analyser, stream, nodes, monitor, started: performance.now() };
  stopBtn.disabled = false;
  startBtn.disabled = false;
  startBtn.textContent = '↻ Restart';
  byId('sourceHint').textContent =
    sourceEl.value === 'mic' ? 'Listening. Your audio stays in this page; nothing is recorded or sent anywhere.' : 'Playing the test signal through the analyzer and the speakers.';
}

function stop(): void {
  if (!running) return;
  running.nodes.forEach((n) => {
    if (n instanceof AudioScheduledSourceNode) n.stop();
    n.disconnect();
  });
  running.stream?.getTracks().forEach((t) => t.stop());
  void running.ctx.close();
  running = null;
  lastFrame = null;
  view.host.relax();
  stopBtn.disabled = true;
  startBtn.textContent = '● Start';
}

async function listDevices(): Promise<void> {
  const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
  const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId);
  const current = deviceEl.value;
  deviceEl.innerHTML = '<option value="">Default</option>' + inputs.map((d, i) => `<option value="${d.deviceId}">${d.label || `Microphone ${i + 1}`}</option>`).join('');
  deviceEl.value = inputs.some((d) => d.deviceId === current) ? current : '';
}

function renderLatency(): void {
  if (!running) return;
  const ctx = running.ctx;
  const windowMs = (FFT / ctx.sampleRate) * 1000;
  const frameMs = frameDts.length ? (frameDts.reduce((a, b) => a + b, 0) / frameDts.length) * 1000 : 0;
  const trackLatency = running.stream?.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
  const inputMs = (trackLatency?.latency ?? ctx.baseLatency ?? 0) * 1000;
  const smoothMs = estimator.settings.attackSeconds * 1000;
  // Half the window on average; the attack time constant to reach ~63% open.
  const total = inputMs + windowMs / 2 + smoothMs + frameMs;
  const rows = [
    ['input latency', `${inputMs.toFixed(1)} ms${trackLatency?.latency === undefined ? ' (baseLatency)' : ''}`],
    ['analysis window', `${windowMs.toFixed(1)} ms (${FFT} samples)`],
    ['open smoothing', `${smoothMs.toFixed(0)} ms`],
    ['display frame', `${frameMs.toFixed(1)} ms`],
    ['≈ mic→mouth', `${total.toFixed(0)} ms`],
  ];
  byId('latency').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
}

function renderDiagnostics(): void {
  const f = lastFrame;
  const rows = running
    ? [
        ['source', sourceEl.selectedOptions[0]?.textContent?.split(' (')[0] ?? sourceEl.value],
        ['level', f ? `${f.levelDb.toFixed(1)} dBFS` : '–'],
        ['noise floor', f ? `${f.floorDb.toFixed(1)} dBFS` : '–'],
        ['recent peak', f ? `${f.peakDb.toFixed(1)} dBFS` : '–'],
        ['opens above', f ? `${f.thresholdDb.toFixed(1)} dBFS` : '–'],
        ['voiced', f ? (f.voiced ? 'yes' : 'no') : '–'],
        ['read as', f ? `${f.soundClass}${f.sound ? ` (${f.sound})` : ''}` : '–'],
        ['periodicity', f ? `${f.periodicity.toFixed(2)}${f.pitchHz ? ` · ${f.pitchHz.toFixed(0)} Hz` : ''}` : '–'],
        ['F1 / F2', f && f.f1 ? `${f.f1.toFixed(0)} / ${f.f2.toFixed(0)} Hz` : '–'],
        ['speaker scale', f ? `×${f.speakerScale.toFixed(2)}` : '–'],
        ['centroid', f && f.centroidHz ? `${f.centroidHz.toFixed(0)} Hz` : '–'],
        ['estimator', view.puppetEnabled ? 'running' : 'off — puppet output disabled'],
      ]
    : [['input', 'stopped']];
  byId('diag').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
}

/**
 * Scrolling history on a -90..0 dBFS scale: input level (blue), noise floor
 * (grey dashes), opening threshold (white dashes), and the three controls.
 */
function drawTimeline(now: number): void {
  const { g, w, h } = fitCanvas(timeline);
  const t0 = now - HISTORY_SECONDS;
  const x = (t: number) => ((t - t0) / HISTORY_SECONDS) * w;
  const yDb = (db: number) => h - Math.min(1, Math.max(0, (db + 90) / 90)) * (h - 14);
  g.fillStyle = 'rgba(120,170,255,0.35)';
  for (const p of history) {
    const y = yDb(p.levelDb);
    g.fillRect(x(p.t), y, Math.max(1, w / (HISTORY_SECONDS * 60)), h - y);
  }
  g.setLineDash([4, 4]);
  for (const [key, color] of [['floorDb', 'rgba(138,147,168,0.6)'], ['thresholdDb', 'rgba(255,255,255,0.6)']] as const) {
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    history.forEach((p, i) => (i === 0 ? g.moveTo(x(p.t), yDb(p[key])) : g.lineTo(x(p.t), yDb(p[key]))));
    g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = '#8a93a8';
  g.font = '10px ui-monospace, monospace';
  if (w > 460) g.fillText('level · floor · opens-above (dB)   jaw · width · round', 4, 11);
  for (const [k, color] of [['jawOpen', '#ff8a5c'], ['lipWidth', '#7ee081'], ['lipRound', '#d68cff']] as const) {
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    history.forEach((p, i) => {
      const y = h - p.c[k] * (h - 14);
      if (i === 0) g.moveTo(x(p.t), y); else g.lineTo(x(p.t), y);
    });
    g.stroke();
  }
  g.fillText(`last ${HISTORY_SECONDS} s`, w - 70, 11);
}

const vowelTrail: { t: number; f1: number; f2: number }[] = [];
const vowelMap = byId<HTMLCanvasElement>('vowelMap');

/** F1/F2 chart in the usual vowel-chart orientation (front left, open down). */
function drawVowelMap(t: number): void {
  const { g, w, h } = fitCanvas(vowelMap);
  const scale = lastFrame?.speakerScale ?? 1;
  const [f2Lo, f2Hi, f1Lo, f1Hi] = [600 * scale, 2600 * scale, 220 * scale, 950 * scale];
  const x = (f2: number) => w - ((Math.log(f2) - Math.log(f2Lo)) / (Math.log(f2Hi) - Math.log(f2Lo))) * (w - 24) - 12;
  const y = (f1: number) => 10 + ((Math.log(f1) - Math.log(f1Lo)) / (Math.log(f1Hi) - Math.log(f1Lo))) * (h - 20);
  g.font = '11px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const v of REFERENCE_VOWELS) {
    g.fillStyle = v.code === lastFrame?.sound ? '#ff8a5c' : '#8a93a8';
    g.fillText(v.code, x(v.f2 * scale), y(v.f1 * scale));
  }
  while (vowelTrail.length && vowelTrail[0].t < t - 1) vowelTrail.shift();
  vowelTrail.forEach((p, i) => {
    g.fillStyle = `rgba(126,224,129,${0.15 + (0.6 * i) / vowelTrail.length})`;
    g.beginPath();
    g.arc(x(p.f2), y(p.f1), 2.5, 0, Math.PI * 2);
    g.fill();
  });
  const last = vowelTrail.at(-1);
  if (last && t - last.t < 0.15) {
    g.fillStyle = '#7ee081';
    g.beginPath();
    g.arc(x(last.f2), y(last.f1), 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#4a5168';
  g.textAlign = 'left';
  g.fillText('front ← F2', 4, h - 6);
  g.textAlign = 'right';
  g.fillText('F1 ↓ open', w - 4, 8);
}

let last = performance.now();
let lastPanel = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let controls: FaceControls | null = null;
  let level = 0;
  const t = now / 1000;
  if (running) {
    running.analyser.getFloatTimeDomainData(timeBuf);
    let sum = 0;
    for (const v of timeBuf) sum += v * v;
    level = Math.sqrt(sum / FFT);
    if (view.puppetEnabled) {
      running.analyser.getFloatFrequencyData(specBuf);
      lastFrame = estimator.process(timeBuf, specBuf, running.ctx.sampleRate, dt);
      estimatorRuns++;
      controls = lastFrame;
      if (lastFrame.f1 && lastFrame.f2) vowelTrail.push({ t, f1: lastFrame.f1, f2: lastFrame.f2 });
    }
    frameDts.push(dt);
    if (frameDts.length > 60) frameDts.shift();
    const f = lastFrame;
    const levelDb = 20 * Math.log10(Math.max(level, 1e-7));
    history.push({ t, levelDb, floorDb: f?.floorDb ?? -90, thresholdDb: f?.thresholdDb ?? -90, c: controls ?? { ...NEUTRAL } });
    while (history.length && history[0].t < t - HISTORY_SECONDS) history.shift();
  }
  view.update(dt, controls);
  view.showReadout(running ? (now - running.started) / 1000 : null, lastFrame ? (lastFrame.sound ?? (lastFrame.voiced ? 'voice' : 'quiet')) : null, level);
  drawTimeline(t);
  drawVowelMap(t);
  if (now - lastPanel > 250) {
    lastPanel = now;
    renderLatency();
    renderDiagnostics();
  }
  requestAnimationFrame(frame);
}

startBtn.addEventListener('click', () => void start());
stopBtn.addEventListener('click', stop);
sourceEl.addEventListener('change', () => {
  byId('deviceField').hidden = sourceEl.value !== 'mic';
  monitorEl.parentElement!.hidden = sourceEl.value !== 'mic';
  if (running) void start();
});
deviceEl.addEventListener('change', () => {
  if (running && sourceEl.value === 'mic') void start();
});
monitorEl.addEventListener('change', () => {
  if (running?.monitor) running.monitor.gain.value = monitorEl.checked ? 1 : 0;
});
view.puppetEl.addEventListener('change', () => {
  if (!view.puppetEnabled) view.host.relax();
});
for (const id of ['sensitivity', 'gate', 'range', 'attack', 'release', 'shapeMode']) byId(id).addEventListener('input', readSettings);

// Hook for automated browser checks; not part of the puppet interface.
Object.assign(window, {
  __mumble: {
    state: () => ({
      running: !!running,
      source: sourceEl.value,
      frame: lastFrame,
      controls: { ...view.host.controls },
      puppetEnabled: view.puppetEnabled,
      estimatorRuns,
      view: view.view,
      motion: view.motion.current,
      latency: byId('latency').textContent,
      vowelTrail: vowelTrail.length,
    }),
    start,
    stop,
  },
});

readSettings();
void listDevices();
requestAnimationFrame(frame);
