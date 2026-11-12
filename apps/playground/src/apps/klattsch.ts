// klattsch playground: ARPABET phoneme input into the Rust formant voice.

import { DEFAULT_BRASS_COLOR, renderPhonemes, type VoiceSettings } from 'wahwah';
import { PRESETS } from '../voice/presets';
import { exampleShelfHtml, lineFormatHtml, markExample, type PuppetView } from '../ui/puppetView';
import { LengthControls, lengthHtml } from '../ui/lengthControls';
import { Stage, byId, section, restoreDraft } from '../ui/stage';

// What each preset is good for, shown on its card in the example shelf.
const PRESET_TAGS: Record<string, string> = {
  greeting: 'Warm', question: 'Pitch bends', grumble: 'Low and slow', chatter: 'Fast', lips: 'Checks mouth shapes',
};
const EXAMPLES = PRESETS.map(p => ({ name: p.name.replace(/ \(diagnostic\)$/, ''), text: p.phonemes, tag: PRESET_TAGS[p.id] ?? '' }));

const inputHtml = `
  <section class="script-editor" aria-labelledby="phonemesTitle">
    <div class="script-heading">
      <h2 id="phonemesTitle"><label for="phonemes">Phonemes</label></h2>
    </div>
    ${exampleShelfHtml(EXAMPLES)}
    ${lineFormatHtml('klattsch')}
    <div class="writing-sheet">
      <textarea id="phonemes" rows="4" spellcheck="false" placeholder="HH EH L OW" aria-describedby="phonemeFormat"></textarea>
      <span id="phonemeFormat" class="sheet-meta">ARPABET · klattsch syntax</span>
    </div>
  </section>`;

const voiceHtml =
  section(
    '<span>Voice</span><span class="engine-lock">klattsch formant voice</span>',
    `<p class="hint">Phoneme scripts always play on the klattsch formant voice. Set Trombone color to zero to hear the plain voice.</p>
    <label class="field slider">Pitch <output id="pitchOut"></output>
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
    lengthHtml,
    fit: () => length.fit,
    compile: (sampleRate, puppet) => length.render(sampleRate, (limit, fitOptions) => renderPhonemes(phonemesEl.value, voiceSettings(), sampleRate,
      { engine: 'formant', brassColor: Number(brassEl.value) / 100 }, puppet, limit, fitOptions)),
  });
  const length = new LengthControls(signal, () => changed());

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
    length.refresh();
    markExample(PRESETS.findIndex(p => p.phonemes === phonemesEl.value));
    stage.invalidate();
  }

  function loadPreset(id: string): void {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
    phonemesEl.value = p.phonemes;
    pitchEl.value = String(p.voice.pitchHz);
    rateEl.value = String(p.voice.msPerPhoneme);
    scaleEl.value = String(p.voice.formantScale);
    changed();
  }

  byId('group-0').addEventListener('click', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLButtonElement>('.example');
    if (card) loadPreset(PRESETS[Number(card.dataset.example)].id);
  }, { signal });
  phonemesEl.addEventListener('input', changed, { signal });
  for (const el of [pitchEl, rateEl, scaleEl, brassEl]) el.addEventListener('input', changed, { signal });

  restoreDraft(root, signal, draft);
  if ('phonemes' in draft) changed();
  else loadPreset(PRESETS[0].id);
}
