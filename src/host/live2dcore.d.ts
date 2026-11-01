// The subset of Live2D Cubism Core (live2dcubismcore.min.js) the Live2D host
// uses. The core is proprietary and loaded at runtime from a file the user
// downloads; it is never bundled.

declare namespace Live2DCubismCore {
  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc | null;
    _release(): void;
  }
  class Model {
    static fromMoc(moc: Moc): Model | null;
    readonly parameters: {
      count: number;
      ids: string[];
      minimumValues: Float32Array;
      maximumValues: Float32Array;
      defaultValues: Float32Array;
      values: Float32Array;
    };
    readonly drawables: {
      count: number;
      ids: string[];
      constantFlags: Uint8Array;
      dynamicFlags: Uint8Array;
      textureIndices: Int32Array;
      renderOrders: Int32Array;
      opacities: Float32Array;
      maskCounts: Int32Array;
      masks: Int32Array[];
      vertexCounts: Int32Array;
      vertexPositions: Float32Array[];
      vertexUvs: Float32Array[];
      indices: Uint16Array[];
      multiplyColors?: Float32Array;
      screenColors?: Float32Array;
      resetDynamicFlags(): void;
    };
    update(): void;
    release(): void;
  }
}

interface Window {
  Live2DCubismCore?: typeof Live2DCubismCore;
}
