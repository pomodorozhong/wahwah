import './style.css';
import { compilePerformance, renderPerformance, segmentAt, type SpeechPerformance, type VoiceSettings } from './voice/performance';
import { PRESETS } from './voice/presets';
import { generateFaceTrack, sampleFaceTrack } from './puppet/generate';
import type { FaceControlTrack, FaceControls } from './puppet/controls';
import { rmsEnvelope, syncReport, type SyncReport } from './analysis';
import { PreviewFace } from './host/face';
import { FaceHostAdapter } from './host/adapter';
import { Player } from './playback';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="layout">
    <section class="stage">
      <div id="face" class="face"></div>
      <canvas id="timeline" class="timeline" height="120"></canvas>
    </section>
    <aside class="panel">
      <h1>Mumble voice playground</h1>
      <label class="field">Preset
        <select id="preset">${PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
      </label>
      <label class="field">Phonemes (ARPABET, klattsch syntax)
        <textarea id="phonemes" rows="3" spellcheck="false"></textarea>
      </label>
      <p id="warnings" class="warnings" hidden></p>
      <label class="field slider">Pitch <output id="pitchOut"></output>
        <input id="pitch" type="range" min="60" max="300" step="1" />
      </label>
      <label class="field slider">Speaking rate <output id="rateOut"></output>
        <input id="rate" type="range" min="50" max="250" step="5" />
      </label>
      <label class="field slider">Voice size <output id="scaleOut"></output>
        <input id="scale" type="range" min="0.8" max="1.3" step="0.01" />
      </label>
      <div class="toggles">
        <label><input id="puppet" type="checkbox" checked /> Puppet output</label>
        <label><input id="idle" type="checkbox" checked /> Idle blink &amp; sway</label>
      </div>
      <div class="buttons">
        <button id="play" class="primary">Play</button>
        <button id="stop">Stop</button>
      </div>
      <p class="hint">Space plays or replays from the start. Esc stops. Editing anything stops playback.</p>
      <div class="readout">
        <div class="row"><span>Time</span><b id="time">–</b></div>
        <div class="row"><span>Active sound</span><b id="sound">–</b></div>
        ${['jawOpen', 'lipWidth', 'lipRound']
          .map((k) => `<div class="row meter"><span>${k}</span><i><em id="${k}Bar"></em></i><b id="${k}Val">0.00</b></div>`)
          .join('')}
        <div class="row meter"><span>output RMS</span><i><em id="rmsBar" class="rms"></em></i><b id="rmsVal">0.00</b></div>
      </div>
      <details class="diag" open>
        <summary>Sync diagnostics (offline render of this utterance)</summary>
        <div id="diag">–</div>
      </details>
    </aside>
  </main>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const presetSel = $<HTMLSelectElement>('preset');
const phonemesEl = $<HTMLTextAreaElement>('phonemes');
const pitchEl = $<HTMLInputElement>('pitch');
const rateEl = $<HTMLInputElement>('rate');
const scaleEl = $<HTMLInputElement>('scale');
const puppetEl = $<HTMLInputElement>('puppet');
const idleEl = $<HTMLInputElement>('idle');
const timeline = $<HTMLCanvasElement>('timeline');

const face = new PreviewFace($('face'));
const host = new FaceHostAdapter(face);
let player: Player | null = null;

interface Prepared {
  performance: SpeechPerformance;
  audio: Float32Array<ArrayBuffer>;
  sampleRate: number;
  envelope: number[];
  track: FaceControlTrack | null;
  report: SyncReport | null;
}
let prepared: Prepared | null = null;
let generatorRuns = 0;
let playCount = 0;

function voiceSettings(): VoiceSettings {
  return { pitchHz: Number(pitchEl.value), msPerPhoneme: Number(rateEl.value), formantScale: Number(scaleEl.value) };
}

function updateSliderLabels(): void {
  $('pitchOut').textContent = `${pitchEl.value} Hz`;
  $('rateOut').textContent = `${rateEl.value} ms/phoneme`;
  $('scaleOut').textContent = `×${Number(scaleEl.value).toFixed(2)}`;
}

function loadPreset(id: string): void {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  presetSel.value = p.id;
  phonemesEl.value = p.phonemes;
  pitchEl.value = String(p.voice.pitchHz);
  rateEl.value = String(p.voice.msPerPhoneme);
  scaleEl.value = String(p.voice.formantScale);
  invalidate();
}

/** Any edit stops playback, relaxes the face, and rebuilds on next play. */
function invalidate(): void {
  player?.stop();
  host.relax();
  prepared = null;
  updateSliderLabels();
  prepare();
}

function prepare(): Prepared {
  if (prepared) return prepared;
  const sampleRate = player?.sampleRate ?? 48000;
  const performance = compilePerformance(phonemesEl.value, voiceSettings());
  const audio = renderPerformance(performance, sampleRate) as Float32Array<ArrayBuffer>;
  // Puppet disabled means the instruction generator does not run at all.
  let track: FaceControlTrack | null = null;
  if (puppetEl.checked) {
    track = generateFaceTrack(performance);
    generatorRuns++;
  }
  prepared = {
    performance,
    audio,
    sampleRate,
    envelope: rmsEnvelope(audio, sampleRate),
    track,
    report: track ? syncReport(audio, sampleRate, track) : null,
  };
  const warn = $('warnings');
  warn.hidden = performance.warnings.length === 0;
  warn.textContent = performance.warnings.join('; ');
  renderDiagnostics(prepared);
  return prepared;
}

function renderDiagnostics(p: Prepared): void {
  const r = p.report;
  const rows = [
    ['duration', `${p.performance.durationSeconds.toFixed(2)} s`],
    ['segments', String(p.performance.segments.length)],
    ['peak RMS', Math.max(0, ...p.envelope).toFixed(3)],
  ];
  if (r) {
    rows.push(
      ['distinct poses', String(r.distinctPoses)],
      ['jaw↔loudness r', r.jawLoudnessCorrelation.toFixed(2)],
      ['jaw lead', `${(r.jawLeadSeconds * 1000).toFixed(0)} ms`],
    );
  } else {
    rows.push(['puppet', 'off — generator not run']);
  }
  $('diag').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
}

async function play(): Promise<void> {
  if (!player) {
    player = new Player();
    player.onEnded = () => host.relax();
    prepared = null; // re-render at the device's sample rate
  }
  const p = prepare();
  await player.play(p.audio);
  playCount++;
}

function stop(): void {
  player?.stop();
  host.relax();
}

presetSel.addEventListener('change', () => loadPreset(presetSel.value));
for (const el of [phonemesEl, pitchEl, rateEl, scaleEl]) el.addEventListener('input', invalidate);
puppetEl.addEventListener('change', invalidate);
idleEl.addEventListener('change', () => (face.idleMotion = idleEl.checked));
$('play').addEventListener('click', () => void play());
$('stop').addEventListener('click', stop);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space') { e.preventDefault(); void play(); }
  if (e.code === 'Escape') stop();
});

