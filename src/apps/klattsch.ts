// klattsch playground: ARPABET phoneme input straight into klattsch.

import { compilePerformance, type VoiceSettings } from '../voice/performance';
import { PRESETS } from '../voice/presets';
import { Stage, byId } from '../ui/stage';

const inputsHtml = `
  <label class="field">Preset
    <select id="preset">${PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
  </label>
  <label class="field">Phonemes (ARPABET, klattsch syntax)
    <textarea id="phonemes" rows="3" spellcheck="false"></textarea>
  </label>
  <label class="field slider">Pitch <output id="pitchOut"></output>
    <input id="pitch" type="range" min="60" max="300" step="1" />
  </label>
  <label class="field slider">Speaking rate <output id="rateOut"></output>
    <input id="rate" type="range" min="50" max="250" step="5" />
  </label>
  <label class="field slider">Voice size <output id="scaleOut"></output>
    <input id="scale" type="range" min="0.8" max="1.3" step="0.01" />
  </label>
`;

const stage = new Stage(document.querySelector<HTMLDivElement>('#app')!, {
  title: 'klattsch playground',
  inputsHtml,
  compile: () => compilePerformance(phonemesEl.value, voiceSettings()),
});

const presetSel = byId<HTMLSelectElement>('preset');
const phonemesEl = byId<HTMLTextAreaElement>('phonemes');
const pitchEl = byId<HTMLInputElement>('pitch');
const rateEl = byId<HTMLInputElement>('rate');
const scaleEl = byId<HTMLInputElement>('scale');

function voiceSettings(): VoiceSettings {
  return { pitchHz: Number(pitchEl.value), msPerPhoneme: Number(rateEl.value), formantScale: Number(scaleEl.value) };
}

function updateSliderLabels(): void {
  byId('pitchOut').textContent = `${pitchEl.value} Hz`;
  byId('rateOut').textContent = `${rateEl.value} ms/phoneme`;
  byId('scaleOut').textContent = `×${Number(scaleEl.value).toFixed(2)}`;
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

presetSel.addEventListener('change', () => loadPreset(presetSel.value));
for (const el of [phonemesEl, pitchEl, rateEl, scaleEl]) el.addEventListener('input', changed);

loadPreset(PRESETS[0].id);
