import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const MODELS_DIR = resolve(import.meta.dirname, 'public/models');
const MODELS_ID = 'virtual:local-models';

/** Every file under public/models, as paths relative to it. */
function listModelFiles(dir = MODELS_DIR): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) =>
    e.isDirectory() ? listModelFiles(join(dir, e.name)) : [relative(MODELS_DIR, join(dir, e.name)).split('\\').join('/')],
  );
}

/**
 * Lists the user's local, git-ignored model files (public/models) for the
 * VRM host.
 */
function localModels(enabled: boolean): Plugin {
  return {
    name: 'local-models',
    resolveId: (id) => (id === MODELS_ID ? '\0' + MODELS_ID : undefined),
    load(id) {
      if (id !== '\0' + MODELS_ID) return;
      const files = enabled ? listModelFiles() : [];
      const models = {
        vrm: files.filter((f) => f.toLowerCase().endsWith('.vrm')),
      };
      return `export default ${JSON.stringify(models)};`;
    },
    configureServer(server) {
      if (!enabled) return;
      server.watcher.add(MODELS_DIR);
      const refresh = (file: string) => {
        if (!file.startsWith(MODELS_DIR)) return;
        const mod = server.moduleGraph.getModuleById('\0' + MODELS_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

/** Publish notices and only the approved model when publicDir copying is off. */
function distributionAssets(pages: boolean): Plugin {
  return {
    name: 'distribution-assets',
    apply: 'build',
    generateBundle() {
      const files = [
        ['LICENSE', 'LICENSE'],
        ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
        ...(pages ? [['public/tofu/corner-cut.vrm', 'tofu/corner-cut.vrm']] : []),
      ];
      for (const [source, fileName] of files) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(import.meta.dirname, source)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: '/wahwah/',
  // An ignored public/models file must never enter a Pages artifact or menu.
  publicDir: mode === 'pages' ? false : 'public',
  plugins: [localModels(mode !== 'pages'), distributionAssets(mode === 'pages')],
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
