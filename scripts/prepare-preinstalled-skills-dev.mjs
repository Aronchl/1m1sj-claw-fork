#!/usr/bin/env zx

import 'zx/globals';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const lockPath = join(ROOT, 'build', 'preinstalled-skills', '.preinstalled-lock.json');
const manifestPath = join(ROOT, 'resources', 'skills', 'preinstalled-manifest.json');
const bundleScript = join(ROOT, 'scripts', 'bundle-preinstalled-skills.mjs');

if (process.env.CLAWX_SKIP_PREINSTALLED_SKILLS_PREPARE === '1') {
  echo`Skipping preinstalled skills prepare (CLAWX_SKIP_PREINSTALLED_SKILLS_PREPARE=1).`;
  process.exit(0);
}

function manifestNewerThanLock() {
  if (!existsSync(lockPath) || !existsSync(manifestPath)) {
    return false;
  }
  try {
    const lockMtime = statSync(lockPath).mtimeMs;
    const manifestMtime = statSync(manifestPath).mtimeMs;
    return manifestMtime > lockMtime;
  } catch {
    return true;
  }
}

/** Stale checkout: no build tree, or manifest lists a slug but build/.../<slug>/SKILL.md is missing. */
function bundleMissingAnySkillMd() {
  const buildRoot = join(ROOT, 'build', 'preinstalled-skills');
  if (!existsSync(manifestPath)) {
    return false;
  }
  if (!existsSync(buildRoot)) {
    return true;
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    for (const spec of skills) {
      const slug = typeof spec?.slug === 'string' ? spec.slug.trim() : '';
      if (!slug) continue;
      const md = join(buildRoot, slug, 'SKILL.md');
      if (!existsSync(md)) {
        return true;
      }
    }
  } catch {
    return true;
  }
  return false;
}

/** True when we should run bundle: no lock, manifest updated, or incomplete build tree. */
function needsBundleRefresh() {
  if (!existsSync(lockPath)) {
    return true;
  }
  if (manifestNewerThanLock()) {
    return true;
  }
  if (bundleMissingAnySkillMd()) {
    return true;
  }
  return false;
}

if (!needsBundleRefresh()) {
  echo`Preinstalled skills bundle already exists (lock up to date with manifest), skipping prepare.`;
  process.exit(0);
}

if (existsSync(lockPath)) {
  if (manifestNewerThanLock()) {
    echo`preinstalled-manifest.json newer than lock — refreshing preinstalled skills bundle...`;
  } else if (bundleMissingAnySkillMd()) {
    echo`Preinstalled skills bundle incomplete (missing SKILL.md under build/) — refreshing...`;
  }
} else {
  echo`Preinstalled skills bundle missing, preparing for dev startup...`;
}

try {
  await $`zx ${bundleScript}`;
} catch (error) {
  // Dev startup should remain available even if network-based skill fetching fails.
  echo`Warning: failed to prepare preinstalled skills for dev startup: ${error?.message || error}`;
  process.exit(0);
}
