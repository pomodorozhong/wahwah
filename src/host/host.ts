// Face host interface: anything that can turn FaceControls into a picture.
// Every host draws with the one shared Three.js renderer (see renderer.ts), so
// switching faces never creates a second WebGL context.

import type * as THREE from 'three';
import type { FaceControls } from '../puppet/controls';

export interface FaceHost {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** Idle blinking, breathing and head sway; purely cosmetic. */
  idleMotion: boolean;
  /** Empty when ready; otherwise a short message shown over the stage. */
  readonly status: string;
  /** Map controls onto this host's rig. Called every frame before update(). */
  setControls(c: FaceControls): void;
  /** Advance cosmetic motion and physics. */
  update(dtSeconds: number): void;
  /** Fit the camera to a viewport in CSS pixels. */
  resize(width: number, height: number): void;
}
