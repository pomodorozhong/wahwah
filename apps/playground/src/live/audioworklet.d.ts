// Minimal AudioWorkletGlobalScope declarations (not part of TypeScript's DOM lib).
declare global {
  class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor(options?: { processorOptions?: unknown });
  }
  function registerProcessor(name: string, ctor: new (options?: { processorOptions?: unknown }) => AudioWorkletProcessor): void;
  const sampleRate: number;
  const currentTime: number;
}

export {};
