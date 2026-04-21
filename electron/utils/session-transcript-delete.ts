/**
 * Physically delete a chat session transcript: remove `<uuid>.jsonl` and any legacy
 * `<uuid>.deleted.jsonl` from older soft-delete behavior, then strip the session from sessions.json.
 * Used by Host API and session:delete IPC.
 */
import { join } from 'node:path';
import { getOpenClawConfigDir } from './paths';

export type DeleteSessionTranscriptOutcome =
  | { ok: true }
  | { ok: false; error: string; notFound?: boolean };

/**
 * Remove transcript files on disk (no rename).
 * Deletes the active `*.jsonl` and legacy `*.deleted.jsonl` if present; ignores ENOENT per path.
 * Fails only on non-ENOENT unlink errors (permissions, etc.).
 */
export async function removeSessionTranscriptFiles(
  activeJsonlPath: string,
  legacyDeletedJsonlPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fs = await import('node:fs/promises');

  const tryUnlink = async (p: string) => {
    try {
      await fs.unlink(p);
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return;
      throw e;
    }
  };

  try {
    await tryUnlink(activeJsonlPath);
    await tryUnlink(legacyDeletedJsonlPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function resolveTranscriptPaths(
  sessionsJson: Record<string, unknown>,
  sessionKey: string,
  sessionsDir: string,
): { activeJsonlPath: string; legacyDeletedJsonlPath: string } | null {
  let uuidFileName: string | undefined;
  let activeJsonlPath: string | undefined;

  if (Array.isArray(sessionsJson.sessions)) {
    const entry = (sessionsJson.sessions as Array<Record<string, unknown>>)
      .find((s) => s.key === sessionKey || s.sessionKey === sessionKey);
    if (entry) {
      uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (!uuidFileName && typeof entry.id === 'string') {
        uuidFileName = `${entry.id}.jsonl`;
      }
    }
  }

  if (!uuidFileName && sessionsJson[sessionKey] != null) {
    const val = sessionsJson[sessionKey];
    if (typeof val === 'string') {
      uuidFileName = val;
    } else if (typeof val === 'object' && val !== null) {
      const entry = val as Record<string, unknown>;
      const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (absFile) {
        if (absFile.startsWith('/') || absFile.match(/^[A-Za-z]:\\/)) {
          activeJsonlPath = absFile;
        } else {
          uuidFileName = absFile;
        }
      } else {
        const uuidVal = (entry.id ?? entry.sessionId) as string | undefined;
        if (uuidVal) uuidFileName = uuidVal.endsWith('.jsonl') ? uuidVal : `${uuidVal}.jsonl`;
      }
    }
  }

  if (!uuidFileName && !activeJsonlPath) {
    return null;
  }

  if (!activeJsonlPath) {
    if (!uuidFileName!.endsWith('.jsonl')) uuidFileName = `${uuidFileName}.jsonl`;
    activeJsonlPath = join(sessionsDir, uuidFileName!);
  }

  const legacyDeletedJsonlPath = activeJsonlPath.replace(/\.jsonl$/, '.deleted.jsonl');
  return { activeJsonlPath, legacyDeletedJsonlPath };
}

async function stripSessionKeyFromSessionsJsonFile(
  sessionsJsonPath: string,
  sessionKey: string,
): Promise<void> {
  const fs = await import('node:fs/promises');
  const raw2 = await fs.readFile(sessionsJsonPath, 'utf8');
  const json2 = JSON.parse(raw2) as Record<string, unknown>;

  if (Array.isArray(json2.sessions)) {
    json2.sessions = (json2.sessions as Array<Record<string, unknown>>)
      .filter((s) => s.key !== sessionKey && s.sessionKey !== sessionKey);
  } else if (json2[sessionKey]) {
    delete json2[sessionKey];
  }

  await fs.writeFile(sessionsJsonPath, JSON.stringify(json2, null, 2), 'utf8');
}

/**
 * Full delete for a session key (agent:…:…): remove transcript files, then sessions.json entry.
 */
export async function executeDeleteSessionTranscript(sessionKey: string): Promise<DeleteSessionTranscriptOutcome> {
  if (!sessionKey || !sessionKey.startsWith('agent:')) {
    return { ok: false, error: `Invalid sessionKey: ${sessionKey}` };
  }

  const parts = sessionKey.split(':');
  if (parts.length < 3) {
    return { ok: false, error: `sessionKey has too few parts: ${sessionKey}` };
  }

  const agentId = parts[1];
  const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
  const sessionsJsonPath = join(sessionsDir, 'sessions.json');

  let sessionsJson: Record<string, unknown>;
  try {
    const raw = await (await import('node:fs/promises')).readFile(sessionsJsonPath, 'utf8');
    sessionsJson = JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, error: `Could not read sessions.json: ${String(e)}` };
  }

  const paths = resolveTranscriptPaths(sessionsJson, sessionKey, sessionsDir);
  if (!paths) {
    return { ok: false, notFound: true, error: `Cannot resolve file for session: ${sessionKey}` };
  }

  const fileOut = await removeSessionTranscriptFiles(paths.activeJsonlPath, paths.legacyDeletedJsonlPath);
  if (!fileOut.ok) {
    return { ok: false, error: fileOut.error };
  }

  try {
    await stripSessionKeyFromSessionsJsonFile(sessionsJsonPath, sessionKey);
  } catch (e) {
    return {
      ok: false,
      error: `Transcripts removed but could not write sessions.json: ${String(e)}`,
    };
  }

  return { ok: true };
}
