// Live2D host: a Cubism model drawn with Three.js instead of Live2D's own
// renderer, so it shares the page's single WebGL context. Cubism Core deforms
// the meshes; each drawable becomes a Three.js mesh, and clipping masks use the
// stencil buffer. Physics and .motion3.json playback need Live2D's Cubism
// Framework and are not supported.

import * as THREE from 'three';
import type { FaceControls } from '../puppet/controls';
import type { FaceHost } from './host';
import { Blinker, LIVE2D, controlsToLive2D, parseModel3, type Live2DModelSettings } from './mappings';

/** Turns a path from model3.json (relative to it) into a fetchable URL. */
export type ResolveFile = (path: string) => string;

const BLEND_ADDITIVE = 1 << 0;
const BLEND_MULTIPLICATIVE = 1 << 1;
const INVERTED_MASK = 1 << 3;
const IS_VISIBLE = 1 << 0;

const VERTEX = `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.0, 1.0);
}`;

// Textures are uploaded premultiplied; multiply and screen colors follow the
// Cubism SDK's premultiplied formulas.
const FRAGMENT = `
precision highp float;
uniform sampler2D map;
uniform float opacity;
uniform float alphaCutoff;
uniform vec3 multiply;
uniform vec3 screen;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a <= alphaCutoff) discard;
  c.rgb *= multiply;
  c.rgb = c.rgb + screen * c.a - c.rgb * screen;
  gl_FragColor = c * opacity;
}`;

let corePromise: Promise<void> | null = null;

/** Load Cubism Core once, from a script URL. */
export function loadCubismCore(url: string): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  corePromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => (window.Live2DCubismCore ? resolve() : reject(new Error('script loaded but Live2DCubismCore is missing')));
    s.onerror = () => {
      corePromise = null;
      reject(new Error(`Cubism Core not found at ${url}`));
    };
    document.head.appendChild(s);
  });
  return corePromise;
}

interface Drawable {
  mesh: THREE.Mesh;
  position: THREE.BufferAttribute;
  material: THREE.RawShaderMaterial;
  masks: THREE.Mesh[];
}

interface Loaded {
  moc: Live2DCubismCore.Moc;
  model: Live2DCubismCore.Model;
  settings: Live2DModelSettings;
  textures: THREE.Texture[];
  root: THREE.Group;
  drawables: (Drawable | null)[];
  paramIndex: Map<string, number>;
}

