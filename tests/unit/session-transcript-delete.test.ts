import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeSessionTranscriptFiles } from '@electron/utils/session-transcript-delete';

async function pathGone(p: string) {
  await expect(access(p, constants.F_OK)).rejects.toMatchObject({
    code: 'ENOENT',
  });
}

describe('removeSessionTranscriptFiles', () => {
  it('deletes active jsonl and ignores missing legacy deleted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'clawx-sess-'));
    const active = join(dir, 'abc.jsonl');
    const legacy = join(dir, 'abc.deleted.jsonl');
    await writeFile(active, 'x', 'utf8');
    const out = await removeSessionTranscriptFiles(active, legacy);
    expect(out).toEqual({ ok: true });
    await pathGone(active);
    await pathGone(legacy);
  });

  it('deletes legacy deleted when active is already absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'clawx-sess-'));
    const active = join(dir, 'x.jsonl');
    const legacy = join(dir, 'x.deleted.jsonl');
    await writeFile(legacy, 'old', 'utf8');
    const out = await removeSessionTranscriptFiles(active, legacy);
    expect(out).toEqual({ ok: true });
    await pathGone(legacy);
  });

  it('succeeds when neither file exists (stale metadata cleanup)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'clawx-sess-'));
    const active = join(dir, 'gone.jsonl');
    const legacy = join(dir, 'gone.deleted.jsonl');
    const out = await removeSessionTranscriptFiles(active, legacy);
    expect(out).toEqual({ ok: true });
  });

  it('deletes both when active and legacy exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'clawx-sess-'));
    const active = join(dir, 'dup.jsonl');
    const legacy = join(dir, 'dup.deleted.jsonl');
    await writeFile(active, 'new', 'utf8');
    await writeFile(legacy, 'archived', 'utf8');
    const out = await removeSessionTranscriptFiles(active, legacy);
    expect(out).toEqual({ ok: true });
    await pathGone(active);
    await pathGone(legacy);
  });
});
