import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { readdir } from 'node:fs/promises';
import type { GatewayManager } from '../gateway/manager';
import { getOpenClawConfigDir } from './paths';

export type ChatSearchTab = 'all' | 'agent' | 'chat' | 'cron';

export interface ChatSearchHit {
  sessionKey: string;
  agentId: string;
  lineId: string;
  title: string;
  snippet: string;
  timestampMs?: number;
}

function isCronSessionKey(sessionKey: string): boolean {
  if (!sessionKey.startsWith('agent:')) return false;
  const parts = sessionKey.split(':');
  return parts.length >= 4 && parts[2] === 'cron';
}

function matchesTab(sessionKey: string, tab: ChatSearchTab): boolean {
  const cron = isCronSessionKey(sessionKey);
  if (tab === 'cron') return cron;
  if (tab === 'chat') return !cron;
  if (tab === 'agent') return sessionKey.endsWith(':main');
  return true;
}

function normalizeFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined;
  return fileName.endsWith('.jsonl') ? fileName : `${fileName}.jsonl`;
}

/**
 * Build sessionKey → absolute path to transcript JSONL (same resolution as sessions delete route).
 */
export async function loadSessionFileMap(agentId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
  const sessionsJsonPath = join(sessionsDir, 'sessions.json');
  const fsP = await import('node:fs/promises');
  let raw: string;
  try {
    raw = await fsP.readFile(sessionsJsonPath, 'utf8');
  } catch {
    return map;
  }
  let sessionsJson: Record<string, unknown>;
  try {
    sessionsJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return map;
  }

  if (Array.isArray(sessionsJson.sessions)) {
    for (const entry of sessionsJson.sessions as Array<Record<string, unknown>>) {
      const key = (entry.key ?? entry.sessionKey) as string | undefined;
      if (!key) continue;
      let uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (!uuidFileName && typeof entry.id === 'string') {
        uuidFileName = `${entry.id}.jsonl`;
      }
      const resolved = normalizeFileName(uuidFileName);
      if (!resolved) continue;
      const absPath = join(sessionsDir, resolved);
      map.set(key, absPath);
    }
  }

  for (const [k, v] of Object.entries(sessionsJson)) {
    if (k === 'sessions' || k === 'version') continue;
    if (!k.startsWith('agent:')) continue;
    if (typeof v === 'string') {
      const resolved = normalizeFileName(v);
      if (resolved) map.set(k, join(sessionsDir, resolved));
    } else if (v && typeof v === 'object') {
      const entry = v as Record<string, unknown>;
      const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
      if (absFile && (absFile.startsWith('/') || /^[A-Za-z]:\\/.test(absFile))) {
        map.set(k, absFile);
      } else {
        let fn = absFile ?? (entry.id as string | undefined);
        if (fn && !fn.endsWith('.jsonl')) fn = `${fn}.jsonl`;
        if (fn) map.set(k, join(sessionsDir, fn));
      }
    }
  }

  return map;
}

function extractMessageText(obj: Record<string, unknown>): string {
  const msg = obj.message;
  if (!msg || typeof msg !== 'object') return '';
  const m = msg as Record<string, unknown>;
  const c = m.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    const parts: string[] = [];
    for (const block of c) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
      else if (b.type === 'thinking' && typeof b.thinking === 'string') parts.push(b.thinking);
    }
    return parts.join('\n');
  }
  return '';
}

function extractSearchableText(obj: Record<string, unknown>): string {
  const fromMsg = extractMessageText(obj);
  if (fromMsg.trim()) return fromMsg;
  return JSON.stringify(obj);
}

function getLineId(obj: Record<string, unknown>): string {
  if (typeof obj.id === 'string' && obj.id) return obj.id;
  const msg = obj.message;
  if (msg && typeof msg === 'object') {
    const id = (msg as Record<string, unknown>).id;
    if (typeof id === 'string' && id) return id;
  }
  return '';
}

function getTimestampMs(obj: Record<string, unknown>): number | undefined {
  const ts = obj.timestamp ?? obj.ts;
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts < 1e12 ? ts * 1000 : ts;
  }
  if (typeof ts === 'string' && ts.trim()) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function scanFile(
  sessionKey: string,
  agentId: string,
  filePath: string,
  qLower: string,
  hits: ChatSearchHit[],
  limit: number,
): Promise<void> {
  if (hits.length >= limit) return;
  if (filePath.includes('.deleted.')) return;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (hits.length >= limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const text = extractSearchableText(obj);
    if (!text.toLowerCase().includes(qLower)) continue;

    const msg = obj.message;
    const role =
      msg && typeof msg === 'object' ? String((msg as Record<string, unknown>).role ?? '') : '';
    if (role === 'toolResult' || role === 'tool_result' || role === 'toolresult') continue;

    const lineId = getLineId(obj);
    const ts = getTimestampMs(obj);
    const title = truncate(text, 72);
    const snippet = truncate(text, 140);
    hits.push({
      sessionKey,
      agentId,
      lineId,
      title,
      snippet,
      timestampMs: ts,
    });
  }
}

function sortHits(hits: ChatSearchHit[]): ChatSearchHit[] {
  return [...hits].sort((a, b) => {
    const ta = a.timestampMs ?? 0;
    const tb = b.timestampMs ?? 0;
    if (tb !== ta) return tb - ta;
    return a.sessionKey.localeCompare(b.sessionKey);
  });
}

/** Gateway cron.list job shape (minimal fields for search). */
interface GatewayCronJobSearchable {
  id: string;
  name: string;
  description?: string;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: { kind?: string; expr?: string; everyMs?: number; at?: string; tz?: string };
  payload: { kind?: string; message?: string; text?: string };
  delivery?: { mode?: string; channel?: string; to?: string; accountId?: string };
  state?: { lastError?: string };
}

