import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL } from 'wahwah/performance';
import { VrmFace } from '../src/host/vrm';

// Keep model loading pending so view changes can run before Tofu is ready.
const pending = vi.hoisted(() => ({ finishTofu: () => {} }));
vi.mock('../src/host/renderer', () => ({
  FaceRenderer: class {
    canvas = { hidden: false };
    setHost = vi.fn();
    render = vi.fn();
  },
}));
vi.mock('../src/host/debug', () => ({
  DebugPuppet: class {
    visible = false;
    render = vi.fn();
  },
}));

import { PuppetView } from '../src/ui/puppetView';

function makeElement() {
  return Object.assign(new EventTarget(), {
    hidden: false,
    checked: true,
    value: '',
    textContent: '',
    innerHTML: '',
    click: vi.fn(),
    insertAdjacentHTML: vi.fn(),
  });
}

describe('puppet view loading', () => {
  let elements: Map<string, ReturnType<typeof makeElement>>;

  beforeEach(() => {
    pending.finishTofu = () => {};
    vi.spyOn(VrmFace.prototype, 'load').mockImplementation(function (this: VrmFace) {
      return new Promise<void>(resolve => {
        pending.finishTofu = () => { this.status = ''; resolve(); };
      });
    });
    elements = new Map();
    vi.stubGlobal('document', {
      getElementById: (id: string) => {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('can update and reset before the initial character has loaded', async () => {
    const view = new PuppetView();
    expect(() => view.update(0.016, NEUTRAL)).not.toThrow();
    elements.get('resetView')!.dispatchEvent(new Event('click'));
    expect(elements.get('faceStatus')!.textContent).toBe('Loading…');
    await vi.dynamicImportSettled();
    expect(view.renderer.setHost).toHaveBeenLastCalledWith(null, false);
    pending.finishTofu();
    await vi.waitFor(() => expect(elements.get('cameraTools')!.hidden).toBe(false));
    view.update(0.016, NEUTRAL);
    expect(elements.get('faceStatus')!.hidden).toBe(true);
  });

  it('keeps Debug active when the initial character finishes loading', async () => {
    const view = new PuppetView();
    await view.setMode('debug');
    await vi.dynamicImportSettled();
    pending.finishTofu();
    await vi.dynamicImportSettled();
    view.update(0.016, NEUTRAL);
    expect(view.view).toBe('debug');
    expect(view.renderer.canvas.hidden).toBe(true);
    expect(view.debugPuppet.visible).toBe(true);
    expect(elements.get('cameraTools')!.hidden).toBe(true);
    expect(view.renderer.setHost).toHaveBeenLastCalledWith(null, false);
    expect(view.debugPuppet.render).toHaveBeenCalled();
  });

  it('applies current idle settings when returning to Tofu', async () => {
    const view = new PuppetView();
    await vi.dynamicImportSettled();
    pending.finishTofu();
    await vi.waitFor(() => expect(elements.get('cameraTools')!.hidden).toBe(false));
    const renderer = vi.mocked(view.renderer.setHost);
    const tofuHost = renderer.mock.lastCall![0]!;
    await view.setMode('debug');
    const idle = elements.get('idle')!;
    idle.checked = false;
    idle.dispatchEvent(new Event('change'));
    await view.setMode('tofu');
    expect(renderer.mock.lastCall![0]).toBe(tofuHost);
    expect(tofuHost.idleMotion).toBe(false);
    expect(view.debugPuppet.visible).toBe(false);
    expect(view.renderer.canvas.hidden).toBe(false);
  });
});
