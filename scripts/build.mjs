import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const distDir = resolve(root, 'dist');

execSync('npx vite build', { stdio: 'inherit' });

const appHtml = resolve(distDir, 'app.html');
const distIndex = resolve(distDir, 'index.html');
if (existsSync(appHtml)) {
  renameSync(appHtml, distIndex);
}

// Pastikan link manifest tetap mengarah ke ./manifest.webmanifest agar sinkron dengan sw.js
if (existsSync(distIndex)) {
  const html = readFileSync(distIndex, 'utf8').replace(
    /href="\.\/assets\/[^"]+\.webmanifest"/g,
    'href="./manifest.webmanifest"'
  );
  writeFileSync(distIndex, html, 'utf8');
}

// Hapus duplikat .webmanifest ber-hash yang dihasilkan Vite dari link di app.html
const distAssets = resolve(distDir, 'assets');
if (existsSync(distAssets)) {
  for (const name of readdirSync(distAssets)) {
    if (name.endsWith('.webmanifest')) rmSync(resolve(distAssets, name), { force: true });
  }
}

// Sinkronkan versi cache Service Worker dengan hash hasil build terbaru
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const buildHash = existsSync(distIndex)
  ? createHash('sha1').update(readFileSync(distIndex)).digest('hex').slice(0, 8)
  : Date.now().toString(36);
const swVersion = `v${pkg.version}-${buildHash}`;
const swPath = resolve(root, 'sw.js');
if (existsSync(swPath)) {
  const swText = readFileSync(swPath, 'utf8').replace(
    /const VERSION = '[^']+';/,
    `const VERSION = '${swVersion}';`
  );
  writeFileSync(swPath, swText, 'utf8');
}

// Salin aset statis ke dist/ agar dist/ siap deploy mandiri
const staticFiles = [
  'manifest.webmanifest',
  'sw.js',
  'offline.html',
  '404.html',
  'logo_riau.webp',
  'logo_sekolah.webp',
];

for (const file of staticFiles) {
  const src = resolve(root, file);
  if (existsSync(src)) cpSync(src, resolve(distDir, file));
}

for (const dir of ['icons', 'screenshots']) {
  const src = resolve(root, dir);
  if (existsSync(src)) cpSync(src, resolve(distDir, dir), { recursive: true });
}

// Sinkronkan juga ke root (index.html + assets/) untuk GitHub Pages dari root
const rootAssets = resolve(root, 'assets');
if (existsSync(rootAssets)) rmSync(rootAssets, { recursive: true, force: true });
mkdirSync(rootAssets, { recursive: true });
cpSync(resolve(distDir, 'assets'), rootAssets, { recursive: true });
cpSync(distIndex, resolve(root, 'index.html'));

console.log(`Build selesai (${swVersion}): dist/ dan root index.html + assets/ sudah sinkron.`);
