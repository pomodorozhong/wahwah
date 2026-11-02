// VRM host: a VRM avatar (three-vrm) driven through its standard viseme
// expressions. Any VRM 0.x or 1.0 model works; see controlsToVrmVisemes.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { FaceControls } from '../puppet/controls';
import type { FaceHost } from './host';
import { Blinker, controlsToVrmVisemes } from './mappings';
import { FaceNavigation } from './faceNavigation';

/** Vertical extent of the framed face, in metres. */
const FRAME_HEIGHT = 0.42;

export class VrmFace implements FaceHost {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(20, 1, 0.05, 20);
  readonly navigation = new FaceNavigation(this.camera);
  idleMotion = true;
  status = 'Choose a VRM model.';
  private vrm: VRM | null = null;
  private readonly focus = new THREE.Vector3(0, 1.4, 0);
  private readonly blinker = new Blinker();
  private elapsed = 0;
  private loadId = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x1d2230);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(1, 2, 3);
    this.scene.add(key);
    this.scene.add(this.camera); // so lookAt can target it
  }

  async load(url: string, label: string): Promise<void> {
    const id = ++this.loadId;
    this.status = `Loading ${label}…`;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    try {
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (!vrm) throw new Error('not a VRM file');
      if (id !== this.loadId) return VRMUtils.deepDispose(gltf.scene);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((o) => (o.frustumCulled = false));
      if (this.vrm) {
        this.scene.remove(this.vrm.scene);
        VRMUtils.deepDispose(this.vrm.scene);
      }
      this.vrm = vrm;
      this.scene.add(vrm.scene);
      if (vrm.lookAt) vrm.lookAt.target = this.camera;
      vrm.update(0);
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) head.getWorldPosition(this.focus);
      this.focus.y += 0.06; // bone sits at the skull base; centre on the face
      this.frame(this.focus);
      this.status = '';
    } catch (e) {
      if (id === this.loadId) this.status = `Could not load ${label}: ${(e as Error).message}`;
    }
  }

  setControls(c: FaceControls): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    for (const [name, w] of Object.entries(controlsToVrmVisemes(c))) em.setValue(name, w);
  }

  update(dtSeconds: number): void {
    if (!this.vrm) return;
    this.elapsed += dtSeconds;
    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');
    const blink = this.idleMotion ? this.blinker.update(dtSeconds) : 0;
    this.vrm.expressionManager?.setValue('blink', blink);
    if (neck) {
      if (this.idleMotion) {
        neck.rotation.y = Math.sin(this.elapsed * 0.7) * 0.08;
        neck.rotation.x = Math.sin(this.elapsed * 0.45) * 0.04;
      } else neck.rotation.set(0, 0, 0);
    }
    this.vrm.update(dtSeconds);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.frame();
  }

  private frame(newCenter?: THREE.Vector3): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const height = Math.max(FRAME_HEIGHT, (FRAME_HEIGHT * 0.9) / this.camera.aspect);
    const dist = height / 2 / Math.tan(halfFov);
    this.navigation.frame(dist, newCenter);
    this.camera.updateProjectionMatrix();
  }
}
