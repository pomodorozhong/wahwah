// Builds the Rust voices into src/wasm, the generated package the voice adapter
// imports. Runs before dev, typecheck, test and build.

import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// rustup's Homebrew formula is keg-only and cargo installs to ~/.cargo/bin; find
// them even when the shell profile doesn't add them to PATH.
const env = {
  ...process.env,
  PATH: [process.env.PATH, join(homedir(), '.cargo/bin'), '/opt/homebrew/opt/rustup/bin'].join(delimiter),
};

function run(command, args, hint) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') {
    console.error(`\n${command} was not found. ${hint}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('cargo', ['build', '--quiet', '--release', '--target', 'wasm32-unknown-unknown', '-p', 'wahwah-wasm'], 'See "Run the playground" in the README.');
run(
  'wasm-bindgen',
  ['target/wasm32-unknown-unknown/release/wahwah_wasm.wasm', '--target', 'web', '--out-dir', 'src/wasm'],
  'See "Run the playground" in the README.',
);
