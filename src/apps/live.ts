// Live playground: real-time microphone (or test signal) -> live voice
// analysis -> puppet instructions -> face or debug puppet.

import { DEFAULT_LIVE, LiveMouthEstimator, type LiveFrame, type ShapeMode } from '../live/estimator';
import { REFERENCE_VOWELS } from '../live/vowels';
import { renderSweep, PT_VOWELS } from '../live/ptVoice';
import { frameFeatures, parseProfile, serializeProfile, type ProfileClassId, type VoiceProfile } from '../live/profile';
import { CalibrationRunner } from '../ui/calibrationUi';
import { ulsInputLength } from '../live/ulipsync';
import analysisWorkletUrl from '../live/analysisWorklet.ts?worker&url';
import type { FromWorklet, ToWorklet } from '../live/analysisWorklet';
import recorderWorkletUrl from '../live/recorderWorklet.ts?worker&url';
import { analyseRecording, measureMouthLagMs, mouthAt, planPlayback, type AnalysedRecording, type PlaybackPlan } from '../live/delayTest';
import { magnitudeSpectrumDb } from '../live/features';
import { NEUTRAL, type FaceControls } from '../puppet/controls';
import { demoStepAudio, liveSpeechAudio } from '../live/demoVoice';
import { PuppetView, byId, fitCanvas, renderMode, disclosure, section } from '../ui/puppetView';
import { rmsEnvelope } from '../analysis';
import { MONITOR_SIGNALS, MONITOR_COLORS, beginMonitor, drawMonitorLegend, drawMonitorPlayhead } from '../ui/monitorTheme';

const FFT = 1024; // short analysis window (~21 ms at 48 kHz)
const BUFFER = 4096; // time-domain history; uLipSync-style mode uses the last 64 ms
const HISTORY_SECONDS = 6;

const SHAPE_MODE_HELP: Record<ShapeMode, string> = {
  profile: 'Matches the sounds learned during your calibration and blends their mouth shapes. No F1/F2 position is measured, so the Vowel map has no moving circle.',
  ulipsync: 'Matches your calibrated sounds and smooths their mouth shapes with a spring. Use uLipSync smoothness to adjust the response. No F1/F2 position is measured, so the Vowel map has no moving circle.',
  formants: 'Estimates vowel resonances (F1/F2), hissing sounds and closed lips without calibration. Detected vowels also appear as a moving circle on the Vowel map.',
  centroid: 'Uses the sound’s brightness to approximate wide or rounded lips, without calibration. No F1/F2 position is measured, so the Vowel map has no moving circle.',
  off: 'Uses loudness to open and close the jaw, leaving lip width and rounding neutral. No F1/F2 position is measured, so the Vowel map has no moving circle.',
};