function buildCronSearchableText(job: GatewayCronJobSearchable): string {
  const parts: string[] = [job.name];
  if (job.description?.trim()) parts.push(job.description.trim());
  const msg = job.payload?.message || job.payload?.text;
  if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim());
  const sch = job.schedule;
  if (sch) {
    if (typeof sch.expr === 'string' && sch.expr.trim()) parts.push(sch.expr.trim());
    if (typeof sch.at === 'string' && sch.at.trim()) parts.push(sch.at.trim());
    if (typeof sch.kind === 'string' && sch.kind.trim()) parts.push(sch.kind.trim());
    if (typeof sch.tz === 'string' && sch.tz.trim()) parts.push(sch.tz.trim());
    if (typeof sch.everyMs === 'number' && Number.isFinite(sch.everyMs)) parts.push(String(sch.everyMs));
  }
  const del = job.delivery;
  if (del) {
    if (typeof del.mode === 'string' && del.mode.trim()) parts.push(del.mode.trim());
    if (typeof del.channel === 'string' && del.channel.trim()) parts.push(del.channel.trim());
    if (typeof del.to === 'string' && del.to.trim()) parts.push(del.to.trim());
    if (typeof del.accountId === 'string' && del.accountId.trim()) parts.push(del.accountId.trim());
  }
  const err = job.state?.lastError;
  if (typeof err === 'string' && err.trim()) parts.push(err.trim());
  return parts.join('\n');
}

/** Resolve `agent:<agentId>:cron:<jobId>` by scanning local session maps (same as chat search). */
export async function resolveCronSessionKeyForJob(jobId: string): Promise<{ sessionKey: string; agentId: string }> {
  const agentsDir = join(getOpenClawConfigDir(), 'agents');
  let dirents;
  try {
    dirents = await readdir(agentsDir, { withFileTypes: true });
  } catch {
    return { sessionKey: `agent:main:cron:${jobId}`, agentId: 'main' };
  }
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const agentId = d.name;
    const key = `agent:${agentId}:cron:${jobId}`;
    const map = await loadSessionFileMap(agentId);
    if (map.has(key)) {
      return { sessionKey: key, agentId };
    }
  }
  return { sessionKey: `agent:main:cron:${jobId}`, agentId: 'main' };
}

async function searchCronJobMetadataHits(
  gatewayManager: GatewayManager,
  qLower: string,
  cap: number,
): Promise<ChatSearchHit[]> {
  let jobs: GatewayCronJobSearchable[];
  try {
    const result = await gatewayManager.rpc('cron.list', { includeDisabled: true });
    jobs = ((result as { jobs?: GatewayCronJobSearchable[] })?.jobs ?? []) as GatewayCronJobSearchable[];
  } catch {
    return [];
  }

  const hits: ChatSearchHit[] = [];
  for (const job of jobs) {
    if (hits.length >= cap) break;
    const hay = buildCronSearchableText(job);
    if (!hay.toLowerCase().includes(qLower)) continue;

    const { sessionKey, agentId } = await resolveCronSessionKeyForJob(job.id);
    const message = typeof job.payload?.message === 'string' ? job.payload.message : '';
    const text = typeof job.payload?.text === 'string' ? job.payload.text : '';
    const body = (message || text || '').trim();
    const desc = typeof job.description === 'string' ? job.description.trim() : '';

    hits.push({
      sessionKey,
      agentId,
      lineId: '',
      title: truncate(job.name?.trim() || 'Cron task', 72),
      snippet: truncate(body || desc || hay.replace(/\n/g, ' '), 140),
      timestampMs: job.updatedAtMs ?? job.createdAtMs,
    });
  }
  return hits;
}

function mergeTranscriptAndCronMeta(transcriptHits: ChatSearchHit[], metaHits: ChatSearchHit[], cap: number): ChatSearchHit[] {
  const seen = new Set(transcriptHits.map((h) => h.sessionKey));
  const merged: ChatSearchHit[] = [...transcriptHits];
  for (const m of metaHits) {
    if (merged.length >= cap) break;
    if (seen.has(m.sessionKey)) continue;
    merged.push(m);
    seen.add(m.sessionKey);
  }
  return merged;
}

async function searchTranscriptHitsOnly(query: string, tab: ChatSearchTab, cap: number): Promise<ChatSearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: ChatSearchHit[] = [];
  const agentsDir = join(getOpenClawConfigDir(), 'agents');
  let dirents;
  try {
    dirents = await readdir(agentsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  outer: for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const agentId = d.name;
    const index = await loadSessionFileMap(agentId);
    for (const [sessionKey, filePath] of index) {
      if (!matchesTab(sessionKey, tab)) continue;
      try {
        await scanFile(sessionKey, agentId, filePath, q, hits, cap);
      } catch {
        // skip unreadable transcript
      }
      if (hits.length >= cap) break outer;
    }
  }

  return hits;
}

export async function searchChatTranscripts(
  query: string,
  tab: ChatSearchTab,
  limit: number,
  gatewayManager?: GatewayManager | null,
): Promise<ChatSearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const cap = Math.min(Math.max(Math.floor(limit), 1), 200);
  const transcriptHits = sortHits(await searchTranscriptHitsOnly(query, tab, cap)).slice(0, cap);

  if (!gatewayManager || (tab !== 'cron' && tab !== 'all')) {
    return transcriptHits;
  }

  const metaCap = Math.max(0, cap - transcriptHits.length);
  if (metaCap === 0) {
    return transcriptHits;
  }

  const metaHits = await searchCronJobMetadataHits(gatewayManager, q, metaCap);
  const merged = mergeTranscriptAndCronMeta(transcriptHits, metaHits, cap);
  return sortHits(merged).slice(0, cap);
}
