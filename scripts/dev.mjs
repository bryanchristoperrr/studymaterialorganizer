/**
 * Menjalankan backend (Express, port 3001) dan frontend
 * (Vite dev server, port 5173) SEKALIGUS tanpa dependensi
 * tambahan. Output kedua proses diteruskan ke terminal ini.
 *
 * Pemakaian: npm run dev:all
 *
 * Catatan implementasi: npm.cmd tidak bisa di-spawn langsung
 * di Node 22 (EINVAL, lihat CVE-2024-27980), sehingga proses
 * anak memanggil `node` ke entry point tsx dan vite secara
 * langsung — ini juga membuat skrip lintas-platform.
 *
 * Tanpa skrip ini, "npm run dev" saja membuat Vite gagal
 * memproxy /api → error ECONNREFUSED.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Root proyek: satu level di atas folder scripts/.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Path ke entry point package, dengan fallback yang informatif. */
function entry(relativePath, label) {
  const path = join(ROOT, relativePath);
  if (!existsSync(path)) {
    throw new Error(
      `${label} tidak ditemukan di ${path}. Jalankan "npm install" dan "npm --prefix server install" dulu.`,
    );
  }
  return path;
}

const processes = [
  {
    name: 'api',
    // tsx watch server/src/index.ts (lihat server/package.json "dev")
    args: [entry(join('server', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'tsx'), 'watch', join('server', 'src', 'index.ts')],
    cwd: ROOT,
  },
  {
    name: 'web',
    // vite (lihat package.json "dev")
    args: [entry(join('node_modules', 'vite', 'bin', 'vite.js'), 'vite')],
    cwd: ROOT,
  },
];

const children = processes.map(({ name, args, cwd }) => {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    // eslint-disable-next-line no-console -- CLI log.
    console.error(`[${name}] berhenti (kode ${code ?? 0})`);
  });

  return { name, child };
});

// eslint-disable-next-line no-console -- CLI log.
console.log('[dev:all] menjalankan API (port 3001) dan Vite (port 5173)…');

// Hentikan keduanya saat salah satu berhenti atau Ctrl+C ditekan.
const shutdown = () => {
  for (const { name, child } of children) {
    if (!child.killed) child.kill('SIGTERM');
    // eslint-disable-next-line no-console -- CLI log.
    console.log(`[${name}] dihentikan`);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
