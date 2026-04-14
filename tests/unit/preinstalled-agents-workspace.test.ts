import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData, bundleRoot } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  const home = `/tmp/clawx-preinst-ws-${suffix}`;
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

async function writeBundleManifest(agents: unknown[]): Promise<void> {
  const dir = join(bundleRoot, 'agents');
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'preinstalled-manifest.json'),
    `${JSON.stringify({ agents }, null, 2)}\n`,
    'utf8',
  );
}

async function writeWorkspaceTemplate(agentId: string, soulBody: string): Promise<void> {
  const ws = join(bundleRoot, 'agents', agentId, 'workspace');
  await mkdir(ws, { recursive: true });
  await writeFile(join(ws, 'SOUL.md'), soulBody, 'utf8');
}

describe('preinstalled agent workspace templates', () => {
  beforeEach(async () => {
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await mkdir(bundleRoot, { recursive: true });
    const openclawDir = join(testHome, '.openclaw');
    await mkdir(openclawDir, { recursive: true });
    await writeFile(join(openclawDir, 'openclaw.json'), '{}\n', 'utf8');
  });

  it('copies bundled *.md into the agent workspace on first install', async () => {
    await writeBundleManifest([{ id: 'academy', name: 'Academy', version: '1' }]);
    await writeWorkspaceTemplate('academy', 'v1-soul');

    const { ensurePreinstalledAgentsInstalled } = await import('@electron/utils/agent-config');
    await ensurePreinstalledAgentsInstalled();

    const soulPath = join(testHome, '.openclaw', 'workspace-academy', 'SOUL.md');
    await expect(readFile(soulPath, 'utf8')).resolves.toBe('v1-soul');
  });

  it('overwrites workspace *.md when manifest version bumps', async () => {
    await writeBundleManifest([{ id: 'academy', name: 'Academy', version: '1' }]);
    await writeWorkspaceTemplate('academy', 'v1-soul');

    const { ensurePreinstalledAgentsInstalled } = await import('@electron/utils/agent-config');
    await ensurePreinstalledAgentsInstalled();

    await writeBundleManifest([{ id: 'academy', name: 'Academy', version: '2' }]);
    await writeWorkspaceTemplate('academy', 'v2-soul');
    await ensurePreinstalledAgentsInstalled();

    const soulPath = join(testHome, '.openclaw', 'workspace-academy', 'SOUL.md');
    await expect(readFile(soulPath, 'utf8')).resolves.toBe('v2-soul');
  });

  it('does not overwrite templates when version unchanged', async () => {
    await writeBundleManifest([{ id: 'academy', name: 'Academy', version: '1' }]);
    await writeWorkspaceTemplate('academy', 'v1-soul');

    const { ensurePreinstalledAgentsInstalled } = await import('@electron/utils/agent-config');
    await ensurePreinstalledAgentsInstalled();

    const soulPath = join(testHome, '.openclaw', 'workspace-academy', 'SOUL.md');
    await writeFile(soulPath, 'user-edited', 'utf8');

    await ensurePreinstalledAgentsInstalled();
    await expect(readFile(soulPath, 'utf8')).resolves.toBe('user-edited');
  });
});
