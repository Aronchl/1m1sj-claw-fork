#!/usr/bin/env zx

import 'zx/globals';

const ROOT_DIR = path.resolve(__dirname, '..');
const UV_VERSION = '0.10.0';
const DEFAULT_BASE = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;
/** Override when GitHub is unreachable (e.g. mirror). No trailing slash. */
const BASE_URL = (process.env.BUNDLED_UV_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
const BASE_URLS = String(process.env.BUNDLED_UV_BASE_URLS || '')
  .split(',')
  .map((item) => item.trim().replace(/\/$/, ''))
  .filter(Boolean);
const FETCH_TIMEOUT_MS = Number(process.env.BUNDLED_UV_FETCH_TIMEOUT_MS || 30000);
const FETCH_RETRIES = Number(process.env.BUNDLED_UV_FETCH_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.BUNDLED_UV_FETCH_RETRY_DELAY_MS || 1500);
const OUTPUT_BASE = path.join(ROOT_DIR, 'resources', 'bin');

// Mapping Node platforms/archs to uv release naming
const TARGETS = {
  'darwin-arm64': {
    filename: 'uv-aarch64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'darwin-x64': {
    filename: 'uv-x86_64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'win32-arm64': {
    filename: 'uv-aarch64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'win32-x64': {
    filename: 'uv-x86_64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'linux-arm64': {
    filename: 'uv-aarch64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  },
  'linux-x64': {
    filename: 'uv-x86_64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  }
};

// Platform groups for building multi-arch packages
const PLATFORM_GROUPS = {
  'mac': ['darwin-x64', 'darwin-arm64'],
  'win': ['win32-x64', 'win32-arm64'],
  'linux': ['linux-x64', 'linux-arm64']
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCandidateUrls(filename) {
  const allBases = [...BASE_URLS, BASE_URL];
  const dedupedBases = [...new Set(allBases)];
  return dedupedBases.map((base) => `${base}/${filename}`);
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === FETCH_RETRIES;
      if (isLastAttempt) {
        break;
      }
      echo(chalk.yellow`⚠️ Download failed (attempt ${attempt}/${FETCH_RETRIES}): ${String(error)}`);
      await sleep(RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

async function setupTarget(id) {
  const target = TARGETS[id];
  if (!target) {
    echo(chalk.yellow`⚠️ Target ${id} is not supported by this script.`);
    return;
  }

  const targetDir = path.join(OUTPUT_BASE, id);
  const tempDir = path.join(ROOT_DIR, 'temp_uv_extract');
  const archivePath = path.join(ROOT_DIR, target.filename);
  const downloadUrls = buildCandidateUrls(target.filename);

  echo(chalk.blue`\n📦 Setting up uv for ${id}...`);

  // Cleanup & Prep
  await fs.remove(targetDir);
  await fs.remove(tempDir);
  await fs.ensureDir(targetDir);
  await fs.ensureDir(tempDir);

  try {
    // Download
    let downloaded = false;
    let lastError;
    for (const downloadUrl of downloadUrls) {
      try {
        echo`⬇️ Downloading: ${downloadUrl}`;
        const response = await fetchWithRetry(downloadUrl);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(archivePath, Buffer.from(buffer));
        downloaded = true;
        break;
      } catch (error) {
        lastError = error;
        echo(chalk.yellow`⚠️ Download source failed: ${downloadUrl}`);
      }
    }
    if (!downloaded) {
      throw lastError ?? new Error('Failed to download uv archive from all sources.');
    }

    // Extract
    echo`📂 Extracting...`;
    if (target.filename.endsWith('.zip')) {
      if (os.platform() === 'win32') {
        const { execFileSync } = await import('child_process');
        const psCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archivePath.replace(/'/g, "''")}', '${tempDir.replace(/'/g, "''")}')`;
        execFileSync('powershell.exe', ['-NoProfile', '-Command', psCommand], { stdio: 'inherit' });
      } else {
        await $`unzip -q -o ${archivePath} -d ${tempDir}`;
      }
    } else {
      await $`tar -xzf ${archivePath} -C ${tempDir}`;
    }

    // Move binary
    // uv archives usually contain a folder named after the target
    const folderName = target.filename.replace('.tar.gz', '').replace('.zip', '');
    const sourceBin = path.join(tempDir, folderName, target.binName);
    const destBin = path.join(targetDir, target.binName);

    if (await fs.pathExists(sourceBin)) {
      await fs.move(sourceBin, destBin, { overwrite: true });
    } else {
      echo(chalk.yellow`🔍 Binary not found in expected subfolder, searching...`);
      const files = await glob(`**/${target.binName}`, { cwd: tempDir, absolute: true });
      if (files.length > 0) {
        await fs.move(files[0], destBin, { overwrite: true });
      } else {
        throw new Error(`Could not find ${target.binName} in extracted files.`);
      }
    }

    // Permission fix
    if (os.platform() !== 'win32') {
      await fs.chmod(destBin, 0o755);
    }

    echo(chalk.green`✅ Success: ${destBin}`);
  } finally {
    // Cleanup
    await fs.remove(archivePath);
    await fs.remove(tempDir);
  }
}

// Main logic
const downloadAll = argv.all;
const platform = argv.platform;

if (downloadAll) {
  // Download for all platforms
  echo(chalk.cyan`🌐 Downloading uv binaries for ALL supported platforms...`);
  for (const id of Object.keys(TARGETS)) {
    await setupTarget(id);
  }
} else if (platform) {
  // Download for a specific platform (e.g., --platform=mac)
  const targets = PLATFORM_GROUPS[platform];
  if (!targets) {
    echo(chalk.red`❌ Unknown platform: ${platform}`);
    echo(`Available platforms: ${Object.keys(PLATFORM_GROUPS).join(', ')}`);
    process.exit(1);
  }
  
  echo(chalk.cyan`🎯 Downloading uv binaries for platform: ${platform}`);
  echo(`   Architectures: ${targets.join(', ')}`);
  for (const id of targets) {
    await setupTarget(id);
  }
} else {
  // Download for current system only (default for local dev)
  const currentId = `${os.platform()}-${os.arch()}`;
  echo(chalk.cyan`💻 Detected system: ${currentId}`);
  
  if (TARGETS[currentId]) {
    await setupTarget(currentId);
  } else {
    echo(chalk.red`❌ Current system ${currentId} is not in the supported download list.`);
    echo(`Supported targets: ${Object.keys(TARGETS).join(', ')}`);
    echo(`\nTip: Use --platform=<platform> to download for a specific platform`);
    echo(`     Use --all to download for all platforms`);
    process.exit(1);
  }
}

echo(chalk.green`\n🎉 Done!`);
