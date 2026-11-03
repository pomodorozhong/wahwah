// Each input mounts into the same workspace. The stage and its selected rig live
// for the whole visit; switching inputs ends that input's session synchronously.
import { byId, PuppetView, renderShell } from '../ui/puppetView';
import { mountBabble } from './babble';
import { mountKlattsch } from './klattsch';
import { mountLive } from './live';
import { loadVoices } from '../voice/rustVoice';

const modes = { babble: mountBabble, klattsch: mountKlattsch, live: mountLive };
type Mode = keyof typeof modes;

function isMode(value: string | null): value is Mode {
  return value === 'babble' || value === 'klattsch' || value === 'live';
}

const base = new URL(import.meta.env.BASE_URL, location.origin);
const url = new URL(location.href);
const legacy = url.pathname.slice(base.pathname.length).replace(/(?:\/index\.html|\/)?$/, '');
if (isMode(legacy)) {
  url.pathname = base.pathname;
  url.searchParams.set('mode', legacy);
  history.replaceState(null, '', url);
}

try {
  await loadVoices();
} catch (error) {
  byId('app').textContent = `The voices could not load: ${error instanceof Error ? error.message : error}`;
  throw error;
}

const root = byId('app');
renderShell(root);
const view = new PuppetView();
const selector = byId<HTMLSelectElement>('inputMode');
let active: Mode | undefined;
let session: AbortController | undefined;

function applyLocation(): void {
  const params = new URLSearchParams(location.search);
  const requested = params.get('mode');
  const next = isMode(requested) ? requested : 'babble';
  if (next !== active) {
    session?.abort();
    session = new AbortController();
    active = next;
    selector.value = next;
    view.follower.relax();
    modes[next](root, view, session.signal);
  } else if (next === 'babble') {
    const engine = byId<HTMLSelectElement>('engine');
    const selected = params.get('engine');
    if (selected && selected !== engine.value && [...engine.options].some(option => option.value === selected)) {
      engine.value = selected;
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

selector.addEventListener('change', () => {
  const dest = new URL(location.href);
  dest.searchParams.set('mode', selector.value);
  dest.searchParams.delete('engine');
  history.pushState(null, '', dest);
  applyLocation();
});
window.addEventListener('popstate', applyLocation);
window.addEventListener('pagehide', () => {
  session?.abort();
  active = undefined;
});
window.addEventListener('pageshow', event => { if (event.persisted) applyLocation(); });
applyLocation();
