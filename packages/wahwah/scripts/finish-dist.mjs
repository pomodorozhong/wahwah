// Copies the generated WASM package next to the compiled JavaScript, because tsc
// emits only the TypeScript files.
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = resolve(import.meta.dirname, '..');
rmSync(resolve(pkg, 'dist/wasm'), { recursive: true, force: true });
cpSync(resolve(pkg, 'src/wasm'), resolve(pkg, 'dist/wasm'), { recursive: true });
