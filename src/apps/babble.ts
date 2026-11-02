// Babble playground: English text in, invented gibberish out (Babble Engine
// direction), mouthed by the puppet face. Three sound engines can speak it:
// klattsch or the wah-wah trombone with our own text-to-babble, or Babble
// Engine end to end.

import { compilePerformance, DEFAULT_BRASS_COLOR, klattschUtterance, type Utterance, type VoiceSettings } from '../voice/performance';
import { moodVoice, textToBabble, wordAtPhonemeOffset, type BabbleScript } from '../babble/generate';
import { MOODS, STYLES } from '../babble/styles';
import { tokenizeText } from '../babble/text';
import { BE_STYLES, babbleEngineUtterance, revealedIndex, type BabbleEngineUtterance } from '../engines/babbleEngine';
import { DEFAULT_TROMBONE, tromboneUtterance } from '../engines/trombone';
import type { PuppetView } from '../ui/puppetView';
import { Stage, byId, section, restoreDraft } from '../ui/stage';
import type { Mood as BeMood, StyleId as BeStyleId } from 'babble-engine';

const SAMPLES = [
  { name: 'A greeting', text: 'Hello there! How are you today?' },
  { name: 'The missing cake', text: "I can't believe you ate the whole cake." },
  { name: 'Reluctant agreement', text: 'Well... I suppose that is fine, if you insist.' },
  { name: 'An empty room', text: 'Wait, what? Where did everyone go?' },
  { name: 'The shopkeeper', text: 'Welcome, traveler! The shop is open, and everything is on sale.' },
  { name: 'Morning class', text: 'Good morning, class. Please open your books to page forty two. Who can tell me the answer?' },
];

type EngineId = 'klattsch' | 'trombone' | 'babble-engine';
const ENGINE_HINTS: Record<EngineId, string> = {
  klattsch: 'Trombone color starts with the original voice at 0%. Above 75%, a plunger-muted trombone takes over the voiced sounds and follows the same pitch bends.',
  trombone: 'A muted trombone plays our invented syllables: the plunger opens on vowels (wah) and closes on consonants, following the same pitch contour and the same timeline as the mouth.',
  'babble-engine': "Babble Engine invents and voices its own syllables. Mouth shapes come from its syllable letters, syllable ends from the audio's loudness.",
};

// Babble Engine styles that speak the text (Bloopa Doopa ignores it).
const BE_TEXT_STYLES = BE_STYLES.filter((s) => s.id !== 'vemmo');

const options = (items: readonly { id: string; name: string }[]) =>
  items.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
