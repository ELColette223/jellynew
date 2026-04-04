#!/usr/bin/env node
/**
 * Copies the backend server into dist/server/ after a production build,
 * then installs production-only dependencies so the dist is self-contained.
 *
 * Excludes: node_modules, data/, *.db, *.db-shm, *.db-wal
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'server');
const DEST = path.join(ROOT, 'dist', 'server');

const EXCLUDE_DIRS = new Set(['node_modules', 'data']);
const EXCLUDE_EXTS = new Set(['.db', '.db-shm', '.db-wal', '.sqlite']);

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (EXCLUDE_EXTS.has(ext)) continue;
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Bundling backend server into dist/server/...');
copyDir(SRC, DEST);
console.log('  Files copied.');

console.log('Installing server production dependencies in dist/server/...');
execSync('npm install --omit=dev --prefer-offline', {
    cwd: DEST,
    stdio: 'inherit'
});
console.log('Done. To start the production server:');
console.log('  node dist/server/index.js');
