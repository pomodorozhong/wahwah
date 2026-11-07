import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL } from '@wahwah/performance';
import { VrmFace } from '../src/host/vrm';

// Keep model loading pending so view changes can run before Tofu is ready.
const pending = vi.hoisted(() => ({ finishTofu: () => {} }));
vi.mock('virtual:local-models', () => ({ default: { vrm: [] } }));
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
    vi.spyOn(VrmFace.prototype, 'load').mockImplementation(function (this: VrmFace, _url, _label, isTofu = false) {
      if (!isTofu) { this.status = ''; return Promise.resolve(); }
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

  it('keeps the selected VRM host after Tofu loads, then applies current idle settings on return', async () => {
    const view = new PuppetView();
    await view.setMode('vrm');
    await vi.dynamicImportSettled();
    const renderer = vi.mocked(view.renderer.setHost);
    const vrmHost = renderer.mock.lastCall![0]!;
    pending.finishTofu();
    await vi.dynamicImportSettled();
    expect(renderer).toHaveBeenLastCalledWith(vrmHost, true);
    expect(elements.get('modelLabel')!.hidden).toBe(false);
    const idle = elements.get('idle')!;
    idle.checked = false;
    idle.dispatchEvent(new Event('change'));
    await view.setMode('tofu');
    const tofuHost = renderer.mock.lastCall![0]!;
    expect(tofuHost).not.toBe(vrmHost);
    expect(tofuHost.idleMotion).toBe(false);
    expect(view.debugPuppet.visible).toBe(false);
    expect(view.renderer.canvas.hidden).toBe(false);
    expect(elements.get('modelLabel')!.hidden).toBe(true);
  });

  it('loads an opened VRM and retains its selection when switching views', async () => {
    const view = new PuppetView();
    await view.setMode('vrm');
    const renderer = vi.mocked(view.renderer.setHost);
    const host = renderer.mock.lastCall![0] as VrmFace;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:opened-vrm');
    const input = Object.assign(elements.get('vrmFile')!, {
      files: [new File(['local VRM'], 'character.vrm')],
    });
    input.dispatchEvent(new Event('change'));
    await vi.dynamicImportSettled();
    expect(host.load).toHaveBeenCalledWith('blob:opened-vrm', 'character.vrm');
    await view.setMode('debug');
    await view.setMode('vrm');
    expect(elements.get('model')!.value).toBe('blob:opened-vrm');
    expect(renderer).toHaveBeenLastCalledWith(host, true);
    pending.finishTofu();
    await vi.dynamicImportSettled();
  });
});
