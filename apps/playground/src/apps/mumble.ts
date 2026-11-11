// Mumble playground: ordinary text becomes invented speech, audio and mouth
// movement in Rust. Talking Instruments use their own explicit note score.
import { DEFAULT_BRASS_COLOR, renderMumble, renderInstrument, deriveVoice, VOICE_MAPPING_V1, MOODS, STYLES, INSTRUMENTS, isInstrument, DEFAULT_TROMBONE, type VoiceSettings, type InstrumentPerformance, type MumbleScript, type InstrumentId } from 'wahwah';
import { type RenderedUtterance } from 'wahwah/performance';
import { wordAtPhonemeOffset } from 'wahwah/mumble';
import type { PuppetView } from '../ui/puppetView';
import { Stage, byId, section, restoreDraft } from '../ui/stage';

const SAMPLES = [
  { name: 'A greeting', text: 'Hello there! How are you today?' },
  { name: 'The missing cake', text: "I can't believe you ate the whole cake." },
  { name: 'Reluctant agreement', text: 'Well... I suppose that is fine, if you insist.' },
  { name: 'An empty room', text: 'Wait, what? Where did everyone go?' },
  { name: 'The shopkeeper', text: 'Welcome, traveler! The shop is open, and everything is on sale.' },
  { name: 'Chinese', text: '你好，今天过得怎么样？我想去买一些水果。' },
  { name: 'Mixed English and Chinese', text: 'Hello 你好, 我今天 feel great! 谢谢你。' },
  { name: 'Japanese', text: 'こんにちは、お元気ですか？ありがとうございます。' },
  { name: 'Korean', text: '안녕하세요, 만나서 반갑습니다!' },
  { name: 'Accents and other scripts', text: 'Café déjà vu, привет мир, مرحبا' },
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
  section(
    'Character voice from a hash',
    `<label class="field"><input id="useHash" type="checkbox" /> Derive the voice from a hash</label>
    <div class="pair seed" data-hash-field>
      <label class="field">Hash (hex, 16 bytes or more) <input id="hash" type="text" spellcheck="false" autocomplete="off" value="00112233445566778899aabbccddeeff" /></label>
      <button id="rehash" type="button">Random hash</button>
    </div>
    <p class="hint" id="hashOut"></p>
    <p class="hint">The same hash always gives the same voice. While on, pitch, rate, voice size, style, seed and trombone settings come from the hash for klattsch and Wah-wah trombone. Mood stays yours.</p>`,
  ) +
  `${section(
    'Voice settings',
    `<p class="hint hash-note" id="hashNote" hidden>From hash <code id="hashNoteValue"></code>. Turn off the hash to edit these, the language style and the seed.</p>
    <div data-for-engine="klattsch trombone">${slider('pitch', 'Pitch', 60, 300, 1, 130)}
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

  const useHashEl = byId<HTMLInputElement>('useHash');
  const hashEl = byId<HTMLInputElement>('hash');

  function characterVoice() {
    const out = byId('hashOut');
    if (!useHashEl.checked) { out.textContent = ''; return null; }
    try {
      const v = deriveVoice(hashEl.value.trim(), VOICE_MAPPING_V1);
      out.textContent = `Voice: ${Math.round(v.settings.pitchHz)} Hz, ${Math.round(v.settings.msPerPhoneme)} ms/phoneme, size ×${v.settings.formantScale.toFixed(2)}, style ${v.styleId}, seed ${v.seed}, brass ${Math.round(v.brassColor * 100)}%.`;
      return v;
    } catch (e) {
      out.textContent = `Hash not used: ${e instanceof Error ? e.message : e}`;
      return null;
    }
  }

  // While a hash is applied, the controls it sets show its values and are locked.
  // The user's own values come back when the hash is turned off or becomes invalid.
  const HASHED_FIELDS = ['pitch', 'rate', 'scale', 'brass', 'brightness', 'wah', 'transpose', 'style', 'seed'];
  let manualValues: Record<string, string> | null = null;
  function showHash(): void {
    const v = characterVoice();
    const fields = HASHED_FIELDS.map(id => byId<HTMLInputElement | HTMLSelectElement>(id));
    if (v) {
      manualValues ??= Object.fromEntries(fields.map(el => [el.id, el.value]));
      const values: Record<string, number | string> = {
        pitch: v.settings.pitchHz, rate: v.settings.msPerPhoneme, scale: v.settings.formantScale,
        brass: Math.round(v.brassColor * 100), brightness: v.trombone.brightness, wah: v.trombone.wah,
        transpose: v.trombone.transpose, style: v.styleId, seed: v.seed,
      };
      for (const el of fields) {
        // Sliders snap to their step, so let them hold the exact derived value.
        if (el instanceof HTMLInputElement && el.type === 'range' && el.step !== 'any') {
          el.dataset.step = el.step;
          el.step = 'any';
        }
        el.value = String(values[el.id]);
        el.disabled = true;
      }
      byId('hashNoteValue').textContent = hashEl.value.trim();
    } else if (manualValues) {
      for (const el of fields) {
        if (el instanceof HTMLInputElement && el.dataset.step) el.step = el.dataset.step;
        el.value = manualValues[el.id];
        el.disabled = false;
      }
      manualValues = null;
    }
    byId<HTMLButtonElement>('reroll').disabled = !!v;
    byId('hashNote').hidden = !v || isInstrument(engineEl.value);
  }

  function baseVoice(): VoiceSettings {
    return { pitchHz: num('pitch'), msPerPhoneme: num('rate'), formantScale: num('scale') };
  }

  function compile(sampleRate: number, puppet: boolean): RenderedUtterance {
    const character = characterVoice();
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
    const performance = renderMumble(textEl.value,
      { seed: character?.seed ?? seed, styleId: character?.styleId ?? styleEl.value, moodId: moodEl.value },
      character?.settings ?? baseVoice(), sampleRate,
      engine === 'trombone'
        ? { engine: 'trombone', trombone: character?.trombone ?? { brightness: num('brightness'), wah: num('wah'), transpose: num('transpose') } }
        : { engine: 'formant', brassColor: character?.brassColor ?? num('brass') / 100 }, puppet);
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
    showHash();
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
    for (const el of root.querySelectorAll<HTMLElement>('[data-hash-field]')) el.hidden = !useHashEl.checked;
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
  for (const id of ['style', 'instrumentPitch', 'instrumentSpeed', 'instrumentExpression', 'instrumentBrightness', 'mood', 'seed', 'pitch', 'rate', 'scale', 'brass', 'brightness', 'wah', 'transpose', 'useHash', 'hash']) byId(id).addEventListener('input', changed, { signal });
  byId('rehash').addEventListener('click', () => {
    hashEl.value = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    changed();
  }, { signal });
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
