// Babble playground: English text in, invented gibberish out (Babble Engine
// direction), spoken by klattsch and mouthed by the puppet face.

import { compilePerformance, type VoiceSettings } from '../voice/performance';
import { moodVoice, textToBabble, wordAtPhonemeOffset, type BabbleScript } from '../babble/generate';
import { MOODS, STYLES } from '../babble/styles';
import { Stage, byId } from '../ui/stage';

const SAMPLES = [
  'Hello there! How are you today?',
  "I can't believe you ate the whole cake.",
  'Well... I suppose that is fine, if you insist.',
  'Wait, what? Where did everyone go?',
  'Welcome, traveler! The shop is open, and everything is on sale.',
];

const options = (items: readonly { id: string; name: string }[]) =>
  items.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');

const inputsHtml = `
  <label class="field">Sample
    <select id="sample"><option value="">Custom text</option>${SAMPLES.map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select>
  </label>
  <label class="field">English text
    <textarea id="text" rows="3" maxlength="500"></textarea>
  </label>
  <div class="spoken" id="spoken" aria-live="off"></div>
  <div class="pair">
    <label class="field">Language style <select id="style">${options(STYLES)}</select></label>
    <label class="field">Mood <select id="mood">${options(MOODS)}</select></label>
  </div>
  <div class="pair seed">
    <label class="field">Seed <input id="seed" type="number" min="0" step="1" value="1" /></label>
    <button id="reroll" type="button">New seed</button>
  </div>
  <label class="field slider">Pitch <output id="pitchOut"></output>
    <input id="pitch" type="range" min="60" max="300" step="1" value="130" />
  </label>
  <label class="field slider">Speaking rate <output id="rateOut"></output>
    <input id="rate" type="range" min="50" max="200" step="5" value="95" />
  </label>
  <label class="field slider">Voice size <output id="scaleOut"></output>
    <input id="scale" type="range" min="0.8" max="1.3" step="0.01" value="1.05" />
  </label>
  <details class="diag">
    <summary>Generated klattsch phonemes</summary>
    <code id="babbleOut" class="babble-out"></code>
  </details>
`;

let script: BabbleScript | null = null;

const stage = new Stage(document.querySelector<HTMLDivElement>('#app')!, {
  title: 'Babble playground',
  inputsHtml,
  compile: () => {
    script = textToBabble(textEl.value, { seed: Number(seedEl.value) || 0, styleId: styleEl.value, moodId: moodEl.value });
    renderScript(script);
    return compilePerformance(script.phonemes, moodVoice(baseVoice(), script.mood));
  },
  onFrame: (_time, segment) => highlight(segment ? (script && wordAtPhonemeOffset(script, segment.srcStart)) : null),
  debugState: () => ({ babble: script && { phonemes: script.phonemes, words: script.words.map((w) => [w.text, w.spelled]) }, spokenWord: activeWord }),
});

const sampleEl = byId<HTMLSelectElement>('sample');
const textEl = byId<HTMLTextAreaElement>('text');
const styleEl = byId<HTMLSelectElement>('style');
const moodEl = byId<HTMLSelectElement>('mood');
const seedEl = byId<HTMLInputElement>('seed');
const pitchEl = byId<HTMLInputElement>('pitch');
const rateEl = byId<HTMLInputElement>('rate');
const scaleEl = byId<HTMLInputElement>('scale');

function baseVoice(): VoiceSettings {
  return { pitchHz: Number(pitchEl.value), msPerPhoneme: Number(rateEl.value), formantScale: Number(scaleEl.value) };
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Show each English word with its babble underneath. */
function renderScript(s: BabbleScript): void {
  byId('spoken').innerHTML = s.words.length
    ? s.words.map((w, i) => `<span class="w" data-i="${i}"><b>${escapeHtml(w.text)}</b><small>${w.spelled}</small></span>`).join(' ')
    : '<span class="empty">Type some English to babble.</span>';
  byId('babbleOut').textContent = s.phonemes || '–';
}

let activeWord: string | null = null;
function highlight(word: ReturnType<typeof wordAtPhonemeOffset>): void {
  const key = word ? String(script!.words.indexOf(word)) : null;
  if (key === activeWord) return;
  activeWord = key;
  for (const el of byId('spoken').querySelectorAll<HTMLElement>('.w')) el.classList.toggle('on', el.dataset.i === key);
}

function changed(): void {
  byId('pitchOut').textContent = `${pitchEl.value} Hz`;
  byId('rateOut').textContent = `${rateEl.value} ms/phoneme`;
  byId('scaleOut').textContent = `×${Number(scaleEl.value).toFixed(2)}`;
  stage.invalidate();
}

sampleEl.addEventListener('change', () => {
  if (sampleEl.value === '') return;
  textEl.value = SAMPLES[Number(sampleEl.value)];
  changed();
});
textEl.addEventListener('input', () => {
  sampleEl.value = SAMPLES.indexOf(textEl.value) >= 0 ? String(SAMPLES.indexOf(textEl.value)) : '';
  changed();
});
for (const el of [styleEl, moodEl, seedEl, pitchEl, rateEl, scaleEl]) el.addEventListener('input', changed);
byId('reroll').addEventListener('click', () => {
  seedEl.value = String(Math.floor(Math.random() * 100000));
  changed();
});

textEl.value = SAMPLES[0];
sampleEl.value = '0';
changed();