const slider = (id: string, label: string, min: number, max: number, step: number, value: number) =>
  `<label class="field slider">${label} <output id="${id}Out"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

const inputHtml = `
  <section class="script-editor" aria-labelledby="lineTitle">
    <div class="script-heading">
      <h2 id="lineTitle"><label for="text">Your line</label></h2>
      <label class="sample-picker">Sample
        <select id="sample"><option value="" disabled>Custom line</option>${SAMPLES.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}</select>
      </label>
    </div>
    <div class="writing-sheet">
      <textarea id="text" rows="4" maxlength="500" placeholder="Write something for your puppet to say." aria-describedby="charCount"></textarea>
      <span id="charCount" class="sheet-meta"></span>
    </div>
    <div class="word-preview">
      <h3>Word playback</h3>
      <div class="spoken" id="spoken" aria-live="off"></div>
    </div>
  </section>`;

const voiceHtml =
  section(
    'Engine and delivery',
    `<label class="field">Sound engine
      <select id="engine">
        <option value="klattsch">klattsch formant voice</option>
        <option value="trombone">Wah-wah trombone (muted brass)</option>
        <option value="babble-engine">Babble Engine (its own babble and voices)</option>
      </select>
    </label>
    <p class="hint" id="engineHint"></p>
    <div class="pair">
      <label class="field" data-for-engine="klattsch trombone">Language style <select id="style">${options(STYLES)}</select></label>
      <label class="field" data-for-engine="babble-engine">Style <select id="beStyle">${options(BE_TEXT_STYLES)}</select></label>
      <label class="field">Mood <select id="mood">${options(MOODS)}</select></label>
    </div>
    <label class="field" data-for-engine="babble-engine">Voice <select id="beVoice"></select></label>
    <div class="pair seed">
      <label class="field">Seed <input id="seed" type="number" min="0" step="1" value="1" /></label>
      <button id="reroll" type="button">New seed</button>
    </div>`,
  ) +
  `<div data-for-engine="klattsch trombone">${section(
    'Voice settings',
    `${slider('pitch', 'Pitch', 60, 300, 1, 130)}
    ${slider('rate', 'Speaking rate', 50, 200, 5, 95)}
    <div data-for-engine="klattsch" class="section-body">
      ${slider('scale', 'Voice size', 0.8, 1.3, 0.01, 1.05)}
      ${slider('brass', 'Trombone color', 0, 100, 5, DEFAULT_BRASS_COLOR * 100)}
    </div>
    <div data-for-engine="trombone" class="section-body">
      ${slider('brightness', 'Brassiness', 0, 1, 0.05, DEFAULT_TROMBONE.brightness)}
      ${slider('wah', 'Plunger wah', 0.2, 1, 0.05, DEFAULT_TROMBONE.wah)}
      ${slider('transpose', 'Transpose', -12, 12, 1, DEFAULT_TROMBONE.transpose)}
    </div>
    <details><summary class="hint">Generated klattsch phonemes</summary><code id="babbleOut" class="babble-out"></code></details>`,
  )}</div>`;

type Spoken =
  | { kind: 'script'; script: BabbleScript }
  | { kind: 'babble-engine'; utterance: BabbleEngineUtterance; words: { text: string; start: number; end: number }[] };
const draft: Record<string, string> = {};

export function mountBabble(root: HTMLElement, view: PuppetView, signal: AbortSignal): void {
  let spoken: Spoken | null = null;

  const stage = new Stage(root, view, signal, {

    inputHtml,
    voiceHtml,
    compile,
    onFrame: (time, segment) => highlight(activeWordIndex(time, segment)),
    debugState: () => ({
      babble:
        spoken?.kind === 'script'
          ? { phonemes: spoken.script.phonemes, words: spoken.script.words.map((w) => [w.text, w.spelled]) }
          : spoken && { syllables: spoken.utterance.syllables.map((s) => s.text), segments: spoken.utterance.timeline.segments.length },
      spokenWord: activeWord,
    }),
  });

  const engineEl = byId<HTMLSelectElement>('engine');
  const sampleEl = byId<HTMLSelectElement>('sample');
  const textEl = byId<HTMLTextAreaElement>('text');
  const styleEl = byId<HTMLSelectElement>('style');
  const beStyleEl = byId<HTMLSelectElement>('beStyle');
  const beVoiceEl = byId<HTMLSelectElement>('beVoice');
  const moodEl = byId<HTMLSelectElement>('mood');
  const seedEl = byId<HTMLInputElement>('seed');
  const num = (id: string) => Number(byId<HTMLInputElement>(id).value);

  function baseVoice(): VoiceSettings {
    return { pitchHz: num('pitch'), msPerPhoneme: num('rate'), formantScale: num('scale') };
  }

  function compile(): Utterance {
    const seed = Number(seedEl.value) || 0;
    const engine = engineEl.value as EngineId;
    if (engine === 'babble-engine') {
      const utterance = babbleEngineUtterance(textEl.value, {
        style: beStyleEl.value as BeStyleId,
        voice: beVoiceEl.value || undefined,
        mood: moodEl.value as BeMood,
        seed,
      });
      const words = tokenizeText(textEl.value).flatMap((t) => (t.kind === 'word' ? [{ text: t.text, start: t.start, end: t.end }] : []));
      spoken = { kind: 'babble-engine', utterance, words };
      renderWords(words.map((w) => ({ text: w.text, sub: '' })));
      return utterance;
    }
    const script = textToBabble(textEl.value, { seed, styleId: styleEl.value, moodId: moodEl.value });
    spoken = { kind: 'script', script };
    renderWords(script.words.map((w) => ({ text: w.text, sub: w.spelled })));
    byId('babbleOut').textContent = script.phonemes || '–';
    const perf = compilePerformance(script.phonemes, moodVoice(baseVoice(), script.mood));
    if (engine === 'trombone') {
      return tromboneUtterance(perf, { brightness: num('brightness'), wah: num('wah'), transpose: num('transpose') });
    }
    return klattschUtterance(perf, num('brass') / 100);
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

  /** Show each English word, with its babble underneath when known. */
  function renderWords(words: { text: string; sub: string }[]): void {
    byId('spoken').innerHTML = words.length
      ? words.map((w, i) => `<span class="w" data-i="${i}"><b>${escapeHtml(w.text)}</b>${w.sub ? `<small>${escapeHtml(w.sub)}</small>` : ''}</span>`).join(' ')
      : '<span class="empty">Your words will appear here.</span>';
  }

  function activeWordIndex(time: number | null, segment: { srcStart: number } | null): number | null {
    if (!spoken || time === null) return null;
    if (spoken.kind === 'script') {
      const w = segment && wordAtPhonemeOffset(spoken.script, segment.srcStart);
      return w ? spoken.script.words.indexOf(w) : null;
    }
    // Babble Engine reveals text character by character; light the word being revealed.
    const ch = revealedIndex(spoken.utterance.reveal, time);
    if (ch < 0 || time > spoken.utterance.timeline.durationSeconds) return null;
    const i = spoken.words.findIndex((w) => ch < w.end);
    return i >= 0 && ch >= spoken.words[i].start - 1 ? i : null;
  }

  let activeWord: string | null = null;
  function highlight(index: number | null): void {
    const key = index === null ? null : String(index);
    if (key === activeWord) return;
    activeWord = key;
    for (const el of byId('spoken').querySelectorAll<HTMLElement>('.w')) el.classList.toggle('on', el.dataset.i === key);
  }

  function fillVoices(): void {
    const style = BE_TEXT_STYLES.find((s) => s.id === beStyleEl.value) ?? BE_TEXT_STYLES[0];
    beVoiceEl.innerHTML = style.voices.map((v) => `<option value="${v.id}">${v.name} — ${escapeHtml(v.description)}</option>`).join('');
  }

  function showEngineControls(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-for-engine]')) {
      el.hidden = !el.dataset.forEngine!.split(' ').includes(engineEl.value);
    }
    byId('engineHint').textContent = ENGINE_HINTS[engineEl.value as EngineId];
  }

  function changed(): void {
    byId('charCount').textContent = `${textEl.value.length} / ${textEl.maxLength}`;
    byId('pitchOut').textContent = `${num('pitch')} Hz`;
    byId('rateOut').textContent = `${num('rate')} ms/phoneme`;
    byId('scaleOut').textContent = `×${num('scale').toFixed(2)}`;
    byId('brassOut').textContent = `${num('brass')}%`;
    byId('brightnessOut').textContent = num('brightness').toFixed(2);
    byId('wahOut').textContent = num('wah').toFixed(2);
    byId('transposeOut').textContent = `${num('transpose') > 0 ? '+' : ''}${num('transpose')} st`;
    stage.invalidate();
  }

  function applyEngine(): void {
    const url = new URL(location.href);
    if (url.searchParams.get('engine') !== engineEl.value) {
      url.searchParams.set('engine', engineEl.value);
      history.replaceState(history.state, '', url);
    }
    showEngineControls();
    changed();
  }

  engineEl.addEventListener('change', applyEngine, { signal });
  beStyleEl.addEventListener('change', () => {
    fillVoices();
    changed();
  }, { signal });
  sampleEl.addEventListener('change', () => {
    if (sampleEl.value === '') return;
    textEl.value = SAMPLES[Number(sampleEl.value)].text;
    changed();
  }, { signal });
  textEl.addEventListener('input', () => {
    const i = SAMPLES.findIndex(s => s.text === textEl.value);
    sampleEl.value = i >= 0 ? String(i) : '';
    changed();
  }, { signal });
  for (const id of ['style', 'beVoice', 'mood', 'seed', 'pitch', 'rate', 'scale', 'brass', 'brightness', 'wah', 'transpose']) byId(id).addEventListener('input', changed, { signal });
  byId('reroll').addEventListener('click', () => {
    seedEl.value = String(Math.floor(Math.random() * 100000));
    changed();
  }, { signal });

  // ?engine=trombone etc. selects an engine on load.
  textEl.value = SAMPLES[0].text;
  sampleEl.value = '0';
  restoreDraft(root, signal, draft);
  const requested = new URLSearchParams(location.search).get('engine');
  if (requested && [...engineEl.options].some((option) => option.value === requested)) engineEl.value = requested;
  fillVoices();
  if (draft.beVoice && [...beVoiceEl.options].some((option) => option.value === draft.beVoice)) beVoiceEl.value = draft.beVoice;
  applyEngine();
}
