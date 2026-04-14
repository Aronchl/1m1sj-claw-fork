#!/usr/bin/env zx
/**
 * Before electron-builder multi-arch mac/linux packages, fetch all bundled uv archs for that OS.
 * Plain `uv:download` only installs the current machine arch (e.g. darwin-arm64), which causes
 * missing `resources/bin/darwin-x64` when packaging x64+arm64 Mac apps from Apple Silicon.
 */
import 'zx/globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloader = path.join(root, 'scripts', 'download-bundled-uv.mjs');

if (process.platform === 'darwin') {
  await $`zx ${downloader} --platform=mac`;
} else if (process.platform === 'linux') {
  await $`zx ${downloader} --platform=linux`;
} else {
  await $`zx ${downloader}`;
}
