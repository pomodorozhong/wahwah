// Live playground: real-time microphone (or test signal) -> live voice
// analysis -> puppet instructions -> face or debug puppet.

import { DEFAULT_LIVE, LiveMouthEstimator, type LiveFrame } from '../live/estimator';
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
          <option value="test">Test signal (looped babble, played aloud)</option>
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
      <label><input id="lipShape" type="checkbox" checked /> Estimate lip shape from the spectrum (experimental)</label>`,
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
    lipShape: byId<HTMLInputElement>('lipShape').checked,
  };
  byId('sensitivityOut').textContent = `×${num('sensitivity').toFixed(2)}`;
  byId('gateOut').textContent = `${num('gate')} dB`;
  byId('rangeOut').textContent = `${num('range')} dB`;
  byId('attackOut').textContent = `${num('attack')} ms`;
  byId('releaseOut').textContent = `${num('release')} ms`;
}

function testSignal(ctx: AudioContext): AudioBufferSourceNode {
  const script = textToBabble('Hello there! Testing, one two three. Can you see my mouth move? Oh, wonderful.', { seed: 9 });
  const perf = compilePerformance(script.phonemes, moodVoice(DEFAULT_VOICE, script.mood));
  const pcm = renderPerformance(perf, ctx.sampleRate) as Float32Array<ArrayBuffer>;
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
      const src = testSignal(ctx);
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
        ['source', sourceEl.value === 'mic' ? 'microphone' : 'test signal'],
        ['level', f ? `${f.levelDb.toFixed(1)} dBFS` : '–'],
        ['noise floor', f ? `${f.floorDb.toFixed(1)} dBFS` : '–'],
        ['recent peak', f ? `${f.peakDb.toFixed(1)} dBFS` : '–'],
        ['opens above', f ? `${f.thresholdDb.toFixed(1)} dBFS` : '–'],
        ['voiced', f ? (f.voiced ? 'yes' : 'no') : '–'],
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
    }
    frameDts.push(dt);
    if (frameDts.length > 60) frameDts.shift();
    const f = lastFrame;
    const levelDb = 20 * Math.log10(Math.max(level, 1e-7));
    history.push({ t, levelDb, floorDb: f?.floorDb ?? -90, thresholdDb: f?.thresholdDb ?? -90, c: controls ?? { ...NEUTRAL } });
    while (history.length && history[0].t < t - HISTORY_SECONDS) history.shift();
  }
  view.update(dt, controls);
  view.showReadout(running ? (now - running.started) / 1000 : null, lastFrame ? (lastFrame.voiced ? 'voice' : 'quiet') : null, level);
  drawTimeline(t);
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
for (const id of ['sensitivity', 'gate', 'range', 'attack', 'release', 'lipShape']) byId(id).addEventListener('input', readSettings);

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
    }),
    start,
    stop,
  },
});

readSettings();
void listDevices();
requestAnimationFrame(frame);
