// Babble playground: English text in, invented gibberish out (Babble Engine
// direction), mouthed by the puppet face. Two sound engines can speak it:
// klattsch with our own text-to-babble, or Babble Engine end to end.

import { compilePerformance, klattschUtterance, type Utterance, type VoiceSettings } from '../voice/performance';
import { moodVoice, textToBabble, wordAtPhonemeOffset, type BabbleScript } from '../babble/generate';
import { MOODS, STYLES } from '../babble/styles';
import { tokenizeText } from '../babble/text';
import { BE_STYLES, babbleEngineUtterance, revealedIndex, type BabbleEngineUtterance } from '../engines/babbleEngine';
import { Stage, byId } from '../ui/stage';
import type { Mood as BeMood, StyleId as BeStyleId } from 'babble-engine';

const SAMPLES = [
  'Hello there! How are you today?',
  "I can't believe you ate the whole cake.",
  'Well... I suppose that is fine, if you insist.',
  'Wait, what? Where did everyone go?',
  'Welcome, traveler! The shop is open, and everything is on sale.',
];

// Babble Engine styles that speak the text (Bloopa Doopa ignores it).
const BE_TEXT_STYLES = BE_STYLES.filter((s) => s.id !== 'vemmo');

const options = (items: readonly { id: string; name: string }[]) =>
  items.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');

const inputsHtml = `
  <label class="field">Sound engine
    <select id="engine">
      <option value="klattsch">klattsch + our text-to-babble</option>
      <option value="babble-engine">Babble Engine (its own babble and voices)</option>
    </select>
  </label>
  <label class="field">Sample
    <select id="sample"><option value="">Custom text</option>${SAMPLES.map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select>
  </label>
  <label class="field">English text
    <textarea id="text" rows="3" maxlength="500"></textarea>
  </label>
  <div class="spoken" id="spoken" aria-live="off"></div>
  <div class="pair">
    <label class="field" data-for-engine="klattsch">Language style <select id="style">${options(STYLES)}</select></label>
    <label class="field" data-for-engine="babble-engine">Style <select id="beStyle">${options(BE_TEXT_STYLES)}</select></label>
    <label class="field">Mood <select id="mood">${options(MOODS)}</select></label>
  </div>
  <label class="field" data-for-engine="babble-engine">Voice <select id="beVoice"></select></label>
  <div class="pair seed">
    <label class="field">Seed <input id="seed" type="number" min="0" step="1" value="1" /></label>
    <button id="reroll" type="button">New seed</button>
  </div>
  <div data-for-engine="klattsch" class="group">
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
  </div>
  <p class="hint" data-for-engine="babble-engine">Babble Engine reports syllable starts and invented syllable text; mouth shapes come from the syllable letters, syllable ends from the audio's loudness.</p>
`;

type Spoken = { kind: 'klattsch'; script: BabbleScript } | { kind: 'babble-engine'; utterance: BabbleEngineUtterance; words: { text: string; start: number; end: number }[] };
let spoken: Spoken | null = null;

const stage = new Stage(document.querySelector<HTMLDivElement>('#app')!, {
  title: 'Babble playground',
  inputsHtml,
  compile,
  onFrame: (time, segment) => highlight(activeWordIndex(time, segment)),
  debugState: () => ({
    babble:
      spoken?.kind === 'klattsch'
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
const pitchEl = byId<HTMLInputElement>('pitch');
const rateEl = byId<HTMLInputElement>('rate');
const scaleEl = byId<HTMLInputElement>('scale');

function baseVoice(): VoiceSettings {
  return { pitchHz: Number(pitchEl.value), msPerPhoneme: Number(rateEl.value), formantScale: Number(scaleEl.value) };
}

function compile(): Utterance {
  const seed = Number(seedEl.value) || 0;
  if (engineEl.value === 'babble-engine') {
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
  spoken = { kind: 'klattsch', script };
  renderWords(script.words.map((w) => ({ text: w.text, sub: w.spelled })));
  byId('babbleOut').textContent = script.phonemes || '–';
  return klattschUtterance(compilePerformance(script.phonemes, moodVoice(baseVoice(), script.mood)));
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
  if (spoken.kind === 'klattsch') {
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
  for (const el of document.querySelectorAll<HTMLElement>('[data-for-engine]')) el.hidden = el.dataset.forEngine !== engineEl.value;
}

function changed(): void {
  byId('pitchOut').textContent = `${pitchEl.value} Hz`;
  byId('rateOut').textContent = `${rateEl.value} ms/phoneme`;
  byId('scaleOut').textContent = `×${Number(scaleEl.value).toFixed(2)}`;
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
for (const el of [styleEl, beVoiceEl, moodEl, seedEl, pitchEl, rateEl, scaleEl]) el.addEventListener('input', changed);
byId('reroll').addEventListener('click', () => {
  seedEl.value = String(Math.floor(Math.random() * 100000));
  changed();
});

textEl.value = SAMPLES[0];
sampleEl.value = '0';
fillVoices();
showEngineControls();
changed();
