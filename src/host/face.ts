// Preview host: a procedural Three.js face. It knows nothing about phonemes;
// it only draws a mouth shape from MouthShape values (see adapter.ts).

import * as THREE from 'three';

/** Geometry-level mouth parameters, in head-radius units. */
export interface MouthShape {
  halfWidth: number;
  upperOpen: number;
  lowerOpen: number;
  protrusion: number;
  lipThickness: number;
  cornerLift: number;
}

const SKIN = 0xf2b48c;
const LIP = 0xc8565f;
const MOUTH_INSIDE = 0x3a0d14;
const OUTLINE_POINTS = 48;

export class PreviewFace {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly head = new THREE.Group();
  private readonly mouth = new THREE.Group();
  private readonly lips: THREE.Mesh;
  private readonly inside: THREE.Mesh;
  private readonly teeth: THREE.Mesh;
  private readonly eyes: THREE.Group[] = [];
  private readonly brows: THREE.Mesh[] = [];
  private nextBlink = 2;
  private blinkPhase = -1;
  private elapsed = 0;
  /** Idle blinking and head sway; purely cosmetic. */
  idleMotion = true;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x1d2230);
    this.camera.position.set(0, 0, 6);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    this.scene.add(key);

    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.65 });
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin);
    headMesh.scale.set(1, 1.1, 0.95);
    this.head.add(headMesh);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), skin);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(side * 0.98, 0.05, 0);
      this.head.add(ear);

      const eye = new THREE.Group();
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 32, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
      );
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.2 }),
      );
      pupil.position.z = 0.11;
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(0.03, 0.035, 0.18);
      eye.add(white, pupil, glint);
      eye.position.set(side * 0.33, 0.2, 0.8);
      this.eyes.push(eye);
      this.head.add(eye);

      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.03, 0.2, 4, 12),
        new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8 }),
      );
      brow.rotation.z = Math.PI / 2 - side * 0.12;
      brow.position.set(side * 0.33, 0.46, 0.86);
      this.brows.push(brow);
      this.head.add(brow);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), skin);
    nose.scale.set(1, 0.85, 1);
    nose.position.set(0, -0.05, 0.98);
    this.head.add(nose);

    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xf08a8a, roughness: 0.9, transparent: true, opacity: 0.45 });
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), cheekMat);
      cheek.position.set(side * 0.52, -0.15, 0.82);
      cheek.lookAt(side * 1.6, -0.4, 3);
      this.head.add(cheek);
    }

    this.inside = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: MOUTH_INSIDE, side: THREE.DoubleSide }),
    );
    this.teeth = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.4 }),
    );
    this.lips = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ color: LIP, roughness: 0.45 }),
    );
    this.mouth.add(this.inside, this.teeth, this.lips);
    this.mouth.position.set(0, -0.42, 0.93);
    this.head.add(this.mouth);

    this.scene.add(this.head);
    this.setMouth({ halfWidth: 0.22, upperOpen: 0.02, lowerOpen: 0.02, protrusion: 0, lipThickness: 0.035, cornerLift: 0 });
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  /** Rebuild the lip tube and mouth cavity for a new shape. */
  setMouth(shape: MouthShape): void {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < OUTLINE_POINTS; i++) {
      const a = (i / OUTLINE_POINTS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = shape.halfWidth * c;
      const y = (s >= 0 ? shape.upperOpen : shape.lowerOpen) * s + shape.cornerLift * c * c;
      // Follow the head's curvature, with the centre pushed out when puckered.
      const z = -0.6 * x * x + shape.protrusion * (1 - Math.abs(c));
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.lips.geometry.dispose();
    this.lips.geometry = new THREE.TubeGeometry(curve, 96, shape.lipThickness, 12, true);

    const outline = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
    this.inside.geometry.dispose();
    this.inside.geometry = new THREE.ShapeGeometry(outline, 4);
    this.inside.position.z = -0.03;

    // Upper teeth peek out only once the mouth opens past the lip thickness.
    const gap = shape.upperOpen + shape.lowerOpen - 2 * shape.lipThickness;
    this.teeth.visible = gap > 0.03;
    this.teeth.scale.x = Math.min(1, shape.halfWidth / 0.25);
    this.teeth.position.set(0, shape.upperOpen - shape.lipThickness - 0.02, -0.02);
  }

  /** Brow lift, 0-1. A small expressive extra driven by the host adapter. */
  setBrowLift(lift: number): void {
    for (const b of this.brows) b.position.y = 0.46 + 0.06 * lift;
  }

  render(dtSeconds: number): void {
    this.elapsed += dtSeconds;
    if (this.idleMotion) {
      this.head.rotation.y = Math.sin(this.elapsed * 0.7) * 0.08;
      this.head.rotation.x = Math.sin(this.elapsed * 0.45) * 0.04;
      this.updateBlink(dtSeconds);
    } else {
      this.head.rotation.set(0, 0, 0);
      for (const e of this.eyes) e.scale.y = 1;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private updateBlink(dt: number): void {
    if (this.blinkPhase < 0) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) this.blinkPhase = 0;
    } else {
      this.blinkPhase += dt / 0.16;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1;
        this.nextBlink = 2 + Math.random() * 3;
      }
    }
    const closed = this.blinkPhase < 0 ? 0 : Math.sin(this.blinkPhase * Math.PI);
    for (const e of this.eyes) e.scale.y = 1 - 0.9 * closed;
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
