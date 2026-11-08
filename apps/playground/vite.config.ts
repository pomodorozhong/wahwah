import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** Publish notices and only the approved model when publicDir copying is off. */
function distributionAssets(pages: boolean): Plugin {
  return {
    name: 'distribution-assets',
    apply: 'build',
    generateBundle() {
      const files = [
        [resolve(REPO_ROOT, 'LICENSE'), 'LICENSE'],
        [resolve(REPO_ROOT, 'THIRD_PARTY_NOTICES.md'), 'THIRD_PARTY_NOTICES.md'],
        ...(pages ? [[resolve(import.meta.dirname, 'public/tofu/corner-cut.vrm'), 'tofu/corner-cut.vrm']] : []),
      ];
      for (const [source, fileName] of files) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(source) });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: '/wahwah/',
  // Pages copies only the allowlisted assets below, never public/.
  publicDir: mode === 'pages' ? false : 'public',
  plugins: [distributionAssets(mode === 'pages')],
  resolve: {
    alias: [
      { find: /^wahwah$/, replacement: resolve(REPO_ROOT, 'packages/wahwah/src/index.ts') },
      { find: /^wahwah\/performance$/, replacement: resolve(REPO_ROOT, 'packages/wahwah/src/performance/index.ts') },
      { find: /^wahwah\/mumble$/, replacement: resolve(REPO_ROOT, 'packages/wahwah/src/mumble/index.ts') },
    ],
  },
  // Lets tests load the WASM voices as a data URL; Node can't fetch a file URL.
  assetsInclude: ['**/*.wasm'],
  build: {
    // Three.js alone is ~550 kB minified.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        klattsch: resolve(import.meta.dirname, 'klattsch/index.html'),
        babble: resolve(import.meta.dirname, 'babble/index.html'),
        mumble: resolve(import.meta.dirname, 'mumble/index.html'),
        live: resolve(import.meta.dirname, 'live/index.html'),
      },
    },
  },
  test: {
    setupFiles: ['tests/setup.ts'],
    environment: 'node',
    // pink-trombone-mod uses extensionless relative imports that plain Node ESM
    // cannot resolve; let Vite transform it.
    server: { deps: { inline: ['pink-trombone-mod'] } },
  },
}));