// ---- per-frame update -------------------------------------------------------

const fmt = (v: number) => v.toFixed(2);
function showControls(c: FaceControls, phoneme: string | null, time: number | null, rms: number): void {
  $('time').textContent = time === null ? '–' : `${Math.max(0, time).toFixed(2)} s`;
  $('sound').textContent = phoneme ?? (time === null ? '–' : 'pause');
  for (const k of ['jawOpen', 'lipWidth', 'lipRound'] as const) {
    $(`${k}Bar`).style.width = `${c[k] * 100}%`;
    $(`${k}Val`).textContent = fmt(c[k]);
  }
  $('rmsBar').style.width = `${Math.min(1, rms * 2) * 100}%`;
  $('rmsVal').textContent = fmt(rms);
}

function drawTimeline(time: number | null): void {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const w = timeline.clientWidth;
  const h = timeline.clientHeight;
  if (timeline.width !== w * dpr) { timeline.width = w * dpr; timeline.height = h * dpr; }
  const g = timeline.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const p = prepared;
  if (!p) return;
  const dur = p.performance.durationSeconds || 1;
  const x = (t: number) => (t / dur) * w;
  // Segment labels
  g.font = '10px ui-monospace, monospace';
  g.textBaseline = 'top';
  for (const s of p.performance.segments) {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x(s.startSeconds), 0, 1, h);
    g.fillStyle = '#8a93a8';
    g.fillText(s.phoneme ?? '·', x(s.startSeconds) + 2, 2);
  }
  // Audio envelope
  const peak = Math.max(1e-6, ...p.envelope);
  g.fillStyle = 'rgba(120,170,255,0.35)';
  p.envelope.forEach((v, i) => {
    const bh = (v / peak) * (h - 18);
    g.fillRect(x(i * 0.01), h - bh, Math.max(1, x(0.01)), bh);
  });
  // Face controls
  if (p.track) {
    const lines: [keyof FaceControls, string][] = [['jawOpen', '#ff8a5c'], ['lipWidth', '#7ee081'], ['lipRound', '#d68cff']];
    for (const [k, color] of lines) {
      g.strokeStyle = color;
      g.lineWidth = 1.5;
      g.beginPath();
      p.track.samples.forEach((s, i) => {
        const y = h - s[k] * (h - 18);
        if (i === 0) g.moveTo(x(s.timeSeconds), y); else g.lineTo(x(s.timeSeconds), y);
      });
      g.stroke();
    }
  }
  if (time !== null) {
    g.fillStyle = '#fff';
    g.fillRect(x(time), 0, 1.5, h);
  }
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const time = player?.position() ?? null;
  const p = prepared;
  let phoneme: string | null = null;
  if (time !== null && p) {
    phoneme = segmentAt(p.performance, time)?.phoneme ?? null;
    if (p.track) host.follow(sampleFaceTrack(p.track, time));
  }
  host.tick(dt);
  face.render(dt);
  showControls(host.controls, phoneme, time, player?.level() ?? 0);
  drawTimeline(time);
  requestAnimationFrame(frame);
}

// Hook for automated browser checks; not part of the puppet interface.
Object.assign(window, {
  __mumble: {
    state: () => ({
      playing: player?.playing ?? false,
      time: player?.position() ?? null,
      controls: { ...host.controls },
      level: player?.level() ?? 0,
      puppetEnabled: puppetEl.checked,
      generatorRuns,
      playCount,
      report: prepared?.report ?? null,
      warnings: prepared?.performance.warnings ?? [],
      audioContext: player ? { state: player.ctx.state, sampleRate: player.ctx.sampleRate, baseLatency: player.ctx.baseLatency, outputLatency: player.ctx.outputLatency } : null,
    }),
    /** Stop playback and hold a pose, e.g. for screenshots of the rig mapping. */
    holdPose: (c: FaceControls) => {
      stop();
      host.follow(c);
      face.render(0);
      return face.renderer.domElement;
    },
  },
});

loadPreset(PRESETS[0].id);
requestAnimationFrame(frame);
