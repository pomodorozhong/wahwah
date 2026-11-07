// klattsch playground: ARPABET phoneme input into the Rust formant voice.

import { DEFAULT_BRASS_COLOR, renderPhonemes, type VoiceSettings } from 'wahwah';
import { PRESETS } from '../voice/presets';
import type { PuppetView } from '../ui/puppetView';
import { Stage, byId, section, restoreDraft } from '../ui/stage';

const inputHtml = `
  <section class="script-editor" aria-labelledby="phonemesTitle">
    <div class="script-heading">
      <h2 id="phonemesTitle"><label for="phonemes">Phonemes</label></h2>
      <label class="sample-picker">Preset
        <select id="preset"><option value="" disabled>Custom phrase</option>${PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
      </label>
    </div>
    <div class="writing-sheet">
      <textarea id="phonemes" rows="4" spellcheck="false" placeholder="HH EH L OW" aria-describedby="phonemeFormat"></textarea>
      <span id="phonemeFormat" class="sheet-meta">ARPABET · klattsch syntax</span>
    </div>
  </section>`;

const voiceHtml =
  section(
    'Voice settings',
    `<label class="field slider">Pitch <output id="pitchOut"></output>
      <input id="pitch" type="range" min="60" max="300" step="1" />
    </label>
    <label class="field slider">Speaking rate <output id="rateOut"></output>
      <input id="rate" type="range" min="50" max="250" step="5" />
    </label>
    <label class="field slider">Voice size <output id="scaleOut"></output>
      <input id="scale" type="range" min="0.8" max="1.3" step="0.01" />
    </label>
    <label class="field slider">Trombone color <output id="brassOut"></output>
      <input id="brass" type="range" min="0" max="100" step="5" value="${DEFAULT_BRASS_COLOR * 100}" />
    </label>`,
  );

const draft: Record<string, string> = {};

export function mountKlattsch(root: HTMLElement, view: PuppetView, signal: AbortSignal): void {
  const stage = new Stage(root, view, signal, {

    inputHtml,
    voiceHtml,
    compile: (sampleRate, puppet) => renderPhonemes(phonemesEl.value, voiceSettings(), sampleRate,
      { engine: 'formant', brassColor: Number(brassEl.value) / 100 }, puppet),
  });

  const presetSel = byId<HTMLSelectElement>('preset');
  const phonemesEl = byId<HTMLTextAreaElement>('phonemes');
  const pitchEl = byId<HTMLInputElement>('pitch');
  const rateEl = byId<HTMLInputElement>('rate');
  const scaleEl = byId<HTMLInputElement>('scale');
  const brassEl = byId<HTMLInputElement>('brass');

  function voiceSettings(): VoiceSettings {
    return { pitchHz: Number(pitchEl.value), msPerPhoneme: Number(rateEl.value), formantScale: Number(scaleEl.value) };
  }

  function updateSliderLabels(): void {
    byId('pitchOut').textContent = `${pitchEl.value} Hz`;
    byId('rateOut').textContent = `${rateEl.value} ms/phoneme`;
    byId('scaleOut').textContent = `×${Number(scaleEl.value).toFixed(2)}`;
    byId('brassOut').textContent = `${brassEl.value}%`;
  }

  function changed(): void {
    updateSliderLabels();
    stage.invalidate();
  }

  function loadPreset(id: string): void {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
    presetSel.value = p.id;
    phonemesEl.value = p.phonemes;
    pitchEl.value = String(p.voice.pitchHz);
    rateEl.value = String(p.voice.msPerPhoneme);
    scaleEl.value = String(p.voice.formantScale);
    changed();
  }

  presetSel.addEventListener('change', () => loadPreset(presetSel.value), { signal });
  phonemesEl.addEventListener('input', () => {
    presetSel.value = '';
    changed();
  }, { signal });
  for (const el of [pitchEl, rateEl, scaleEl, brassEl]) el.addEventListener('input', changed, { signal });

  restoreDraft(root, signal, draft);
  if ('phonemes' in draft) changed();
  else loadPreset(PRESETS[0].id);
}
