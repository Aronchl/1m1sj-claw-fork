import { chmod, mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
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

async function writeMainWorkspaceTemplate(fileName: string, body: string): Promise<void> {
  const ws = join(bundleRoot, 'agents', 'main', 'workspace');
  await mkdir(ws, { recursive: true });
  await writeFile(join(ws, fileName), body, 'utf8');
}

async function writeMainWorkspaceSkill(relativePath: string, body: string): Promise<void> {
  const full = join(bundleRoot, 'agents', 'main', 'workspace', 'skills', relativePath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, body, 'utf8');
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

  it('keeps protected main guide files synced from bundle', async () => {
    await writeMainWorkspaceTemplate('SOUL.md', 'main-soul');
    await writeMainWorkspaceTemplate('AGENTS.md', 'main-agents');
    await writeMainWorkspaceTemplate('TOOLS.md', 'main-tools');
    await writeMainWorkspaceTemplate('IDENTITY.md', 'main-identity');

    const { ensureMainAgentWorkspaceTemplatesInstalled } = await import('@electron/utils/agent-config');
    await ensureMainAgentWorkspaceTemplatesInstalled();

    const mainWorkspaceDir = join(testHome, '.openclaw', 'workspace');
    const soulPath = join(mainWorkspaceDir, 'SOUL.md');
    const agentsPath = join(mainWorkspaceDir, 'AGENTS.md');
    const toolsPath = join(mainWorkspaceDir, 'TOOLS.md');
    const identityPath = join(mainWorkspaceDir, 'IDENTITY.md');

    await expect(readFile(soulPath, 'utf8')).resolves.toBe('main-soul');
    await expect(readFile(agentsPath, 'utf8')).resolves.toBe('main-agents');
    await expect(readFile(toolsPath, 'utf8')).resolves.toBe('main-tools');
    await expect(readFile(identityPath, 'utf8')).resolves.toBe('main-identity');

    await writeMainWorkspaceTemplate('SOUL.md', 'main-soul-v2');
    await writeMainWorkspaceTemplate('AGENTS.md', 'main-agents-v2');
    await writeMainWorkspaceTemplate('TOOLS.md', 'main-tools-v2');
    await chmod(soulPath, 0o644);
    await chmod(agentsPath, 0o644);
    await chmod(toolsPath, 0o644);
    await writeFile(soulPath, 'user-edited-main-soul', 'utf8');
    await writeFile(agentsPath, 'user-edited-main-agents', 'utf8');
    await writeFile(toolsPath, 'user-edited-main-tools', 'utf8');
    await ensureMainAgentWorkspaceTemplatesInstalled();

    await expect(readFile(soulPath, 'utf8')).resolves.toBe('main-soul-v2');
    await expect(readFile(agentsPath, 'utf8')).resolves.toBe('main-agents-v2');
    await expect(readFile(toolsPath, 'utf8')).resolves.toBe('main-tools-v2');
    await expect(readFile(identityPath, 'utf8')).resolves.toBe('main-identity');
  });

  it('marks protected main guide files as read-only', async () => {
    await writeMainWorkspaceTemplate('SOUL.md', 'main-soul');
    await writeMainWorkspaceTemplate('AGENTS.md', 'main-agents');
    await writeMainWorkspaceTemplate('TOOLS.md', 'main-tools');

    const { ensureMainAgentWorkspaceTemplatesInstalled } = await import('@electron/utils/agent-config');
    await ensureMainAgentWorkspaceTemplatesInstalled();

    const mainWorkspaceDir = join(testHome, '.openclaw', 'workspace');
    const soulPath = join(mainWorkspaceDir, 'SOUL.md');
    const soulStat = await stat(soulPath);
    if (process.platform !== 'win32') {
      expect((soulStat.mode & 0o200) === 0).toBe(true);
    }
  });

  it('seeds main workspace skills tree only when files are missing', async () => {
    await writeMainWorkspaceTemplate('SOUL.md', 'main-soul');
    await writeMainWorkspaceSkill('demo-skill/SKILL.md', 'skill-body');

    const { ensureMainAgentWorkspaceTemplatesInstalled } = await import('@electron/utils/agent-config');
    await ensureMainAgentWorkspaceTemplatesInstalled();

    const mainWorkspaceDir = join(testHome, '.openclaw', 'workspace');
    const skillPath = join(mainWorkspaceDir, 'skills', 'demo-skill', 'SKILL.md');
    await expect(readFile(skillPath, 'utf8')).resolves.toBe('skill-body');

    await writeFile(skillPath, 'user-skill-edit', 'utf8');
    await ensureMainAgentWorkspaceTemplatesInstalled();
    await expect(readFile(skillPath, 'utf8')).resolves.toBe('user-skill-edit');
  });
});
