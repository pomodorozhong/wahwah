// Mappings from FaceControls to standard avatar vocabularies. Pure functions
// with no Three.js or Cubism types, so they can be tested and reused by any
// VRM or Live2D runtime.

import type { FaceControls } from '../puppet/controls';

/** VRM 1.0 preset viseme expressions (VRM 0.x's A/I/U/E/O). */
export interface VrmVisemes {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

/**
 * Split the controls into VRM's five vowel shapes. Lip shape picks the family
 * (relaxed → aa, spread → ee/ih, rounded → ou/oh) and the jaw picks the more
 * open member of each, so the weights always sum to at most 1 and a closed
 * relaxed mouth is all zeros.
 */
export function controlsToVrmVisemes(c: FaceControls): VrmVisemes {
  const relaxed = Math.max(0, 1 - c.lipWidth - c.lipRound);
  return {
    aa: c.jawOpen * relaxed,
    ih: c.lipWidth * c.jawOpen,
    ee: c.lipWidth * (1 - c.jawOpen),
    ou: c.lipRound * (1 - c.jawOpen),
    oh: c.lipRound * c.jawOpen,
  };
}

/** Live2D Cubism standard parameter IDs used by the hosts. */
export const LIVE2D = {
  mouthOpenY: 'ParamMouthOpenY',
  mouthForm: 'ParamMouthForm',
  eyeLOpen: 'ParamEyeLOpen',
  eyeROpen: 'ParamEyeROpen',
  angleX: 'ParamAngleX',
  angleY: 'ParamAngleY',
  angleZ: 'ParamAngleZ',
  bodyAngleX: 'ParamBodyAngleX',
  breath: 'ParamBreath',
} as const;

/**
 * Mouth parameters for a Live2D model. `lipSyncIds` is the model's LipSync
 * group (usually just ParamMouthOpenY). MouthForm is the spread-vs-pucker axis
 * the control format guarantees (lipWidth − lipRound); most models draw its
 * negative end as a frown rather than a pucker.
 */
export function controlsToLive2D(c: FaceControls, lipSyncIds: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of lipSyncIds.length ? lipSyncIds : [LIVE2D.mouthOpenY]) out[id] = c.jawOpen;
  out[LIVE2D.mouthForm] = c.lipWidth - c.lipRound;
  return out;
}

/** The parts of a Cubism `.model3.json` the Live2D host needs. */
export interface Live2DModelSettings {
  moc: string;
  textures: string[];
  lipSyncIds: string[];
  eyeBlinkIds: string[];
  /** Drawable IDs of hit areas named like "Head", for framing the face. */
  headDrawableIds: string[];
}

interface Model3Json {
  FileReferences?: { Moc?: string; Textures?: string[] };
  Groups?: { Target?: string; Name?: string; Ids?: string[] }[];
  HitAreas?: { Id?: string; Name?: string }[];
}

export function parseModel3(json: unknown): Live2DModelSettings {
  const m = json as Model3Json;
  const moc = m.FileReferences?.Moc;
  if (!moc) throw new Error('model3.json has no FileReferences.Moc');
  const group = (name: string) =>
    m.Groups?.find((g) => g.Target === 'Parameter' && g.Name === name)?.Ids ?? [];
  const headDrawableIds = (m.HitAreas ?? [])
    .filter((h) => h.Id && /head|face/i.test(`${h.Name ?? ''} ${h.Id}`))
    .map((h) => h.Id!);
  return {
    moc,
    textures: m.FileReferences?.Textures ?? [],
    lipSyncIds: group('LipSync'),
    eyeBlinkIds: group('EyeBlink'),
    headDrawableIds,
  };
}

/** Blink curve shared by hosts: 0 = open, 1 = closed. */
export class Blinker {
  private next = 2;
  private phase = -1;

  constructor(private readonly random: () => number = Math.random) {}

  update(dtSeconds: number): number {
    if (this.phase < 0) {
      this.next -= dtSeconds;
      if (this.next <= 0) this.phase = 0;
    } else {
      this.phase += dtSeconds / 0.16;
      if (this.phase >= 1) {
        this.phase = -1;
        this.next = 2 + this.random() * 3;
      }
    }
    return this.phase < 0 ? 0 : Math.sin(this.phase * Math.PI);
  }
}
