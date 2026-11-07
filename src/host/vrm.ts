// VRM host: a VRM avatar (three-vrm) driven through its standard viseme
// expressions. Any VRM 0.x or 1.0 model works; see controlsToVrmVisemes.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMExpressionMorphTargetBind, VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { NEUTRAL, type FaceControls } from '@wahwah/performance';
import type { FaceHost } from './host';
import { Blinker, controlsToVrmVisemes } from './mappings';
import { FaceNavigation } from './faceNavigation';
import { StudyMotion } from './studyMotion';

/** Vertical extent of the framed face, in metres. */
const FRAME_HEIGHT = 0.42;
const TOFU_CAMERA = new THREE.Vector3(0.43, 0.31, 1).normalize();

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
  private controls: FaceControls = NEUTRAL;
  private readonly stage = new THREE.Group();
  private readonly softbox = new THREE.DirectionalLight(0xfffdf8, .85);
  private readonly shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0xc8a784, side: THREE.DoubleSide, depthWrite: false }),
  );
  private isStudy = false;
  private body: StudyMotion | null = null;
  private jaw?: THREE.Object3D;
  private readonly jawAngles = new Map<string, number>();
  private readonly extent = new THREE.Vector3();
  private poseClock = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x1d2230);
    this.shadow.renderOrder = -1; // The illustrated shadow stays behind every deformed pose.
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;
    this.scene.add(this.stage, this.shadow);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(1, 2, 3);
    this.scene.add(key);
    this.softbox.position.set(-2, 3, 5);
    this.softbox.visible = false;
    this.scene.add(this.softbox);
    this.scene.add(this.camera); // so lookAt can target it
  }

  async load(url: string, label: string, isTofu = false): Promise<void> {
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
        this.stage.remove(this.vrm.scene);
        VRMUtils.deepDispose(this.vrm.scene);
      }
      this.vrm = vrm;
      this.stage.add(vrm.scene);
      if (vrm.lookAt) vrm.lookAt.target = this.camera;
      vrm.update(0);
      this.isStudy = isTofu;
      this.softbox.visible = isTofu;
      const timing = gltf.scene.userData.tofuMotion;
      this.body = isTofu && timing ? new StudyMotion(timing) : null;
      this.bindJaw(isTofu ? vrm.scene.getObjectByName('DialogueJaw') : undefined);
      this.poseClock = 0;
      this.shadow.visible = isTofu;
      (this.scene.background as THREE.Color).setHex(isTofu ? 0xf4dab2 : 0x1d2230);
      if (isTofu) {
        const bounds = new THREE.Box3().setFromObject(vrm.scene, true);
        bounds.getSize(this.extent);
        bounds.getCenter(this.focus);
        this.shadow.position.set(this.focus.x, bounds.min.y - 0.002, this.focus.z);
        this.shadow.scale.set(this.extent.x * 0.47, this.extent.z * 0.46, 1);
        // Place the shadow under the resting cube, then frame its full
        // range of speaking poses and delayed weight shifts.
        const frame = gltf.scene.userData.tofuFrame;
        if (frame) {
          bounds.min.fromArray(frame.min);
          bounds.max.fromArray(frame.max);
          bounds.getSize(this.extent);
          bounds.getCenter(this.focus);
        }
      } else {
        const head = vrm.humanoid.getNormalizedBoneNode('head');
        if (head) head.getWorldPosition(this.focus);
        this.focus.y += 0.06; // bone sits at the skull base; centre on the face
      }
      this.frame(this.focus);
      this.status = '';
    } catch (e) {
      if (id === this.loadId) this.status = `Could not load ${label}: ${(e as Error).message}`;
    }
  }

  setControls(c: FaceControls): void {
    this.controls = c;
  }

  /** Generic VRM viewers use the embedded vowel morph. Here the mandible
   * travels on its hinge arc, so remove just that positional fallback. */
  private bindJaw(jaw?: THREE.Object3D): void {
    this.jaw = jaw;
    this.jawAngles.clear();
    if (!jaw) return;
    for (const vowel of ['aa','ih','ee','oh','ou']) {
      const expression = this.vrm?.expressionManager?.getExpression(vowel);
      if (!expression) continue;
      for (const bind of [...expression.binds]) {
        if (bind instanceof VRMExpressionMorphTargetBind &&
            bind.primitives.every(mesh => mesh.morphTargetDictionary?.hingeOpen === bind.index)) {
          this.jawAngles.set(vowel, jaw.userData.maxOpenAngle * bind.weight);
          expression.deleteBind(bind);
        }
      }
    }
  }

  private applyMouth(): void {
    const em = this.vrm?.expressionManager;
    let angle = 0;
    for (const [name, w] of Object.entries(controlsToVrmVisemes(this.controls))) {
      em?.setValue(name, w);
      angle += (this.jawAngles.get(name) ?? 0) * w;
    }
    if (this.jaw) this.jaw.rotation.x = angle;
  }

  update(dtSeconds: number): void {
    if (!this.vrm) return;
    this.elapsed += dtSeconds;
    const blink = this.idleMotion ? this.blinker.update(dtSeconds) : 0;
    const breath = this.idleMotion ? .05 * (1 - Math.cos(this.elapsed * 2)) : 0;
    this.body?.update(this.controls, dtSeconds, breath);
    const fps = this.body?.timing.fps;
    this.poseClock += dtSeconds;
    const expose = !fps || dtSeconds === 0 || this.poseClock >= 1/fps;
    if (expose) {
      this.applyMouth();
      if (this.body) {
        const expressions = this.vrm.expressionManager;
        expressions?.setValue('drive', this.body.drive);
        expressions?.setValue('follow', this.body.follow);
        // Ease gaze back to the authored crease during a blink.
        const x = this.body.gazeX * (1-blink), y = this.body.gazeY * (1-blink);
        expressions?.setValue('gazeLeft', Math.max(0, -x));
        expressions?.setValue('gazeRight', Math.max(0, x));
        expressions?.setValue('gazeDown', Math.max(0, -y));
        expressions?.setValue('gazeUp', Math.max(0, y));
        expressions?.setValue('browAccent', this.body.brow);
      }
      this.poseClock = fps ? this.poseClock % (1/fps) : 0;
    }
    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');
    this.vrm.expressionManager?.setValue('blink', blink);
    if (neck) {
      if (this.idleMotion && !this.isStudy) {
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
    const height = this.isStudy
      ? 1.12 * Math.max(this.extent.y + this.extent.z * 0.32, (this.extent.x + this.extent.z * 0.43) / this.camera.aspect)
      : Math.max(FRAME_HEIGHT, (FRAME_HEIGHT * 0.9) / this.camera.aspect);
    const dist = height / 2 / Math.tan(halfFov);
    this.navigation.frame(dist, newCenter, this.isStudy ? TOFU_CAMERA : undefined);
    this.camera.updateProjectionMatrix();
  }
}
