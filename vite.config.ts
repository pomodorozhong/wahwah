import { readdirSync } from 'node:fs';
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
 * face hosts: VRM avatars, Live2D model3.json files and Cubism Core.
 */
function localModels(): Plugin {
  return {
    name: 'local-models',
    resolveId: (id) => (id === MODELS_ID ? '\0' + MODELS_ID : undefined),
    load(id) {
      if (id !== '\0' + MODELS_ID) return;
      const files = listModelFiles();
      const models = {
        vrm: files.filter((f) => f.toLowerCase().endsWith('.vrm')),
        live2d: files.filter((f) => f.endsWith('.model3.json')),
        cubismCore: files.find((f) => /live2dcubismcore(\.min)?\.js$/.test(f)) ?? null,
      };
      return `export default ${JSON.stringify(models)};`;
    },
    configureServer(server) {
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

export default defineConfig({
  plugins: [localModels()],
  build: {
    // Three.js alone is ~550 kB minified; one chunk is fine for a local prototype.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        klattsch: resolve(import.meta.dirname, 'klattsch/index.html'),
        babble: resolve(import.meta.dirname, 'babble/index.html'),
        live: resolve(import.meta.dirname, 'live/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    // pink-trombone-mod uses extensionless relative imports that plain Node ESM
    // cannot resolve; let Vite transform it.
    server: { deps: { inline: ['pink-trombone-mod'] } },
  },
});
