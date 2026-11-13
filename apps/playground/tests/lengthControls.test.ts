import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FitOptions, RenderedUtterance } from 'wahwah/performance';
import { LengthControls } from '../src/ui/lengthControls';

// Just enough of the DOM for the Length card: fields with values, labels and the card itself.
class FakeElement extends EventTarget {
  value = '';
  checked = false;
  type = '';
  textContent = '';
  hidden = false;
  disabled = false;
  id = '';
  classList = { toggle: () => {} };
  querySelectorAll = () => [];
}
class FakeInput extends FakeElement {}

const FIELD_VALUES: Record<string, string> = {
  cap: '1', speedProfile: 'constant', speedMax: '1.6', volProfile: 'constant', volLevel: '100',
  fadeCurve: 'linear', fadeMs: '80', fadeBend: '1', fadeEnd: '0',
};

const SAMPLE_RATE = 1000;

/** A line that takes `seconds` uncapped, or the cap when one is set, and is cut whenever capped. */
function line(seconds: number, limit: number | undefined): RenderedUtterance {
  const out = limit === undefined ? seconds : Math.min(seconds, limit);
  return {
    audio: new Float32Array(Math.round(out * SAMPLE_RATE)),
    track: null,
    warnings: [],
    fit: limit === undefined ? undefined : { naturalSeconds: seconds, speed: 1.6, peakSpeed: 1.6, truncated: true, cutSeconds: limit },
  } as unknown as RenderedUtterance;
}

describe('Length card', () => {
  let elements: Map<string, FakeElement>;
  let controller: AbortController;

  beforeEach(() => {
    elements = new Map();
    vi.stubGlobal('HTMLInputElement', FakeInput);
    vi.stubGlobal('document', {
      getElementById: (id: string) => {
        if (!elements.has(id)) {
          const el = id in FIELD_VALUES || id === 'useCap' || id === 'cutWord' ? new FakeInput() : new FakeElement();
          el.id = id;
          el.value = FIELD_VALUES[id] ?? '';
          if (id === 'useCap' || id === 'cutWord') {
            el.type = 'checkbox';
            el.checked = true;
          }
          elements.set(id, el);
        }
        return elements.get(id);
      },
    });
    controller = new AbortController();
  });

  afterEach(() => {
    controller.abort();
    vi.unstubAllGlobals();
  });

  it('renders a cut line once per Length slider step, reusing the uncapped line', () => {
    let seconds = 3;
    const calls: (number | undefined)[] = [];
    const renderAt = (limit: number | undefined, _options: FitOptions) => {
      calls.push(limit);
      return line(seconds, limit);
    };
    const length = new LengthControls(controller.signal, () => length.render(SAMPLE_RATE, renderAt));

    // The first render of a cut line also renders it uncapped for the monitor.
    length.render(SAMPLE_RATE, renderAt);
    expect(calls).toEqual([1, undefined]);
    expect(length.fit?.tail?.seconds).toBeGreaterThan(1);

    // Dragging a Length slider renders only the capped line, and the tail is still drawn.
    calls.length = 0;
    for (const value of ['100', '200', '300']) {
      elements.get('fadeMs')!.value = value;
      elements.get('fadeMs')!.dispatchEvent(new Event('input'));
    }
    expect(calls).toEqual([1, 1, 1]);
    expect(length.fit?.tail).not.toBeNull();

    // A change outside the card, such as a voice slider, renders the uncapped line again.
    calls.length = 0;
    seconds = 4;
    length.render(SAMPLE_RATE, renderAt);
    expect(calls).toEqual([1, undefined]);
    expect(length.fit?.tail?.seconds).toBeGreaterThan(length.fit!.seconds);
  });
});
