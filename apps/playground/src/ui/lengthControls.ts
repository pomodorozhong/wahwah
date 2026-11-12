// Length card shared by the Text and Phonemes lines: cap the line's duration, then shape the
// speed-up, volume and fade. Every control stays in view; with the cap off they are disabled.
import { type RenderedUtterance, type FadeCurve, type SpeedProfile, type FitOptions } from 'wahwah/performance';
import { fastestDuration, fitCurves, type FitPlotData } from './fitCurves';
import { rmsEnvelope } from '../analysis';
import { byId, section } from './puppetView';

const slider = (id: string, label: string, min: number, max: number, step: number, value: number) =>
  `<label class="field slider">${label} <output id="${id}Out"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

export const lengthHtml = section(
  'Length',
  `<div class="length-groups">
  <div class="length-group">
    <h4 class="subhead">Cap</h4>
    <label class="field cap-switch"><input id="useCap" type="checkbox" /> Cap the length of the line</label>
    ${slider('cap', 'Maximum duration', 0.5, 30, 0.5, 3)}
    <label class="field"><input id="cutWord" type="checkbox" checked /> Cut between words (keep the last word whole)</label>
    <p class="hint fit-status" id="fitOut"></p>
    <p class="hint cap-off-note" id="capOffNote">Turn on the cap to use these settings.</p>
  </div>
  <div class="length-group">
    <h4 class="subhead">Speed-up</h4>
    <label class="field">Speed-up shape
      <select id="speedProfile">
        <option value="constant">Steady</option>
        <option value="rampUp">Ramp up (faster toward the end)</option>
        <option value="rampDown">Ramp down (fast start, slows down)</option>
        <option value="smooth">Eased ramp up</option>
      </select>
    </label>
    ${slider('speedMax', 'Top speed', 1, 3, 0.05, 1.6)}
  </div>
  <div class="length-group">
    <h4 class="subhead">Volume</h4>
    <label class="field">Volume shape
      <select id="volProfile">
        <option value="constant">Steady</option>
        <option value="rampUp">Ramp up (from normal to the level)</option>
        <option value="rampDown">Ramp down (from the level to normal)</option>
        <option value="smooth">Eased ramp up</option>
      </select>
    </label>
    ${slider('volLevel', 'Volume level', 0, 200, 5, 100)}
  </div>
  <div class="length-group">
    <h4 class="subhead">Fade at the cut</h4>
    <label class="field">Fade shape
      <select id="fadeCurve">
        <option value="linear">Linear</option>
        <option value="smooth">Smooth (half cosine)</option>
        <option value="quick">Quick drop</option>
        <option value="decibel">Even to the ear (decibels)</option>
        <option value="none">None (hard cut)</option>
      </select>
    </label>
    ${slider('fadeMs', 'Fade length', 0, 2000, 10, 80)}
    ${slider('fadeBend', 'Fade bend', 0.2, 5, 0.1, 1)}
    ${slider('fadeEnd', 'End volume', 0, 100, 5, 0)}
  </div>
  </div>`,
);

const FIELDS = ['useCap', 'cap', 'cutWord', 'speedProfile', 'speedMax', 'volProfile', 'volLevel', 'fadeCurve', 'fadeMs', 'fadeBend', 'fadeEnd'];
const num = (id: string) => Number(byId<HTMLInputElement>(id).value);
// Text and Phonemes share one set of Length values for the visit, so switching keeps the cap.
const saved: Record<string, string | boolean> = {};

export class LengthControls {
  private lastFit: FitPlotData | null = null;

  /** Wire the card's fields; `changed` rebuilds the line after any edit. */
  constructor(signal: AbortSignal, changed: () => void) {
    for (const id of FIELDS) {
      const el = byId<HTMLInputElement | HTMLSelectElement>(id);
      if (id in saved) {
        if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = saved[id] === true;
        else el.value = String(saved[id]);
      }
      el.addEventListener('input', () => { this.refresh(); changed(); }, { signal });
    }
    signal.addEventListener('abort', () => {
      for (const id of FIELDS) {
        const el = byId<HTMLInputElement | HTMLSelectElement>(id);
        saved[id] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
      }
    }, { once: true });
  }

  /** The current line's fit, drawn on the playback monitor, or null when the cap is off. */
  get fit(): FitPlotData | null {
    return this.lastFit;
  }

  private cap(): number | undefined {
    return byId<HTMLInputElement>('useCap').checked ? num('cap') : undefined;
  }

  private options(): FitOptions {
    return {
      cutFade: { curve: byId<HTMLSelectElement>('fadeCurve').value as FadeCurve, milliseconds: num('fadeMs'), exponent: num('fadeBend'), endVolume: num('fadeEnd') / 100 },
      speedUp: { profile: byId<HTMLSelectElement>('speedProfile').value as SpeedProfile, max: num('speedMax') },
      cutAt: byId<HTMLInputElement>('cutWord').checked ? 'word' : 'anywhere',
      volume: { profile: byId<HTMLSelectElement>('volProfile').value as SpeedProfile, level: num('volLevel') / 100 },
    };
  }

  /** Update the value labels, and disable every setting but the cap switch while the cap is off. */
  refresh(): void {
    byId('capOut').textContent = `${num('cap').toFixed(1)} s`;
    byId('fadeMsOut').textContent = `${num('fadeMs')} ms`;
    byId('fadeBendOut').textContent = `×${num('fadeBend').toFixed(1)}`;
    byId('fadeEndOut').textContent = `${num('fadeEnd')}%`;
    byId('volLevelOut').textContent = `${num('volLevel')}%`;
    byId('speedMaxOut').textContent = `×${num('speedMax').toFixed(2)}`;
    const capOn = byId<HTMLInputElement>('useCap').checked;
    for (const el of byId('group-2').querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')) {
      if (el.id !== 'useCap') el.disabled = !capOn;
    }
    byId('group-2').classList.toggle('cap-off', !capOn);
    byId('capOffNote').hidden = capOn;
  }

  /** Render the line under the current cap, then report the fit on the monitor and in the card. */
  render<T extends RenderedUtterance>(sampleRate: number, renderAt: (limit: number | undefined, options: FitOptions) => T): T {
    const cap = this.cap();
    const options = this.options();
    const p = renderAt(cap, options);
    const f = p.fit;
    const seconds = p.audio.length / sampleRate;
    const cutBelow = (natural: number) => fastestDuration(options.speedUp?.profile, options.speedUp?.max ?? 1.6, natural);
    this.lastFit = cap === undefined ? null : { seconds, capSeconds: cap, fit: f, options, tail: null };
    // Render the whole line once more so the monitor can show what the cut removed.
    if (this.lastFit && f?.truncated) {
      const full = renderAt(undefined, options);
      const curves = fitCurves(this.lastFit);
      const envelope = rmsEnvelope(full.audio, sampleRate).map((v, i) => ({ t: curves.outputTime(i * 0.01), v }));
      const track = full.track && {
        ...full.track,
        samples: full.track.samples.map(sample => ({ ...sample, timeSeconds: curves.outputTime(sample.timeSeconds) })),
      };
      this.lastFit.tail = { envelope, track, seconds: curves.outputTime(full.audio.length / sampleRate) };
    }
    // A short form for the monitor, beside the curves it describes.
    byId('monitorNote').textContent = cap === undefined ? '' : !f
      ? `Fits in ${seconds.toFixed(2)} s · no speed-up`
      : `${f.naturalSeconds.toFixed(2)} s line · ×${f.speed.toFixed(2)} avg, peak ×${f.peakSpeed.toFixed(2)} · ${!f.truncated ? 'not cut' : f.atWord ? `cut after a word at ${f.cutSeconds?.toFixed(2)} s` : `cut at ${cap.toFixed(1)} s`}`;
    byId('fitOut').textContent = cap === undefined ? '' : !f
      ? `Fits: ${seconds.toFixed(2)} s, under the cap. The fade only applies to a cut line, so lower the cap below ${cutBelow(seconds).toFixed(1)} s to hear it.`
      : !f.truncated
      ? `Natural length ${f.naturalSeconds.toFixed(2)} s, sped up ×${f.speed.toFixed(2)} on average (peak ×${f.peakSpeed.toFixed(2)}) to fit. Not cut, so the fade does not apply. Lower the cap below ${cutBelow(f.naturalSeconds).toFixed(1)} s to cut it.`
      : `Natural length ${f.naturalSeconds.toFixed(2)} s, sped up ×${f.speed.toFixed(2)} on average (peak ×${f.peakSpeed.toFixed(2)})${f.atWord ? `, then cut after the last whole word at ${f.cutSeconds?.toFixed(2)} s` : ', then cut at the cap'}.${p.warnings.length ? ' ' + p.warnings.join(' ') : ''}`;
    return p;
  }
}
