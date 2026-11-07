import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
const filesIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f));

describe('performance package boundary', () => {
  it('imports only its own files', () => {
    for (const file of filesIn(join(root, 'packages/performance/src'))) {
      for (const spec of importsOf(file)) expect(spec, file).toMatch(/^\.\/[\w-]+\.js$/);
    }
  });

  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'packages/performance/package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('keeps the Tofu host files off the voice engine, live input and UI', () => {
    const forbidden = /\.\.\/(voice|live|apps|wasm|ui)\b/;
    for (const file of filesIn(join(root, 'src/host')).filter((f) => !f.endsWith('debug.ts'))) {
      for (const spec of importsOf(file)) expect(spec, file).not.toMatch(forbidden);
    }
  });
});
