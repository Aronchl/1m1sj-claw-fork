import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const DEFAULT_DESKTOP_AUTH_APP_ID = '10001';
const DEFAULT_DESKTOP_AUTH_BASE_URL = 'https://id3.1m1sj.xin';

let cachedDotenv: Record<string, string> | null = null;

function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadDotenvFallback(): Record<string, string> {
  if (cachedDotenv) return cachedDotenv;
  const candidates = [
    join(process.cwd(), '.env'),
    join(app.getAppPath(), '.env'),
    join(app.getAppPath(), '..', '.env'),
  ];
  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      cachedDotenv = parseDotenv(raw);
      return cachedDotenv;
    } catch {
      // try next
    }
  }
  cachedDotenv = {};
  return cachedDotenv;
}

function readEnvWithDotenvFallback(key: string): string {
  const direct = process.env[key]?.trim();
  if (direct) return direct;
  const fromDotenv = loadDotenvFallback()[key]?.trim();
  return fromDotenv || '';
}

export function resolveDesktopAuthBaseUrl(): string {
  const fromEnv = readEnvWithDotenvFallback('CLAWX_DESKTOP_AUTH_BASE_URL');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return DEFAULT_DESKTOP_AUTH_BASE_URL.replace(/\/+$/, '');
}

export function resolveDesktopAuthAppId(): string {
  const appId = readEnvWithDotenvFallback('CLAWX_DESKTOP_AUTH_APP_ID');
  if (appId) return appId;
  return DEFAULT_DESKTOP_AUTH_APP_ID;
}

