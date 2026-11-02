import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Frame a portrait while preserving the user's orbit, pan and relative zoom on resize. */
export class FaceNavigation extends OrbitControls {
  private homeDistance = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    super(camera);
    this.rotateSpeed = 0.65;
  }

  frame(distance: number, newCenter?: THREE.Vector3, direction?: THREE.Vector3): void {
    const previousDistance = this.homeDistance;
    this.homeDistance = distance;
    this.minDistance = distance * 0.35;
    this.maxDistance = distance * 3;
    if (newCenter) this.target0.copy(newCenter);
    this.position0.copy(this.target0);
    if (direction) this.position0.addScaledVector(direction, distance);
    else this.position0.z += distance;
    if (!previousDistance || newCenter) {
      this.reset();
      return;
    }

    // Keep the camera offset from the panned target in units of the home framing.
    this.object.position.sub(this.target).multiplyScalar(distance / previousDistance).add(this.target);
    this.update();
  }
}
