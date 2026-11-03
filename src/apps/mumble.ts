// Mumble playground: ordinary text becomes invented speech, audio and mouth
// movement in Rust. Talking Instruments use their own explicit note score.
import { DEFAULT_BRASS_COLOR, type RenderedUtterance, type VoiceSettings } from '../voice/performance';
import { renderMumble, renderInstrument, type InstrumentPerformance } from '../voice/rustVoice';
import { wordAtPhonemeOffset, type MumbleScript } from '../mumble/generate';
import { MOODS, STYLES } from '../mumble/styles';
import { INSTRUMENTS, isInstrument, type InstrumentId } from '../voice/instruments';
import { DEFAULT_TROMBONE } from '../engines/trombone';
import type { PuppetView } from '../ui/puppetView';
import { Stage, byId, section, restoreDraft } from '../ui/stage';

const SAMPLES = [
  { name: 'A greeting', text: 'Hello there! How are you today?' },
  { name: 'The missing cake', text: "I can't believe you ate the whole cake." },
  { name: 'Reluctant agreement', text: 'Well... I suppose that is fine, if you insist.' },
  { name: 'An empty room', text: 'Wait, what? Where did everyone go?' },
  { name: 'The shopkeeper', text: 'Welcome, traveler! The shop is open, and everything is on sale.' },
  { name: 'Morning class', text: 'Good morning, class. Please open your books to page forty two. Who can tell me the answer?' },
];

