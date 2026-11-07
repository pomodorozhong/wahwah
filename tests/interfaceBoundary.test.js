import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
const filesIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f));
const pkgSrc = join(root, 'packages/wahwah/src');

describe('wahwah package boundary', () => {
  it('imports only its own files', () => {
    for (const dir of ['', 'performance', 'voice', 'mumble']) {
      for (const file of filesIn(join(pkgSrc, dir))) {
        for (const spec of importsOf(file)) expect(spec, file).toMatch(/^\.{1,2}\/[\w/-]+\.js$/);
      }
    }
  });

  it('keeps the performance entry free of the voice engine and WASM', () => {
    for (const file of filesIn(join(pkgSrc, 'performance'))) {
      for (const spec of importsOf(file)) expect(spec, file).toMatch(/^\.\/[\w-]+\.js$/);
    }
  });

  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'packages/wahwah/package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('keeps the Tofu host files off the voice engine, live input and UI', () => {
    const forbidden = /\.\.\/(voice|live|apps|wasm|ui)\b|^wahwah$|^wahwah\/mumble$/;
    for (const file of filesIn(join(root, 'src/host')).filter((f) => !f.endsWith('debug.ts'))) {
      for (const spec of importsOf(file)) expect(spec, file).not.toMatch(forbidden);
    }
  });
});
