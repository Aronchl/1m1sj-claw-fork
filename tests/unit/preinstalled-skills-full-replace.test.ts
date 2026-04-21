import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData, bundleRoot } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  const home = `/tmp/clawx-preinst-skills-${suffix}`;
  return {
    testHome: home,
    testUserData: `${home}-user-data`,
    bundleRoot: `${home}/bundle`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = { ...actual, homedir: () => testHome };
  return { ...mocked, default: mocked };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
  },
}));

vi.mock('@electron/utils/paths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@electron/utils/paths')>();
  return {
    ...actual,
    getResourcesDir: () => bundleRoot,
  };
});

describe('ensurePreinstalledSkillsInstalled full replace', () => {
  beforeEach(async () => {
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await mkdir(bundleRoot, { recursive: true });
    const openclawDir = join(testHome, '.openclaw');
    await mkdir(openclawDir, { recursive: true });
    await writeFile(
      join(openclawDir, 'openclaw.json'),
      JSON.stringify({
        skills: {
          entries: {
            onlyA: { enabled: true },
            extraUser: { enabled: true, apiKey: 'secret' },
          },
        },
      }),
      'utf8',
    );
  });

  it('wipes ~/.openclaw/skills and openclaw.json entries not in manifest', async () => {
    const skillsRoot = join(testHome, '.openclaw', 'skills');
    await mkdir(join(skillsRoot, 'extraUser'), { recursive: true });
    await writeFile(join(skillsRoot, 'extraUser', 'SKILL.md'), 'extra', 'utf8');

    await mkdir(join(bundleRoot, 'skills'), { recursive: true });
    await writeFile(
      join(bundleRoot, 'skills', 'preinstalled-manifest.json'),
      JSON.stringify({
        skills: [{ slug: 'onlyA', version: '1', autoEnable: false }],
      }),
      'utf8',
    );
    const pre = join(bundleRoot, 'preinstalled-skills', 'onlyA');
    await mkdir(pre, { recursive: true });
    await writeFile(join(pre, 'SKILL.md'), 'bundled-a', 'utf8');

    const { ensurePreinstalledSkillsInstalled } = await import('@electron/utils/skill-config');
    await ensurePreinstalledSkillsInstalled();

    await expect(readFile(join(skillsRoot, 'onlyA', 'SKILL.md'), 'utf8')).resolves.toBe('bundled-a');
    await expect(readFile(join(skillsRoot, 'extraUser', 'SKILL.md'), 'utf8')).rejects.toThrow();

    const cfg = JSON.parse(await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8')) as {
      skills?: { entries?: Record<string, unknown> };
    };
    expect(cfg.skills?.entries).toEqual({ onlyA: { enabled: true } });
  });
});
