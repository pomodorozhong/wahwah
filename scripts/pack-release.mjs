// Builds one workspace package and packs it into release-assets/ as the tarball a
// GitHub release carries. Usage: node scripts/pack-release.mjs performance

import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z-]+$/.test(name)) {
  console.error('Usage: node scripts/pack-release.mjs <package>, for example: performance');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'packages', name);
const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
const out = resolve(root, 'release-assets');
mkdirSync(out, { recursive: true });

function run(args) {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['run', 'build', '--workspace', pkg.name]);
run(['pack', '--workspace', pkg.name, '--pack-destination', out]);
console.log(`\nPacked ${pkg.name}@${pkg.version} into ${out}`);
console.log(`Release tag: ${name}-v${pkg.version}`);