export class Live2DFace implements FaceHost {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  idleMotion = true;
  status = 'Choose a Live2D model.';
  private loaded: Loaded | null = null;
  private mouth: Record<string, number> = {};
  private readonly blinker = new Blinker();
  private elapsed = 0;
  private aspect = 1;
  private focus = { x: 0, y: 0, height: 2 };
  private loadId = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x1d2230);
  }

  async load(coreUrl: string, modelUrl: string, resolve: ResolveFile, label: string): Promise<void> {
    const id = ++this.loadId;
    this.status = `Loading ${label}…`;
    try {
      await loadCubismCore(coreUrl);
      const settings = parseModel3(await (await fetchOk(modelUrl)).json());
      const mocBuffer = await (await fetchOk(resolve(settings.moc))).arrayBuffer();
      const textures = await Promise.all(settings.textures.map((t) => new THREE.TextureLoader().loadAsync(resolve(t))));
      const core = window.Live2DCubismCore!;
      const moc = core.Moc.fromArrayBuffer(mocBuffer);
      if (!moc) throw new Error('unsupported .moc3 (Cubism Core may be too old)');
      const model = core.Model.fromMoc(moc);
      if (!model) throw new Error('could not create the model');
      if (id !== this.loadId) {
        model.release();
        moc._release();
        for (const t of textures) t.dispose();
        return;
      }
      for (const t of textures) {
        t.premultiplyAlpha = true;
        t.needsUpdate = true;
      }
      this.unload();
      this.loaded = this.build(moc, model, settings, textures);
      this.scene.add(this.loaded.root);
      model.update();
      this.syncMeshes();
      this.focus = this.findFace();
      this.frame();
      this.status = '';
    } catch (e) {
      if (id === this.loadId) this.status = `Could not load ${label}: ${(e as Error).message}`;
    }
  }

  setControls(c: FaceControls): void {
    this.mouth = controlsToLive2D(c, this.loaded?.settings.lipSyncIds ?? []);
  }

  update(dtSeconds: number): void {
    const l = this.loaded;
    if (!l) return;
    this.elapsed += dtSeconds;
    const t = this.elapsed;
    const idle = this.idleMotion;
    const blink = idle ? this.blinker.update(dtSeconds) : 0;
    const set = (id: string, value: number) => {
      const i = l.paramIndex.get(id);
      if (i === undefined) return;
      const p = l.model.parameters;
      p.values[i] = Math.min(p.maximumValues[i], Math.max(p.minimumValues[i], value));
    };
    const reset = (id: string) => {
      const i = l.paramIndex.get(id);
      if (i !== undefined) l.model.parameters.values[i] = l.model.parameters.defaultValues[i];
    };
    for (const [id, v] of Object.entries(this.mouth)) set(id, v);
    for (const id of l.settings.eyeBlinkIds.length ? l.settings.eyeBlinkIds : [LIVE2D.eyeLOpen, LIVE2D.eyeROpen]) {
      const i = l.paramIndex.get(id);
      if (i !== undefined) set(id, l.model.parameters.defaultValues[i] * (1 - blink));
    }
    if (idle) {
      set(LIVE2D.angleX, 10 * Math.sin(t * 0.7));
      set(LIVE2D.angleY, 5 * Math.sin(t * 0.45));
      set(LIVE2D.angleZ, 3 * Math.sin(t * 0.3));
      set(LIVE2D.bodyAngleX, 3 * Math.sin(t * 0.5));
      set(LIVE2D.breath, 0.5 + 0.5 * Math.sin(t * 1.6));
    } else {
      for (const id of [LIVE2D.angleX, LIVE2D.angleY, LIVE2D.angleZ, LIVE2D.bodyAngleX, LIVE2D.breath]) reset(id);
    }
    l.model.update();
    this.syncMeshes();
  }

  resize(w: number, h: number): void {
    this.aspect = w / h;
    this.frame();
  }

  private build(moc: Live2DCubismCore.Moc, model: Live2DCubismCore.Model, settings: Live2DModelSettings, textures: THREE.Texture[]): Loaded {
    const d = model.drawables;
    const root = new THREE.Group();
    const geometries: (THREE.BufferGeometry | null)[] = [];
    const drawables: (Drawable | null)[] = [];
    for (let i = 0; i < d.count; i++) {
      if (!d.indices[i]?.length) {
        geometries.push(null);
        continue;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.vertexPositions[i]), 2));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(d.vertexUvs[i]), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(d.indices[i]), 1));
      geometries.push(g);
    }
    // Each masked drawable gets its own stencil value: its masks write it and
    // the drawable tests against it, so no stencil clear is needed between them.
    let stencilRef = 0;
    for (let i = 0; i < d.count; i++) {
      const g = geometries[i];
      if (!g) {
        drawables.push(null);
        continue;
      }
      const flags = d.constantFlags[i];
      const material = drawableMaterial(textures[d.textureIndices[i]], flags);
      const mesh = new THREE.Mesh(g, material);
      mesh.frustumCulled = false;
      const masks: THREE.Mesh[] = [];
      if (d.maskCounts[i] > 0) {
        stencilRef = (stencilRef % 255) + 1;
        material.stencilWrite = true;
        material.stencilRef = stencilRef;
        material.stencilFunc = flags & INVERTED_MASK ? THREE.NotEqualStencilFunc : THREE.EqualStencilFunc;
        for (const m of d.masks[i]) {
          const mg = geometries[m];
          if (!mg) continue;
          const mask = new THREE.Mesh(mg, maskMaterial(textures[d.textureIndices[m]], stencilRef));
          mask.frustumCulled = false;
          masks.push(mask);
          root.add(mask);
        }
      }
      root.add(mesh);
      drawables.push({ mesh, position: g.getAttribute('position') as THREE.BufferAttribute, material, masks });
    }
    const paramIndex = new Map(model.parameters.ids.map((id, i) => [id, i]));
    return { moc, model, settings, textures, root, drawables, paramIndex };
  }

  private syncMeshes(): void {
    const l = this.loaded!;
    const d = l.model.drawables;
    for (let i = 0; i < d.count; i++) {
      const dr = l.drawables[i];
      if (!dr) continue;
      dr.mesh.visible = (d.dynamicFlags[i] & IS_VISIBLE) !== 0;
      (dr.position.array as Float32Array).set(d.vertexPositions[i]);
      dr.position.needsUpdate = true;
      const u = dr.material.uniforms;
      u.opacity.value = d.opacities[i];
      if (d.multiplyColors) (u.multiply.value as THREE.Vector3).fromArray(d.multiplyColors, i * 4);
      if (d.screenColors) (u.screen.value as THREE.Vector3).fromArray(d.screenColors, i * 4);
      // Masks draw just before the drawable they clip.
      dr.mesh.renderOrder = d.renderOrders[i] * 2 + 1;
      for (const m of dr.masks) m.renderOrder = d.renderOrders[i] * 2;
    }
    d.resetDynamicFlags();
  }

  /** The head hit area's bounds, or the top of the model when it has none. */
  private findFace(): { x: number; y: number; height: number } {
    const l = this.loaded!;
    const d = l.model.drawables;
    const heads = l.settings.headDrawableIds.map((id) => d.ids.indexOf(id)).filter((i) => i >= 0);
    const all = bounds(d.vertexPositions, [...Array(d.count).keys()]);
    const head = heads.length ? bounds(d.vertexPositions, heads) : null;
    if (head && head.maxY > head.minY) {
      return { x: (head.minX + head.maxX) / 2, y: (head.minY + head.maxY) / 2, height: (head.maxY - head.minY) * 1.5 };
    }
    const h = Math.min(all.maxY - all.minY, (all.maxX - all.minX) * 1.2) * 0.45;
    return { x: (all.minX + all.maxX) / 2, y: all.maxY - h / 2, height: h };
  }

  private frame(): void {
    const { x, y, height } = this.focus;
    const h = Math.max(height, (height * 0.9) / this.aspect);
    const w = h * this.aspect;
    Object.assign(this.camera, { left: x - w / 2, right: x + w / 2, top: y + h / 2, bottom: y - h / 2 });
    this.camera.updateProjectionMatrix();
  }

  private unload(): void {
    const l = this.loaded;
    if (!l) return;
    this.scene.remove(l.root);
    l.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    for (const t of l.textures) t.dispose();
    l.model.release();
    l.moc._release();
    this.loaded = null;
  }
}

