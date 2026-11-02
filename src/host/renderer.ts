// The one WebGL renderer shared by every face host.

import * as THREE from 'three';
import type { FaceHost } from './host';

export class FaceRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private host: FaceHost | null = null;
  private width = 1;
  private height = 1;

  constructor(private readonly container: HTMLElement) {
    // Stencil is needed by Live2D clipping masks.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setHost(host: FaceHost, interactive: boolean): void {
    if (this.host?.navigation?.domElement) this.host.navigation.disconnect();
    this.host = host;
    host.resize(this.width, this.height);
    if (interactive) host.navigation?.connect(this.canvas);
  }

  render(dtSeconds: number): void {
    if (!this.host) return;
    this.host.update(dtSeconds);
    this.renderer.render(this.host.scene, this.host.camera);
  }

  private resize(): void {
    this.width = this.container.clientWidth || 1;
    this.height = this.container.clientHeight || 1;
    this.renderer.setSize(this.width, this.height, false);
    this.host?.resize(this.width, this.height);
  }
}
