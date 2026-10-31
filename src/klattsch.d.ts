// Minimal types for the parts of klattsch 0.8 this project uses.
declare module 'klattsch' {
  export interface ScheduleEvent {
    atMs: number;
    target: Record<string, number>;
    transitionMs: number;
  }

  export interface Phrase {
    srcStart: number;
    srcEnd: number;
    tokenSrcStart: number;
    tStartMs: number;
    tEndMs: number;
    kind: 'phoneme' | 'pause' | 'directive';
    phoneme: string | null;
  }

  export interface CompileOptions {
    baseF0?: number;
    rate?: number;
    scale?: number;
    vibratoDepth?: number;
    vibratoRate?: number;
    aspiration?: number;
    tilt?: number;
    effort?: number;
    bank?: string;
  }

  export interface CompileResult {
    schedule: ScheduleEvent[];
    totalMs: number;
    warnings: string[];
    phrases: Phrase[];
  }

  export function compileString(input: string, opts?: CompileOptions): CompileResult;

  export function renderToBuffer(opts: {
    sampleRate?: number;
    schedule: ScheduleEvent[];
    totalMs?: number;
  }): Float32Array;
}
