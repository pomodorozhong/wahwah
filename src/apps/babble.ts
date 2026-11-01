// Babble playground: English text in, invented gibberish out (Babble Engine
// direction), mouthed by the puppet face. Three sound engines can speak it:
// klattsch or the wah-wah trombone with our own text-to-babble, or Babble
// Engine end to end.

import { compilePerformance, klattschUtterance, type Utterance, type VoiceSettings } from '../voice/performance';
import { moodVoice, textToBabble, wordAtPhonemeOffset, type BabbleScript } from '../babble/generate';
import { MOODS, STYLES } from '../babble/styles';
import { tokenizeText } from '../babble/text';
import { BE_STYLES, babbleEngineUtterance, revealedIndex, type BabbleEngineUtterance } from '../engines/babbleEngine';
import { DEFAULT_TROMBONE, tromboneUtterance } from '../engines/trombone';
import { Stage, byId, section } from '../ui/stage';
import type { Mood as BeMood, StyleId as BeStyleId } from 'babble-engine';

const SAMPLES = [
  'Hello there! How are you today?',
  "I can't believe you ate the whole cake.",
  'Well... I suppose that is fine, if you insist.',
  'Wait, what? Where did everyone go?',
  'Welcome, traveler! The shop is open, and everything is on sale.',
  'Good morning, class. Please open your books to page forty two. Who can tell me the answer?',
];

type EngineId = 'klattsch' | 'trombone' | 'babble-engine';
const ENGINE_HINTS: Record<EngineId, string> = {
  klattsch: 'klattsch formant synth speaks our invented syllables.',
  trombone: 'A muted trombone plays our invented syllables: the plunger opens on vowels (wah) and closes on consonants, following the same pitch contour and the same timeline as the mouth.',
  'babble-engine': "Babble Engine invents and voices its own syllables. Mouth shapes come from its syllable letters, syllable ends from the audio's loudness.",
};

// Babble Engine styles that speak the text (Bloopa Doopa ignores it).
const BE_TEXT_STYLES = BE_STYLES.filter((s) => s.id !== 'vemmo');

const options = (items: readonly { id: string; name: string }[]) =>
  items.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
const slider = (id: string, label: string, min: number, max: number, step: number, value: number) =>
  `<label class="field slider">${label} <output id="${id}Out"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

const panelHtml =
  section(
    'Text',
    `<label class="field">Sample
      <select id="sample"><option value="">Custom text</option>${SAMPLES.map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select>
    </label>
    <textarea id="text" rows="3" maxlength="500" aria-label="English text"></textarea>
    <div class="spoken" id="spoken" aria-live="off"></div>`,
  ) +
  section(
    'Engine and character',
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
    'Voice',
    `${slider('pitch', 'Pitch', 60, 300, 1, 130)}
    ${slider('rate', 'Speaking rate', 50, 200, 5, 95)}
    <div data-for-engine="klattsch">${slider('scale', 'Voice size', 0.8, 1.3, 0.01, 1.05)}</div>
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
let spoken: Spoken | null = null;

const stage = new Stage(document.querySelector<HTMLDivElement>('#app')!, {
  title: 'Babble playground',
  panelHtml,
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
  return klattschUtterance(perf);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Show each English word, with its babble underneath when known. */
function renderWords(words: { text: string; sub: string }[]): void {
  byId('spoken').innerHTML = words.length
    ? words.map((w, i) => `<span class="w" data-i="${i}"><b>${escapeHtml(w.text)}</b><small>${w.sub}</small></span>`).join(' ')
    : '<span class="empty">Type some English to babble.</span>';
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
  for (const el of document.querySelectorAll<HTMLElement>('[data-for-engine]')) {
    el.hidden = !el.dataset.forEngine!.split(' ').includes(engineEl.value);
  }
  byId('engineHint').textContent = ENGINE_HINTS[engineEl.value as EngineId];
}

function changed(): void {
  byId('pitchOut').textContent = `${num('pitch')} Hz`;
  byId('rateOut').textContent = `${num('rate')} ms/phoneme`;
  byId('scaleOut').textContent = `×${num('scale').toFixed(2)}`;
  byId('brightnessOut').textContent = num('brightness').toFixed(2);
  byId('wahOut').textContent = num('wah').toFixed(2);
  byId('transposeOut').textContent = `${num('transpose') > 0 ? '+' : ''}${num('transpose')} st`;
  stage.invalidate();
}

engineEl.addEventListener('change', () => {
  showEngineControls();
  changed();
});
beStyleEl.addEventListener('change', () => {
  fillVoices();
  changed();
});
sampleEl.addEventListener('change', () => {
  if (sampleEl.value === '') return;
  textEl.value = SAMPLES[Number(sampleEl.value)];
  changed();
});
textEl.addEventListener('input', () => {
  const i = SAMPLES.indexOf(textEl.value);
  sampleEl.value = i >= 0 ? String(i) : '';
  changed();
});
for (const id of ['style', 'beVoice', 'mood', 'seed', 'pitch', 'rate', 'scale', 'brightness', 'wah', 'transpose']) byId(id).addEventListener('input', changed);
byId('reroll').addEventListener('click', () => {
  seedEl.value = String(Math.floor(Math.random() * 100000));
  changed();
});

// ?engine=trombone etc. selects an engine on load.
const requested = new URLSearchParams(location.search).get('engine');
if (requested && [...engineEl.options].some((o) => o.value === requested)) engineEl.value = requested;
textEl.value = SAMPLES[0];
sampleEl.value = '0';
fillVoices();
showEngineControls();
changed();
