import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { test } from 'node:test';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '../..');

test('Pages publishes the bundled model and notices without local public files', async () => {
  const output = await mkdtemp(join(tmpdir(), 'wahwah-pages-'));
  const publicDir = join(root, 'public');
  const publicFixture = await mkdtemp(join(publicDir, 'pages-private-asset-'));
  try {
    const marker = 'DO_NOT_PUBLISH_THIS_LOCAL_FILE';
    await writeFile(join(publicFixture, 'private.txt'), marker);
    // Ordinary builds copy public/. Then replace that output with Pages to
    // catch stale public files as well as accidental new copies.
    await build({ root, mode: 'production', logLevel: 'warn', build: { outDir: output, emptyOutDir: true } });
    assert.equal(await readFile(join(output, basename(publicFixture), 'private.txt'), 'utf8'), marker);
    await build({ root, mode: 'pages', logLevel: 'warn', build: { outDir: output, emptyOutDir: true } });

    const entries = await readdir(output);
    assert.deepEqual(entries.sort(), ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets', 'babble', 'index.html', 'klattsch', 'live', 'mumble', 'tofu']);
    for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'tofu/corner-cut.vrm']) {
      const source = file.endsWith('.vrm') ? join(publicDir, file) : join(repoRoot, file);
      assert.deepEqual(await readFile(join(output, file)), await readFile(source), file);
    }
    for (const entry of ['index.html', 'mumble/index.html', 'klattsch/index.html', 'babble/index.html', 'live/index.html']) {
      const html = await readFile(join(output, entry), 'utf8');
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
      assert.ok(urls.length > 0, entry);
      for (const url of urls) {
        assert.ok(url.startsWith('/wahwah/assets/'), `${entry}: ${url}`);
        await readFile(join(output, url.slice('/wahwah/'.length)));
      }
    }
    const assets = await readdir(join(output, 'assets'));
    assert.ok(assets.some(file => file.endsWith('.wasm')), 'WASM binary is published');
    assert.ok(assets.some(file => file.startsWith('analysisWorklet-')), 'live analysis worklet is published');
    assert.ok(assets.some(file => file.startsWith('recorderWorklet-')), 'recording worklet is published');
  } finally {
    await Promise.all([output, publicFixture].map(path => rm(path, { recursive: true, force: true })));
    // Leave an existing models directory and all user-supplied files alone.
  }
});
