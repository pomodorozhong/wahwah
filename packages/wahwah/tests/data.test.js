import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { instrumentPresets, mumblePresets } from '../src/data/presets';

// The package carries a generated copy of data/ that the Rust crates read. A
// stale copy would make the two sides disagree.
const source = (name) => JSON.parse(readFileSync(new URL(`../../../data/${name}`, import.meta.url), 'utf8'));

it('matches the shared presets in data/', () => {
  expect(mumblePresets).toEqual(source('mumble-presets.json'));
  expect(instrumentPresets).toEqual(source('instrument-presets.json'));
});