function drawableMaterial(map: THREE.Texture, flags: number): THREE.RawShaderMaterial {
  const m = new THREE.RawShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      map: { value: map },
      opacity: { value: 1 },
      alphaCutoff: { value: -1 },
      multiply: { value: new THREE.Vector3(1, 1, 1) },
      screen: { value: new THREE.Vector3(0, 0, 0) },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: flags & BLEND_MULTIPLICATIVE ? THREE.DstColorFactor : THREE.OneFactor,
    blendDst: flags & BLEND_ADDITIVE ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
  return m;
}

function maskMaterial(map: THREE.Texture, stencilRef: number): THREE.RawShaderMaterial {
  const m = drawableMaterial(map, 0);
  m.uniforms.alphaCutoff.value = 0.5;
  m.colorWrite = false;
  m.stencilWrite = true;
  m.stencilRef = stencilRef;
  m.stencilFunc = THREE.AlwaysStencilFunc;
  m.stencilZPass = THREE.ReplaceStencilOp;
  return m;
}

function bounds(positions: Float32Array[], which: number[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const i of which) {
    const p = positions[i];
    for (let k = 0; k < p.length; k += 2) {
      minX = Math.min(minX, p[k]);
      maxX = Math.max(maxX, p[k]);
      minY = Math.min(minY, p[k + 1]);
      maxY = Math.max(maxY, p[k + 1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

async function fetchOk(url: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} for ${url.split('/').pop()}`);
  return r;
}
