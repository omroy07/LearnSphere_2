// vite.config.js – Vite configuration for LearnSphere_2
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// LearnSphere is a multi-page static site: every top-level and nested
// .html file needs to be its own Rollup entry point, or Vite only
// bundles index.html and every other page (Resources, Courses, all
// quiz pages, etc.) is silently missing from dist/ and 404s in prod.
// This walks the repo once at build time and builds that entry map
// automatically, so newly added .html files don't need manual wiring.
function findHtmlEntries(dir, entries = {}) {
  const skip = new Set(['node_modules', 'dist', '.git', '.github']);

  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;

    const fullPath = join(dir, name);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      findHtmlEntries(fullPath, entries);
    } else if (name.endsWith('.html')) {
      // Key = path relative to root, without extension, slashes -> dashes
      const relPath = relative(__dirname, fullPath).replace(/\.html$/, '');
      const key = relPath.split(/[\\/]/).join('-') || 'index';
      entries[key] = fullPath;
    }
  }

  return entries;
}

export default defineConfig({
  root: '.', // project root
  publicDir: 'public', // static assets folder (if any)
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: findHtmlEntries(__dirname),
    },
  },
  server: {
    open: true,
  },
});