type EngineId = 'klattsch' | 'trombone' | InstrumentId;
const ENGINE_HINTS: Record<EngineId, string> = {
  klattsch: 'Trombone color starts with the original voice at 0%. Above 75%, a plunger-muted trombone takes over the voiced sounds and follows the same pitch bends.',
  trombone: 'A muted trombone plays our invented syllables: the plunger opens on vowels (wah) and closes on consonants, following the same pitch contour and the same timeline as the mouth.',
  'muted-horn': 'Bright muted brass with a plunger wah and sliding speech-like notes.',
  'talking-trombone': 'Talking Instruments’ low, wobbly brass voice, with its own note phrasing.',
  'ooh-choir': 'Three soft ooh voices sing notes snapped to a pentatonic scale.',
  kazoo: 'A hummed tune through a buzzing membrane, with a nasal resonance.',
};

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
        <option value="trombone">Wah-wah trombone (muted brass)</option>
        <option value="klattsch">klattsch formant voice</option>
        ${options(INSTRUMENTS)}
      </select>
    </label>
    <p class="hint" id="engineHint"></p>
    <div class="pair">
      <label class="field" data-for-engine="klattsch trombone">Language style <select id="style">${options(STYLES)}</select></label>
      <label class="field">Mood <select id="mood">${options(MOODS)}</select></label>
    </div>
    <div class="pair seed">
      <label class="field">Seed <input id="seed" type="number" min="0" step="1" value="1" /></label>
      <button id="reroll" type="button">New seed</button>
    </div>`,
  ) +
  `${section(
    'Voice settings',
    `<div data-for-engine="klattsch trombone">${slider('pitch', 'Pitch', 60, 300, 1, 130)}
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
    </div>
    <div data-for-engine="muted-horn talking-trombone ooh-choir kazoo">
      ${slider('instrumentPitch', 'Pitch', 60, 600, 1, 330)}
      ${slider('instrumentSpeed', 'Speaking speed', 0.5, 2, 0.05, 1)}
      ${slider('instrumentExpression', 'Expression', 0, 1, 0.05, 0.7)}
      ${slider('instrumentBrightness', 'Brightness', 0, 1, 0.05, 0.55)}
    </div>
    <details data-for-engine="klattsch trombone"><summary class="hint">Generated klattsch phonemes</summary><code id="mumbleOut" class="mumble-out"></code></details>`,
  )}`;

type Spoken =
  | { kind: 'script'; script: MumbleScript }
  | { kind: 'instrument'; performance: InstrumentPerformance; words: { text: string; start: number; end: number }[] };
const draft: Record<string, string> = {};
const instrumentDrafts: Record<string, string[]> = {};
const instrumentFields = ['instrumentPitch', 'instrumentSpeed', 'instrumentExpression', 'instrumentBrightness'];

export function mountMumble(root: HTMLElement, view: PuppetView, signal: AbortSignal): void {
  let spoken: Spoken | null = null;

  const stage = new Stage(root, view, signal, {

    inputHtml,
    voiceHtml,
    compile,
    onFrame: (time, segment) => highlight(activeWordIndex(time, segment)),
    debugState: () => ({
      mumble:
        spoken?.kind === 'script'
          ? { phonemes: spoken.script.phonemes, words: spoken.script.words.map((w) => [w.text, w.spelled]) }
          : spoken && { notes: spoken.performance.notes, segments: spoken.performance.timeline.segments.length },
      spokenWord: activeWord,
    }),
  });

  const engineEl = byId<HTMLSelectElement>('engine');
  const sampleEl = byId<HTMLSelectElement>('sample');
  const textEl = byId<HTMLTextAreaElement>('text');
  const styleEl = byId<HTMLSelectElement>('style');
  const moodEl = byId<HTMLSelectElement>('mood');
  const seedEl = byId<HTMLInputElement>('seed');
  const num = (id: string) => Number(byId<HTMLInputElement>(id).value);

  function baseVoice(): VoiceSettings {
    return { pitchHz: num('pitch'), msPerPhoneme: num('rate'), formantScale: num('scale') };
  }

  function compile(sampleRate: number, puppet: boolean): RenderedUtterance {
    const seed = Number(seedEl.value) || 0;
    const engine = engineEl.value as EngineId;
    if (isInstrument(engine)) {
      const performance = renderInstrument(textEl.value, {
        instrument: engine, pitchHz: num('instrumentPitch'), speed: num('instrumentSpeed'),
        expression: num('instrumentExpression'), brightness: num('instrumentBrightness'), seed, moodId: moodEl.value,
      }, sampleRate, puppet);
      const ranges = new Map(performance.notes.map(n => [n.srcStart, n.srcEnd]));
      const words = [...ranges].map(([start, end]) => ({ text: textEl.value.slice(start, end), start, end }));
      spoken = { kind: 'instrument', performance, words };
      renderWords(words.map(w => ({ text: w.text, sub: '' })));
      return performance;
    }
    const performance = renderMumble(textEl.value, { seed, styleId: styleEl.value, moodId: moodEl.value }, baseVoice(), sampleRate,
      engine === 'trombone'
        ? { engine: 'trombone', trombone: { brightness: num('brightness'), wah: num('wah'), transpose: num('transpose') } }
        : { engine: 'formant', brassColor: num('brass') / 100 }, puppet);
    const script = performance.script;
    spoken = { kind: 'script', script };
    renderWords(script.words.map(w => ({ text: w.text, sub: w.spelled })));
    byId('mumbleOut').textContent = script.phonemes || '–';
    return performance;
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

  /** Show each English word, with its Mumble spelling underneath when known. */
  function renderWords(words: { text: string; sub: string }[]): void {
    byId('spoken').innerHTML = words.length
      ? words.map((w, i) => `<span class="w" data-i="${i}"><b>${escapeHtml(w.text)}</b>${w.sub ? `<small>${escapeHtml(w.sub)}</small>` : ''}</span>`).join(' ')
      : '<span class="empty">Your words will appear here.</span>';
  }

  function activeWordIndex(time: number | null, segment: { srcStart: number; phoneme: string | null } | null): number | null {
    if (!spoken || time === null || !segment?.phoneme) return null;
    if (spoken.kind === 'script') {
      const w = segment && wordAtPhonemeOffset(spoken.script, segment.srcStart);
      return w ? spoken.script.words.indexOf(w) : null;
    }
    const index = spoken.words.findIndex(w => segment.srcStart >= w.start && segment.srcStart < w.end);
    return index >= 0 ? index : null;
  }

  let activeWord: string | null = null;
  function highlight(index: number | null): void {
    const key = index === null ? null : String(index);
    if (key === activeWord) return;
    activeWord = key;
    for (const el of byId('spoken').querySelectorAll<HTMLElement>('.w')) el.classList.toggle('on', el.dataset.i === key);
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
    byId('instrumentPitchOut').textContent = `${num('instrumentPitch')} Hz`;
    byId('instrumentSpeedOut').textContent = `×${num('instrumentSpeed').toFixed(2)}`;
    byId('instrumentExpressionOut').textContent = `${Math.round(num('instrumentExpression') * 100)}%`;
    byId('instrumentBrightnessOut').textContent = `${Math.round(num('instrumentBrightness') * 100)}%`;
    byId('transposeOut').textContent = `${num('transpose') > 0 ? '+' : ''}${num('transpose')} st`;
    stage.invalidate();
  }

  let lastEngine = '';
  function applyEngine(): void {
    if (isInstrument(lastEngine)) instrumentDrafts[lastEngine] = instrumentFields.map(id => byId<HTMLInputElement>(id).value);
    if (isInstrument(engineEl.value) && engineEl.value !== lastEngine) {
      const preset = INSTRUMENTS.find(p => p.id === engineEl.value)!;
      const values = instrumentDrafts[engineEl.value] ?? [preset.pitchHz, preset.speed, preset.expression, preset.brightness].map(String);
      instrumentFields.forEach((id, i) => { byId<HTMLInputElement>(id).value = values[i]; });
    }
    lastEngine = engineEl.value;
    const url = new URL(location.href);
    if (url.searchParams.get('engine') !== engineEl.value) {
      url.searchParams.set('engine', engineEl.value);
      history.replaceState(history.state, '', url);
    }
    showEngineControls();
    changed();
  }

  engineEl.addEventListener('change', applyEngine, { signal });
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
  for (const id of ['style', 'instrumentPitch', 'instrumentSpeed', 'instrumentExpression', 'instrumentBrightness', 'mood', 'seed', 'pitch', 'rate', 'scale', 'brass', 'brightness', 'wah', 'transpose']) byId(id).addEventListener('input', changed, { signal });
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
  if (isInstrument(engineEl.value) && draft.engine === engineEl.value) {
    instrumentDrafts[engineEl.value] = instrumentFields.map(id => byId<HTMLInputElement>(id).value);
  }
  applyEngine();
}