const slider = (id: string, label: string, min: number, max: number, step: number, value: number) =>
  `<label class="field slider">${label} <output id="${id}Out"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

// Retain the user's controls and last take while they visit the other input modes.
const liveControls = ['source', 'analysisThread', 'shapeMode', 'sensitivity', 'gate', 'range', 'attack', 'release', 'smooth', 'audioDelay'] as const;
const savedValues = new Map<string, string>();
let savedMonitor = false;
let savedLoop = true;
let savedDevice = '';
type RecordedClip = { pcm: Float32Array; sampleRate: number };
let savedClip: RecordedClip | null = null;

export function mountLive(root: HTMLElement, view: PuppetView, signal: AbortSignal): void {
  renderMode(root, {

    levelLabel: 'input level',
    transportHtml: '<button id="start" class="primary">● Start</button><button id="stop" disabled>■ Stop</button>',
    inputLabel: 'Input',
    inputHtml: section(
        'Source',
        `<label class="field">Input
          <select id="source">
            <option value="mic">Microphone</option>
            <option value="test">Test signal: Mumble sentence (klattsch, played aloud)</option>
            <option value="sweep">Test signal: vowel sweep ah·ee·oo·eh (Pink Trombone, played aloud)</option>
            <option value="demo">Demo voice: a synthetic speaker who also answers the calibration prompts</option>
          </select>
        </label>
        <label class="field" id="deviceField">Microphone device <select id="device"><option value="">Default</option></select></label>
        <label><input id="monitor" type="checkbox" /> Hear the microphone (use headphones)</label>
        <p class="hint" id="sourceHint">Your audio stays in this page; nothing is recorded or sent anywhere.</p>`,
      ) +
      section(
        'Voice profile',
        `<p class="hint" id="profileStatus">No profile yet. Calibrate once (about 30 seconds) so the face reads your own voice, mic and room instead of a textbook reference.</p>
        <div class="profile-buttons">
          <button id="calibrate" class="primary" type="button">Calibrate my voice</button>
          <button id="exportProfile" type="button" disabled>Export</button>
          <label class="file-button">Import<input id="importProfile" type="file" accept=".json,application/json" hidden /></label>
          <button id="clearProfile" type="button" disabled>Forget</button>
        </div>
        <ul class="profile-report" id="profileReport"></ul>`,
      ),
    voiceHtml: section(
        'Response',
        `${slider('sensitivity', 'Sensitivity', 0.5, 3, 0.05, DEFAULT_LIVE.sensitivity)}
        ${slider('gate', 'Gate above noise floor', 2, 24, 1, DEFAULT_LIVE.gateDb)}
        ${slider('range', 'Loudness range to full open', 10, 50, 1, DEFAULT_LIVE.rangeDb)}
        ${slider('attack', 'Open time', 5, 120, 5, DEFAULT_LIVE.attackSeconds * 1000)}
        ${slider('release', 'Close time', 20, 300, 10, DEFAULT_LIVE.releaseSeconds * 1000)}
        <div id="smoothField">${slider('smooth', 'uLipSync smoothness', 0, 0.2, 0.01, DEFAULT_LIVE.smoothSeconds)}</div>
        <label class="field">Mouth shape from
          <select id="shapeMode" aria-describedby="shapeModeHint shapeModeCalibrationHint">
            <option value="profile" disabled>Your voice profile (calibrate first)</option>
            <option value="ulipsync" disabled>uLipSync-style (calibrate first)</option>
            <option value="formants">Formants: vowels, s/sh/f, closed lips</option>
            <option value="centroid">Brightness only (earlier method)</option>
            <option value="off">Loudness only (jaw)</option>
          </select>
        </label>
        <p class="hint" id="shapeModeHint"></p>
        <p class="hint" id="shapeModeCalibrationHint">Calibration selects Your voice profile, or keeps uLipSync-style if already selected. Choose Formants to see vowel positions on the map.</p>`,
      ),
    analysisHtml: section(
        'Delay test',
        `<p class="hint">Record yourself, then play it back with the audio held back so the mouth catches up, as a stream would. Try delays to feel what looks in sync.</p>
        <div class="profile-buttons">
          <button id="recStart" type="button">● Record</button>
          <button id="recStop" type="button" disabled>■ Stop</button>
          <span class="hint" id="recStatus">Nothing recorded yet (up to 20 s).</span>
        </div>
        ${slider('audioDelay', 'Audio delay', -100, 400, 5, 0)}
        <div class="profile-buttons">
          <button id="playRec" type="button" class="primary" disabled>▶ Play back</button>
          <button id="stopRec" type="button" disabled>■ Stop</button>
          <button id="matchLag" type="button" disabled>Match measured lag</button>
          <label><input id="loopRec" type="checkbox" checked /> Loop</label>
        </div>
        <p class="hint" id="lagStatus"></p>`,
      ) +
      section(
        'Vowel map',
        `<canvas id="vowelMap" class="vowel-map" aria-describedby="vowelMapHint"></canvas>
        <p class="hint" id="vowelMapHint">F1 (openness, down) and F2 (front, left) place your voice against the reference vowels. The circle shows the latest detected vowel; the fading trail covers the last second.</p>
        <p class="hint">To see the circle, start the input, enable Puppet output, and select Formants under Voice → Mouth shape from. Other modes do not measure F1/F2 and show no circle. Silence and unvoiced sounds may also leave the map empty.</p>`,
      ) +
      disclosure(
        'Latency',
        `<label class="field">Analysis runs on
          <select id="analysisThread">
            <option value="worklet">Audio thread (worklet), every 5.3 ms</option>
            <option value="main">Page, once per screen refresh (earlier method)</option>
          </select>
        </label>
        <div id="latency">Start the input to measure.</div>
        <p class="hint">Mic-to-mouth delay is input latency + analysis window + open-time smoothing + one display frame. Lower the open time for snappier motion, at the cost of jitter.</p>`,
      ),
  });

  const estimator = new LiveMouthEstimator();
  const timeline = byId<HTMLCanvasElement>('timeline');
  const sourceEl = byId<HTMLSelectElement>('source');
  const deviceEl = byId<HTMLSelectElement>('device');
  const monitorEl = byId<HTMLInputElement>('monitor');
  const startBtn = byId<HTMLButtonElement>('start');
  const stopBtn = byId<HTMLButtonElement>('stop');
  const shapeModeEl = byId<HTMLSelectElement>('shapeMode');
  const PROFILE_KEY = 'wahwah.voiceProfile.v1';
  /** Where profiles were stored before the rename to wahwah. */
  const LEGACY_PROFILE_KEY = 'mumble.voiceProfile.v1';
  let profile: VoiceProfile | null = null;

  interface Running {
    ctx: AudioContext;
    analyser: AnalyserNode;
    stream: MediaStream | null;
    nodes: AudioNode[];
    monitor: GainNode | null;
    started: number;
    /** Audio-thread analysis node, when the analysis runs there. */
    worklet: AudioWorkletNode | null;
  }
  let running: Running | null = null;
  let pending: Running | null = null;
  let lastFrame: LiveFrame | null = null;
  let frameDts: number[] = [];
  let estimatorRuns = 0;
  /** Worklet stats: hop length and recent analysis cost. */
  const WORKLET_HOP = 256;
  let workletLevel = 0;
  let workletCostMs: number[] = [];
  const threadEl = () => byId<HTMLSelectElement>('analysisThread');
  const history: { t: number; levelDb: number; floorDb: number; thresholdDb: number; c: FaceControls }[] = [];
  const timeBuf = new Float32Array(BUFFER);

  function readSettings(): void {
    const num = (id: string) => Number(byId<HTMLInputElement>(id).value);
    estimator.settings = {
      sensitivity: num('sensitivity'),
      gateDb: num('gate'),
      rangeDb: num('range'),
      attackSeconds: num('attack') / 1000,
      releaseSeconds: num('release') / 1000,
      smoothSeconds: num('smooth'),
      shapeMode: byId<HTMLSelectElement>('shapeMode').value as ShapeMode,
    };
    byId('sensitivityOut').textContent = `×${num('sensitivity').toFixed(2)}`;
    byId('gateOut').textContent = `${num('gate')} dB`;
    byId('rangeOut').textContent = `${num('range')} dB`;
    byId('attackOut').textContent = `${num('attack')} ms`;
    byId('releaseOut').textContent = `${num('release')} ms`;
    byId('smoothOut').textContent = num('smooth') === 0 ? 'off' : `${(num('smooth') * 1000).toFixed(0)} ms`;
    byId('smoothField').hidden = byId<HTMLSelectElement>('shapeMode').value !== 'ulipsync';
    byId('shapeModeHint').textContent = SHAPE_MODE_HELP[estimator.settings.shapeMode];
    syncWorklet();
    if (clip) analyseClip(); // the delay test follows the current settings
  }

  function post(msg: ToWorklet): void {
    running?.worklet?.port.postMessage(msg);
  }

  /** Send the current settings, profile and switches to the audio-thread analysis. */
  function syncWorklet(): void {
    if (!running?.worklet) return;
    post({ type: 'settings', settings: { ...estimator.settings } });
    post({ type: 'profile', profile });
    post({ type: 'enabled', puppet: view.puppetEnabled });
    post({ type: 'calibrating', on: calibration.running });
  }

  function onWorkletFrame(msg: FromWorklet): void {
    workletLevel = msg.level;
    workletCostMs.push(msg.costMs);
    if (workletCostMs.length > 400) workletCostMs.shift();
    if (msg.features && calibration.running) calibration.frame(msg.time * 1000, msg.features);
    if (msg.frame) {
      lastFrame = msg.frame;
      estimatorRuns++;
      if (msg.frame.f1 && msg.frame.f2) vowelTrail.push({ t: performance.now() / 1000, f1: msg.frame.f1, f2: msg.frame.f2 });
    }
  }

  function testSignal(ctx: AudioContext, kind: 'test' | 'sweep' | 'demo'): AudioBufferSourceNode {
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
      pcm = liveSpeechAudio(kind, ctx.sampleRate) as Float32Array<ArrayBuffer>;
    }
    const buffer = ctx.createBuffer(1, pcm.length + ctx.sampleRate, ctx.sampleRate); // 1 s gap between loops
    buffer.copyToChannel(pcm, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  async function start(): Promise<void> {
    if (signal.aborted) return;
    stop();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = BUFFER;
    analyser.smoothingTimeConstant = 0;
    const nodes: AudioNode[] = [];
    const input: Running = { ctx, analyser, nodes, stream: null, monitor: null, worklet: null, started: performance.now() };
    pending = input;
    try {
      if (sourceEl.value === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceEl.value ? { exact: deviceEl.value } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (pending !== input) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        input.stream = stream;
        const src = ctx.createMediaStreamSource(stream);
        src.connect(analyser);
        const monitor = input.monitor = ctx.createGain();
        monitor.gain.value = monitorEl.checked ? 1 : 0;
        src.connect(monitor).connect(ctx.destination);
        nodes.push(src, monitor);
        void listDevices();
      } else {
        const src = testSignal(ctx, sourceEl.value as 'test' | 'sweep' | 'demo');
        src.connect(analyser);
        src.connect(ctx.destination);
        src.start();
        nodes.push(src);
      }
      if (threadEl().value === 'worklet') {
        await ctx.audioWorklet.addModule(analysisWorkletUrl);
        if (pending !== input) return;
        const worklet = input.worklet = new AudioWorkletNode(ctx, 'mouth-analysis', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          processorOptions: { hop: WORKLET_HOP },
        });
        // A silent path to the output keeps the node in the processing graph.
        const sink = ctx.createGain();
        sink.gain.value = 0;
        worklet.connect(sink).connect(ctx.destination);
        for (const n of nodes) if (!(n instanceof GainNode)) n.connect(worklet);
        worklet.port.onmessage = (e: MessageEvent<FromWorklet>) => {
          if (running === input) onWorkletFrame(e.data);
        };
        nodes.push(worklet, sink);
      }
      await ctx.resume();
    } catch (err) {
      if (pending !== input) return;
      stop();
      byId('sourceHint').textContent = `Could not start input: ${(err as Error).message}`;
      return;
    }
    if (pending !== input) return;
    pending = null;
    estimator.reset();
    history.length = 0;
    frameDts = [];
    input.started = performance.now();
    running = input;
    workletCostMs = [];
    syncWorklet();
    stopBtn.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = '↻ Restart';
    byId('sourceHint').textContent =
      sourceEl.value === 'mic' ? 'Listening. Your audio stays in this page; nothing is recorded or sent anywhere.' : 'Playing the test signal through the analyzer and the speakers.';
  }

  function stop(): void {
    const input = running ?? pending;
    running = pending = null;
    calibration.cancel();
    if (!input) return;
    if (recorder) finishRecording(recorder);
    input.worklet?.port.close();
    input.nodes.forEach((n) => {
      if (n instanceof AudioScheduledSourceNode) n.stop();
      n.disconnect();
    });
    input.stream?.getTracks().forEach((t) => t.stop());
    if (input.ctx.state !== 'closed') void input.ctx.close();
    startBtn.disabled = false;
    lastFrame = null;
    view.follower.relax();
    stopBtn.disabled = true;
    startBtn.textContent = '● Start';
  }

  async function listDevices(): Promise<void> {
    const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) ?? [];
    if (signal.aborted) return;
    const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId);
    const current = deviceEl.value || savedDevice;
    deviceEl.replaceChildren(new Option('Default', ''), ...inputs.map((d, i) => new Option(d.label || `Microphone ${i + 1}`, d.deviceId)));
    deviceEl.value = inputs.some((d) => d.deviceId === current) ? current : '';
  }

  // ---- voice profile -----------------------------------------------------------

  function afterCurrentInput(delay: number, callback: () => void): void {
    const input = running;
    setTimeout(() => { if (!signal.aborted && input && running === input) callback(); }, delay);
  }

  const calibration = new CalibrationRunner(
    byId('calibrationTools'),
    {
      onStep: (step) => {
        if (!running || sourceEl.value !== 'demo') return;
        playClip(demoStepAudio(step.id, running.ctx.sampleRate) as Float32Array<ArrayBuffer> | null);
        // The demo speaker also "clicks" I'm quiet on the quiet step.
        if (step.id === 'silence') afterCurrentInput(600, () => calibration.confirmQuiet());
      },
      onFinish: (p) => {
        applyProfile(p, true);
        // Back to the demo sentence, after this display frame (start() swaps the input).
        if (running && sourceEl.value === 'demo') afterCurrentInput(0, () => void start());
      },
      onCancel: () => {
        syncWorklet();
        if (running && sourceEl.value === 'demo') afterCurrentInput(0, () => void start());
      },
    },
    () => running?.ctx.sampleRate ?? 48000,
    signal,
  );

  /** Replace a test source with a one-shot clip (or silence) during calibration. */
  function playClip(pcm: Float32Array<ArrayBuffer> | null): void {
    if (!running) return;
    // Replace only the audio sources; keep the analysis worklet and its sink.
    for (const n of running.nodes) {
      if (n instanceof AudioScheduledSourceNode) {
        n.stop();
        n.disconnect();
      }
    }
    running.nodes = running.nodes.filter((n) => !(n instanceof AudioScheduledSourceNode));
    if (!pcm) return;
    const buffer = running.ctx.createBuffer(1, pcm.length, running.ctx.sampleRate);
    buffer.copyToChannel(pcm, 0);
    const src = running.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(running.analyser);
    if (running.worklet) src.connect(running.worklet);
    src.connect(running.ctx.destination);
    src.start();
    running.nodes.push(src);
  }

  async function startCalibration(): Promise<void> {
    if (!running) await start();
    if (!running) return; // the input could not start; the source hint says why
    calibration.start(performance.now());
    syncWorklet();
  }

  const LABELS: Record<ProfileClassId, string> = { silence: 'quiet', AA: 'aa', IY: 'ee', UW: 'oo', EH: 'eh', OW: 'oh', M: 'mm', S: 'ss', SH: 'sh' };

  function applyProfile(p: VoiceProfile | null, fresh = false): void {
    profile = p;
    estimator.setProfile(p);
    const profileOption = shapeModeEl.querySelector<HTMLOptionElement>('option[value="profile"]')!;
    profileOption.disabled = !p;
    profileOption.textContent = p ? 'Your voice profile (calibrated)' : 'Your voice profile (calibrate first)';
    const ulsOption = shapeModeEl.querySelector<HTMLOptionElement>('option[value="ulipsync"]')!;
    ulsOption.disabled = !p?.uls;
    ulsOption.textContent = !p
      ? 'uLipSync-style (calibrate first)'
      : p.uls
        ? 'uLipSync-style (calibrated, spring-smoothed)'
        : 'uLipSync-style (calibrate again to enable)';
    byId<HTMLButtonElement>('exportProfile').disabled = !p;
    byId<HTMLButtonElement>('clearProfile').disabled = !p;
    byId<HTMLButtonElement>('calibrate').textContent = p ? 'Calibrate again' : 'Calibrate my voice';
    const report = byId('profileReport');
    if (!p) {
      report.innerHTML = '';
      byId('profileStatus').textContent = 'No profile yet. Calibrate once (about 30 seconds) so the face reads your own voice, mic and room instead of a textbook reference.';
      if (shapeModeEl.value === 'profile') shapeModeEl.value = 'formants';
      readSettings();
      return;
    }
    const when = new Date(p.createdAt).toLocaleString();
    const errors = p.quality.messages.filter((m) => m.level === 'error').length;
    byId('profileStatus').textContent = errors
      ? `Profile from ${when} is incomplete: ${errors} sound${errors > 1 ? 's' : ''} missing. The rest is used; calibrate again for better results.`
      : `Using your voice profile from ${when}. Room noise ${p.noiseFloorDb.toFixed(0)} dBFS, voice ${p.vowelLevelDb.toFixed(0)} dBFS.`;
    const icon = { ok: '✓', warn: '!', error: '✗' } as const;
    const accuracy = (Object.entries(p.quality.accuracy) as [ProfileClassId, number][])
      .map(([id, a]) => `<span class="acc${a < 0.75 ? " low" : ""}">${LABELS[id]} ${(a * 100).toFixed(0)}%</span>`)
      .join(' ');
    report.innerHTML =
      p.quality.messages.map((m) => `<li class="${m.level}"><b>${icon[m.level]}</b><span>${escapeHtml(m.text)}</span></li>`).join('') +
      `<li class="ok accuracy"><b>≈</b><span>Recognized from the others: ${accuracy}</span></li>`;
    if (fresh) {
      // Use the levels measured during calibration.
      byId<HTMLInputElement>('gate').value = String(p.suggested.gateDb);
      byId<HTMLInputElement>('range').value = String(p.suggested.rangeDb);
      try {
        localStorage.setItem(PROFILE_KEY, serializeProfile(p));
      } catch {
        // Storage unavailable (private mode): the profile still works until reload; Export keeps it.
      }
    }
    if (shapeModeEl.value !== 'ulipsync' || !p.uls) shapeModeEl.value = 'profile';
    readSettings();
  }

  const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

  function loadStoredProfile(): void {
    try {
      const text = localStorage.getItem(PROFILE_KEY) ?? localStorage.getItem(LEGACY_PROFILE_KEY);
      if (text) applyProfile(parseProfile(text));
    } catch {
      // Missing, unreadable or outdated: start without a profile.
    }
  }

  function exportProfile(): void {
    if (!profile) return;
    const blob = new Blob([serializeProfile(profile)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voice-profile-${profile.createdAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importProfile(file: File): Promise<void> {
    try {
      const text = await file.text();
      if (signal.aborted) return;
      const p = parseProfile(text);
      applyProfile(p);
      try {
        localStorage.setItem(PROFILE_KEY, serializeProfile(p));
      } catch {
        // Not persisted; still active for this visit.
      }
    } catch (err) {
      if (signal.aborted) return;
      byId('profileStatus').textContent = `Could not import that file: ${(err as Error).message}`;
    }
  }

  function forgetProfile(): void {
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    } catch {
      // Nothing stored.
    }
    applyProfile(null);
  }

  // ---- delay test: record, then play back with delayed audio -----------------

  const MAX_RECORD_SECONDS = 20;
  let recorder: { node: AudioWorkletNode; sink: GainNode; chunks: Float32Array[]; sampleRate: number; startedMs: number } | null = null;
  let clip: RecordedClip | null = savedClip;
  let analysed: AnalysedRecording | null = null;
  let clipEnvelope: number[] = [];
  let measuredLagMs = 0;
  let playback: { ctx: AudioContext; src: AudioBufferSourceNode; plan: PlaybackPlan; delayMs: number } | null = null;
  const audioDelayEl = () => byId<HTMLInputElement>('audioDelay');

  async function startRecording(): Promise<void> {
    stopPlayback();
    if (!running) await start();
    const input = running;
    if (!input || recorder) return;
    try {
      await input.ctx.audioWorklet.addModule(recorderWorkletUrl);
    } catch (err) {
      if (input === running) byId('recStatus').textContent = `Could not record: ${(err as Error).message}`;
      return;
    }
    if (input !== running || recorder) return;
    const node = new AudioWorkletNode(input.ctx, 'pcm-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const sink = input.ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(input.ctx.destination);
    for (const n of input.nodes) if (n instanceof AudioScheduledSourceNode || n instanceof MediaStreamAudioSourceNode) n.connect(node);
    const rec = { node, sink, chunks: [] as Float32Array[], sampleRate: input.ctx.sampleRate, startedMs: performance.now() };
    node.port.onmessage = (e: MessageEvent<{ type: 'chunk'; chunk: Float32Array } | { type: 'done' }>) => {
      if (recorder !== rec) return;
      if (e.data.type === 'chunk') rec.chunks.push(e.data.chunk);
      else finishRecording(rec);
    };
    recorder = rec;
    byId<HTMLButtonElement>('recStart').disabled = true;
    byId<HTMLButtonElement>('recStop').disabled = false;
  }

  function stopRecording(): void {
    recorder?.node.port.postMessage({ type: 'stop' });
  }

  function finishRecording(rec: NonNullable<typeof recorder>): void {
    rec.node.port.close();
    rec.node.disconnect();
    rec.sink.disconnect();
    recorder = null;
    const length = rec.chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Float32Array(length);
    let o = 0;
    for (const c of rec.chunks) {
      pcm.set(c, o);
      o += c.length;
    }
    if (length === 0 && signal.aborted) return;
    clip = { pcm, sampleRate: rec.sampleRate };
    analysed = null;
    if (signal.aborted) return;
    byId<HTMLButtonElement>('recStart').disabled = false;
    byId<HTMLButtonElement>('recStop').disabled = true;
    byId<HTMLButtonElement>('playRec').disabled = length === 0;
    byId('recStatus').textContent = `Recorded ${(length / rec.sampleRate).toFixed(1)} s.`;
    analyseClip();
  }

  /** Analyse the clip with the current mode, settings and profile (as live would). */
  function analyseClip(): void {
    if (!clip) return;
    analysed = analyseRecording(clip.pcm, clip.sampleRate, { ...estimator.settings }, profile, WORKLET_HOP);
    clipEnvelope = rmsEnvelope(clip.pcm, clip.sampleRate);
    measuredLagMs = measureMouthLagMs(clip.pcm, analysed);
    byId<HTMLButtonElement>('matchLag').disabled = false;
    renderLagStatus();
  }

  function renderLagStatus(): void {
    const el = byId('lagStatus');
    const delay = Number(audioDelayEl().value);
    byId('audioDelayOut').textContent = `${delay > 0 ? '+' : ''}${delay} ms`;
    if (!analysed) {
      el.textContent = '';
      return;
    }
    const off = measuredLagMs - delay;
    el.textContent =
      `In this clip the mouth trails the sound by ≈${measuredLagMs.toFixed(0)} ms (${estimator.settings.shapeMode} mode). ` +
      (Math.abs(off) < 10 ? `With ${delay} ms of audio delay they line up.` : off > 0 ? `With ${delay} ms of audio delay the mouth is still ≈${off.toFixed(0)} ms late.` : `With ${delay} ms of audio delay the mouth is ≈${(-off).toFixed(0)} ms early.`);
  }

  function playClipBack(): void {
    if (!clip?.pcm.length) return;
    if (!analysed) analyseClip();
    stopPlayback();
    stop(); // pause live input so it does not mix with the playback
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const buffer = ctx.createBuffer(1, clip.pcm.length, clip.sampleRate);
    buffer.copyToChannel(clip.pcm as Float32Array<ArrayBuffer>, 0);
    const delayMs = Number(audioDelayEl().value);
    const schedule = () => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const plan = planPlayback(ctx.currentTime, delayMs);
      src.start(plan.audioStart);
      return { src, plan };
    };
    void ctx.resume();
    const first = schedule();
    playback = { ctx, ...first, delayMs };
    byId<HTMLButtonElement>('stopRec').disabled = false;
  }

  function stopPlayback(): void {
    if (!playback) return;
    try {
      playback.src.stop();
    } catch {
      // not started yet
    }
    void playback.ctx.close();
    playback = null;
    view.follower.relax();
    byId<HTMLButtonElement>('stopRec').disabled = true;
  }

  /** Context time currently reaching the speakers. */
  function audibleTime(ctx: AudioContext): number {
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime !== undefined && ts.performanceTime) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    return ctx.currentTime - (ctx.outputLatency || 0);
  }

  /** Mouth for the playback right now, or null when not playing. Restarts loops. */
  function playbackControls(): { controls: FaceControls; t: number } | null {
    if (!playback || !analysed) return null;
    const t = audibleTime(playback.ctx) - playback.plan.mouthZero;
    const end = analysed.duration + Math.max(0, playback.delayMs / 1000) + 0.4;
    if (t > end) {
      if (byId<HTMLInputElement>('loopRec').checked) {
        const ctx = playback.ctx;
        const buffer = playback.src.buffer!;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        const plan = planPlayback(ctx.currentTime, playback.delayMs);
        src.start(plan.audioStart);
        playback = { ...playback, src, plan };
      } else {
        stopPlayback();
      }
      return null;
    }
    return { controls: view.puppetEnabled ? mouthAt(analysed, t) : { ...NEUTRAL }, t };
  }

  function renderLatency(): void {
    if (!running) return;
    const ctx = running.ctx;
    const windowSamples = estimator.settings.shapeMode === 'ulipsync' ? ulsInputLength(ctx.sampleRate) : FFT;
    const windowMs = (windowSamples / ctx.sampleRate) * 1000;
    const frameMs = frameDts.length ? (frameDts.reduce((a, b) => a + b, 0) / frameDts.length) * 1000 : 0;
    const trackLatency = running.stream?.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
    const inputMs = (trackLatency?.latency ?? ctx.baseLatency ?? 0) * 1000;
    const uls = estimator.settings.shapeMode === 'ulipsync';
    const smoothMs = (uls ? estimator.settings.smoothSeconds : estimator.settings.attackSeconds) * 1000;
    // Analysis cadence: every worklet hop, or once per screen frame. On average a
    // sound waits half a cadence to be analysed and half a frame to be drawn.
    const cadenceMs = running.worklet ? (WORKLET_HOP / ctx.sampleRate) * 1000 : frameMs;
    const total = inputMs + windowMs / 2 + smoothMs + cadenceMs / 2 + frameMs / 2;
    const cost = [...workletCostMs].sort((a, b) => a - b);
    const rows = [
      ['input latency', `${inputMs.toFixed(1)} ms${trackLatency?.latency === undefined ? ' (baseLatency)' : ''}`],
      ['analysis window', `${windowMs.toFixed(1)} ms (${windowSamples} samples)`],
      [uls ? 'spring smoothing' : 'open smoothing', `${smoothMs.toFixed(0)} ms`],
      ['analysis cadence', running.worklet ? `${cadenceMs.toFixed(1)} ms (audio thread)` : `${cadenceMs.toFixed(1)} ms (per frame)`],
      ['display frame', `${frameMs.toFixed(1)} ms`],
      ...(running.worklet && cost.length ? [['audio-thread cost', `${cost[cost.length >> 1]} ms median, ${cost[Math.floor(cost.length * 0.99)]} ms p99`]] : []),
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

  /** Input history keeps its absolute dBFS scale so gate and floor stay meaningful. */
  function drawTimeline(now: number): void {
    const { g, w, h } = fitCanvas(timeline);
    const { top, bottom } = beginMonitor(g, w, h);
    const plotHeight = Math.max(0, bottom - top);
    const t0 = now - HISTORY_SECONDS;
    const x = (t: number) => ((t - t0) / HISTORY_SECONDS) * w;
    const yDb = (db: number) => bottom - Math.min(1, Math.max(0, (db + 90) / 90)) * plotHeight;

    if (history.length) {
      g.beginPath();
      g.moveTo(x(history[0].t), bottom);
      for (const point of history) g.lineTo(x(point.t), yDb(point.levelDb));
      g.lineTo(x(history[history.length - 1].t), bottom);
      g.closePath();
      g.fillStyle = MONITOR_COLORS.fill;
      g.fill();
    }
    for (const [key, color, dash] of [
      ['floorDb', MONITOR_COLORS.floor, [2, 4]],
      ['thresholdDb', MONITOR_COLORS.threshold, [7, 4]],
    ] as const) {
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.setLineDash([...dash]);
      g.beginPath();
      history.forEach((point, i) => {
        const y = yDb(point[key]);
        if (i === 0) g.moveTo(x(point.t), y); else g.lineTo(x(point.t), y);
      });
      g.stroke();
    }
    for (const [key, color, dash] of MONITOR_SIGNALS) {
      g.strokeStyle = color;
      g.lineWidth = 1.8;
      g.lineCap = 'round';
      g.setLineDash([...dash]);
      g.beginPath();
      history.forEach((point, i) => {
        const y = bottom - point.c[key] * plotHeight;
        if (i === 0) g.moveTo(x(point.t), y); else g.lineTo(x(point.t), y);
      });
      g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = MONITOR_COLORS.labels;
    g.font = '10px ui-monospace, monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    if (w > 460) g.fillText('Input level · noise floor · opens above (dBFS)', 5, 3);
    if (w > 90) g.fillText(`last ${HISTORY_SECONDS} s`, w - 70, 3);
    drawMonitorLegend(g, w, h);
  }

  /** Draw the retained take against the same mouth clock used by delay-test playback. */
  function drawRecordedTimeline(time: number): number {
    const { g, w, h } = fitCanvas(timeline);
    const { top, bottom } = beginMonitor(g, w, h);
    if (!analysed || !playback) {
      drawMonitorLegend(g, w, h);
      return 0;
    }
    const delay = playback.delayMs / 1000;
    const start = Math.min(0, delay);
    const duration = Math.max(0.01, analysed.duration + Math.max(0, delay) - start);
    const x = (t: number) => ((t - start) / duration) * w;
    const plotHeight = Math.max(0, bottom - top);
    const yLevel = (value: number) => bottom - Math.min(1, Math.max(0, (20 * Math.log10(Math.max(value, 1e-7)) + 90) / 90)) * plotHeight;
    if (clipEnvelope.length) {
      g.fillStyle = MONITOR_COLORS.fill;
      g.beginPath();
      g.moveTo(x(delay), bottom);
      clipEnvelope.forEach((value, i) => g.lineTo(x(i * 0.01 + delay), yLevel(value)));
      g.lineTo(x(clipEnvelope.length * 0.01 + delay), bottom);
      g.closePath();
      g.fill();
    }
    for (const [key, color, dash] of MONITOR_SIGNALS) {
      g.strokeStyle = color;
      g.lineWidth = 1.8;
      g.lineCap = 'round';
      g.setLineDash([...dash]);
      g.beginPath();
      analysed.frames.forEach((point, i) => {
        const y = bottom - point[key] * plotHeight;
        if (i === 0) g.moveTo(x(point.t), y); else g.lineTo(x(point.t), y);
      });
      g.stroke();
    }
    g.setLineDash([]);
    drawMonitorPlayhead(g, x(time), h);
    drawMonitorLegend(g, w, h);
    return clipEnvelope[Math.floor((time - delay) / 0.01)] ?? 0;
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

  let animationFrame = 0;
  let last = performance.now();
  let lastPanel = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let controls: FaceControls | null = null;
    let level = 0;
    const t = now / 1000;
    // Calibration callbacks may swap the input, so work on this frame's input only.
    const input = running;
    const pb = playbackControls();
    if (pb) {
      controls = pb.controls;
      view.update(dt, controls);
      const recordedLevel = drawRecordedTimeline(pb.t);
      view.showReadout(pb.t, 'playback', recordedLevel);
      if (recorder && performance.now() - recorder.startedMs > MAX_RECORD_SECONDS * 1000) stopRecording();
      animationFrame = requestAnimationFrame(frame);
      return;
    }
    if (recorder && performance.now() - recorder.startedMs > MAX_RECORD_SECONDS * 1000) stopRecording();
    if (recorder) byId('recStatus').textContent = `Recording… ${((performance.now() - recorder.startedMs) / 1000).toFixed(1)} s`;
    if (input?.worklet) {
      // Analysis happens on the audio thread; just draw its latest result.
      level = workletLevel;
      if (view.puppetEnabled && lastFrame) controls = lastFrame;
      frameDts.push(dt);
      if (frameDts.length > 60) frameDts.shift();
      const f = lastFrame;
      history.push({ t, levelDb: 20 * Math.log10(Math.max(level, 1e-7)), floorDb: f?.floorDb ?? -90, thresholdDb: f?.thresholdDb ?? -90, c: controls ?? { ...NEUTRAL } });
      while (history.length && history[0].t < t - HISTORY_SECONDS) history.shift();
    } else if (input) {
      input.analyser.getFloatTimeDomainData(timeBuf);
      const sr = input.ctx.sampleRate;
      const shortFrame = timeBuf.subarray(BUFFER - FFT);
      const longFrame = timeBuf.subarray(BUFFER - ulsInputLength(sr));
      let sum = 0;
      for (const v of shortFrame) sum += v * v;
      level = Math.sqrt(sum / FFT);
      // Same spectrum as the tests and calibration use (Blackman window, dB).
      const specBuf = magnitudeSpectrumDb(shortFrame);
      calibration.frame(now, calibration.running ? frameFeatures(shortFrame, specBuf, sr, longFrame) : null);
      if (view.puppetEnabled) {
        lastFrame = estimator.process(shortFrame, specBuf, sr, dt, longFrame);
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
    animationFrame = requestAnimationFrame(frame);
  }

  startBtn.addEventListener('click', () => {
    stopPlayback();
    void start();
  });
  byId('recStart').addEventListener('click', () => void startRecording());
  byId('recStop').addEventListener('click', stopRecording);
  byId('playRec').addEventListener('click', playClipBack);
  byId('stopRec').addEventListener('click', stopPlayback);
  byId('matchLag').addEventListener('click', () => {
    audioDelayEl().value = String(Math.round(measuredLagMs / 5) * 5);
    renderLagStatus();
    if (playback) playClipBack();
  });
  audioDelayEl().addEventListener('input', () => {
    renderLagStatus();
    if (playback) playClipBack(); // restart with the new delay
  });
  byId('calibrate').addEventListener('click', () => void startCalibration());
  byId('exportProfile').addEventListener('click', exportProfile);
  byId('clearProfile').addEventListener('click', forgetProfile);
  byId<HTMLInputElement>('importProfile').addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void importProfile(file);
    (e.target as HTMLInputElement).value = '';
  });
  stopBtn.addEventListener('click', stop);
  sourceEl.addEventListener('change', () => {
    byId('deviceField').hidden = sourceEl.value !== 'mic';
    monitorEl.parentElement!.hidden = sourceEl.value !== 'mic';
    if (running || pending) void start();
  });
  deviceEl.addEventListener('change', () => {
    savedDevice = deviceEl.value;
    if ((running || pending) && sourceEl.value === 'mic') void start();
  });
  monitorEl.addEventListener('change', () => {
    if (running?.monitor) running.monitor.gain.value = monitorEl.checked ? 1 : 0;
  });
  view.puppetEl.addEventListener('change', () => {
    if (!view.puppetEnabled) view.follower.relax();
    syncWorklet();
  }, { signal });
  threadEl().addEventListener('change', () => {
    if (running || pending) void start();
  });
  for (const id of ['sensitivity', 'gate', 'range', 'attack', 'release', 'smooth', 'shapeMode']) byId(id).addEventListener('input', readSettings);

  // Hook for automated browser checks; not part of the puppet interface.
  Object.assign(window, {
    __wahwah: {
      state: () => ({
        running: !!running,
        source: sourceEl.value,
        frame: lastFrame,
        controls: { ...view.follower.controls },
        puppetEnabled: view.puppetEnabled,
        estimatorRuns,
        view: view.view,
        motion: view.motion.current,
        latency: byId('latency').textContent,
        vowelTrail: vowelTrail.length,
        calibration: { running: calibration.running, step: calibration.stepId, phase: calibration.phaseName },
        thread: running?.worklet ? 'worklet' : running ? 'main' : null,
        delayTest: { recording: !!recorder, clipSeconds: clip ? clip.pcm.length / clip.sampleRate : 0, measuredLagMs, playing: !!playback, delayMs: Number(audioDelayEl().value) },
        workletCost: [...workletCostMs],
        profile: profile && { classes: profile.classes.map((c) => c.id), messages: profile.quality.messages, accuracy: profile.quality.accuracy, suggested: profile.suggested },
        shapeMode: shapeModeEl.value,
      }),
      start,
      stop,
    },
  });

  loadStoredProfile();
  for (const id of liveControls) {
    const value = savedValues.get(id);
    const control = byId<HTMLInputElement | HTMLSelectElement>(id);
    if (value !== undefined && (!(control instanceof HTMLSelectElement) || Array.from(control.options).some(o => !o.disabled && o.value === value))) control.value = value;
  }
  monitorEl.checked = savedMonitor;
  byId<HTMLInputElement>('loopRec').checked = savedLoop;
  byId('deviceField').hidden = monitorEl.parentElement!.hidden = sourceEl.value !== 'mic';
  if (clip?.pcm.length) {
    byId<HTMLButtonElement>('playRec').disabled = false;
    byId('recStatus').textContent = `Recorded ${(clip.pcm.length / clip.sampleRate).toFixed(1)} s.`;
  }
  readSettings();
  renderLagStatus();
  void listDevices();
  animationFrame = requestAnimationFrame(frame);
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(animationFrame);
    for (const id of liveControls) savedValues.set(id, byId<HTMLInputElement | HTMLSelectElement>(id).value);
    savedMonitor = monitorEl.checked;
    savedLoop = byId<HTMLInputElement>('loopRec').checked;
    stopPlayback();
    stop();
    savedClip = clip;
  }, { once: true });
}
