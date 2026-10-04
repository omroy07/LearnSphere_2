// vite.config.mjs – Vite configuration for LearnSphere_2
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findHtmlEntries(dir, entries = {}) {
  const skip = new Set(['node_modules', 'dist', '.git', '.github']);

  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;

    const fullPath = join(dir, name);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      findHtmlEntries(fullPath, entries);
    } else if (name.endsWith('.html')) {
      const relPath = relative(__dirname, fullPath).replace(/\.html$/, '');
      const key = relPath.split(/[\\/]/).join('-') || 'index';
      entries[key] = fullPath;
    }
  }

  return entries;
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: findHtmlEntries(__dirname),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    open: '/index.html',
    hmr: {
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
    },
    proxy: {
      '/chat': {
        target: 'http://127.0.0.1:5000',
        bypass(req) {
          const path = (req.url || '').split('?')[0];
          if (path !== '/chat') return path;
        },
      },
      '/explain_mistake': 'http://127.0.0.1:5000',
      '/api/ai': 'http://127.0.0.1:5000',
      '/api/auth': 'http://127.0.0.1:5001',
      '/api/verify-permission': 'http://127.0.0.1:5001',
    },
  },
});
