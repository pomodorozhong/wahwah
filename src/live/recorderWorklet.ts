// Records its input on the audio thread and posts it to the page in chunks.

/// <reference path="./audioworklet.d.ts" />

const CHUNK = 4096;

class PcmRecorder extends AudioWorkletProcessor {
  private buf = new Float32Array(CHUNK);
  private n = 0;
  private recording = true;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ type: 'stop' }>) => {
      if (e.data.type === 'stop') {
        this.flush();
        this.recording = false;
        this.port.postMessage({ type: 'done' });
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!this.recording) return false;
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.buf[this.n++] = input[i];
      if (this.n === CHUNK) this.flush();
    }
    return true;
  }

  private flush(): void {
    if (!this.n) return;
    const chunk = this.buf.slice(0, this.n);
    this.port.postMessage({ type: 'chunk', chunk }, [chunk.buffer]);
    this.n = 0;
  }
}

registerProcessor('pcm-recorder', PcmRecorder);
