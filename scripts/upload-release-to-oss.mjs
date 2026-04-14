#!/usr/bin/env zx
/**
 * Upload `release/` root-level artifacts to Aliyun OSS (S3-compatible API via AWS SDK v3).
 * electron-builder's built-in `publish: s3` uses app-builder and breaks against OSS ("unexpected true").
 *
 * Usage: zx scripts/upload-release-to-oss.mjs --prefix=beta [--force]
 * Env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (same RAM user as before).
 * Optional: OSS_BUCKET (default 1m1sj-claw-installer), OSS_ENDPOINT, AWS_REGION.
 *
 * Skip upload (aligned with electron-updater generic provider + AppUpdater):
 * - `package.json` `version` → update channel via detectUpdateChannel (same as electron/main/updater.ts).
 * - Only considers feed YAML names GenericProvider would GET: `{channel}.yml`, `{channel}-mac.yml`,
 *   `{channel}-linux.yml`, `{channel}-linux-arm64.yml` (see electron-updater Provider#getChannelFilePrefix).
 * - For each such file that exists locally in `release/`, compares `version:` to OSS; also requires local
 *   `version:` === package.json version. If all those feeds already match OSS, exit 0 (no upload).
 * - Requires `--prefix` === derived channel (e.g. beta build → prefix beta). Override: `--force` / OSS_UPLOAD_FORCE=1.
 */
import 'zx/globals';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { detectUpdateChannel, listGenericProviderUpdateYmlNames } from './lib/updater-feed.mjs';

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

const prefixArg = argv.prefix ?? process.env.OSS_RELEASE_PREFIX;
if (!prefixArg || String(prefixArg).trim() === '') {
  echo(chalk.red`Missing --prefix=latest|beta (or OSS_RELEASE_PREFIX).`);
  process.exit(1);
}
const prefix = String(prefixArg).replace(/^\/+|\/+$/g, '');

const forceUpload = Boolean(argv.force) || process.env.OSS_UPLOAD_FORCE === '1';

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!accessKeyId || !secretAccessKey) {
  echo(chalk.red`AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required.`);
  process.exit(1);
}

const bucket = process.env.OSS_BUCKET || '1m1sj-claw-installer';
const endpoint = process.env.OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com';
const region = process.env.AWS_REGION || 'oss-cn-beijing';

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  // Aliyun OSS rejects path-style (SecondLevelDomainForbidden); virtual-hosted style is required.
  forcePathStyle: false,
  // Large artifacts (zip/dmg) may take long; allow more retries.
  maxAttempts: 8,
});

function contentTypeFor(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'text/yaml; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadSmallObject({ bucket, key, filePath, contentType }) {
  // Small files: buffering is fine and avoids "non-retryable streaming request" on retries.
  const body = await fs.readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function uploadLargeObjectMultipart({ bucket, key, filePath, contentType, size }) {
  // True multipart upload with per-part streams (rewindable by recreating stream),
  // so transient ECONNRESET won't fail with "non-retryable streaming request".
  const partSize = 16 * 1024 * 1024; // 16MB
  const maxPartAttempts = 6;

  const createOut = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  );
  const uploadId = createOut.UploadId;
  if (!uploadId) {
    throw new Error(`CreateMultipartUpload returned empty UploadId for ${key}`);
  }

  const parts = [];
  try {
    const partCount = Math.ceil(size / partSize);
    const fh = await fs.open(filePath, 'r');

    try {
      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        const start = (partNumber - 1) * partSize;
        const len = Math.min(partSize, size - start);

        let lastErr;
        for (let attempt = 1; attempt <= maxPartAttempts; attempt++) {
          try {
            // OSS 对 aws-chunked（流式签名）兼容性差；这里用 Buffer，避免 chunked encoding。
            const buf = Buffer.allocUnsafe(len);
            const { bytesRead } = await fh.read(buf, 0, len, start);
            if (bytesRead !== len) {
              throw new Error(
                `Short read for ${key} part ${partNumber}/${partCount}: ${bytesRead} != ${len}`,
              );
            }

            const out = await client.send(
              new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: buf,
                ContentLength: len,
              }),
            );
            if (!out.ETag) {
              throw new Error(`UploadPart missing ETag (part ${partNumber}/${partCount})`);
            }
            parts.push({ ETag: out.ETag, PartNumber: partNumber });
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < maxPartAttempts) {
              const backoff = Math.min(15000, 500 * 2 ** (attempt - 1));
              await sleep(backoff);
            }
          }
        }

        if (lastErr) {
          throw lastErr;
        }
      }
    } finally {
      await fh.close().catch(() => undefined);
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (e) {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch {
      // ignore abort errors
    }
    throw e;
  }
}

/** Same field electron-updater parses (js-yaml) — keep regex loose enough for builder output */
function parseVersionFromYml(text) {
  const m = String(text).match(/^version:\s*['"]?([^\s'"]+)['"]?\s*$/m);
  return m ? m[1].trim() : null;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function getRemoteObjectBody(key) {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!out.Body) return null;
    return await streamToString(out.Body);
  } catch (e) {
    const code = e?.name ?? e?.Code ?? '';
    const status = e?.$metadata?.httpStatusCode;
    if (code === 'NoSuchKey' || code === 'NotFound' || status === 404) {
      return null;
    }
    throw e;
  }
}

const skip = new Set(['.DS_Store']);

const entries = await fs.readdir(RELEASE_DIR, { withFileTypes: true }).catch(() => null);
if (!entries) {
  echo(chalk.red`Release directory missing: ${RELEASE_DIR}`);
  process.exit(1);
}

const files = entries.filter((e) => e.isFile()).map((e) => e.name);

const pkgRaw = await fs.readFile(path.join(ROOT_DIR, 'package.json'), 'utf8');
const pkg = JSON.parse(pkgRaw);
const appVersion = String(pkg.version ?? '').trim();
const channel = detectUpdateChannel(appVersion);
const feedNames = listGenericProviderUpdateYmlNames(channel);

// Upload only files belonging to current version + current channel feeds.
// This avoids stale artifacts (e.g. old dmg) in release/ being re-uploaded.
const uploadCandidates = files.filter((name) => {
  if (skip.has(name)) return false;
  if (name.startsWith('builder-')) return false;
  if (feedNames.includes(name)) return true;
  return name.includes(`-${appVersion}-`);
});

if (uploadCandidates.length === 0) {
  echo(chalk.yellow`No current-version files to upload (check ${RELEASE_DIR} and package.json version).`);
  process.exit(1);
}

if (!forceUpload && prefix === channel) {
  const toCheck = feedNames.filter((n) => uploadCandidates.includes(n));

  if (toCheck.length > 0) {
    let skipAll = true;
    const reasons = [];

    for (const name of toCheck) {
      const filePath = path.join(RELEASE_DIR, name);
      const localText = await fs.readFile(filePath, 'utf8');
      const localVer = parseVersionFromYml(localText);
      const key = `${prefix}/${name}`;

      if (!localVer) {
        skipAll = false;
        reasons.push(`${name}: no version: in local file`);
        break;
      }

      if (localVer !== appVersion) {
        skipAll = false;
        reasons.push(`${name}: local yml version ${localVer} ≠ package.json ${appVersion}`);
        break;
      }

      let remoteText;
      try {
        remoteText = await getRemoteObjectBody(key);
      } catch (e) {
        echo(chalk.red`Failed to read OSS ${key}: ${e?.message ?? e}`);
        process.exit(1);
      }

      if (remoteText == null) {
        skipAll = false;
        reasons.push(`${name}: missing on OSS`);
        break;
      }

      const remoteVer = parseVersionFromYml(remoteText);
      if (!remoteVer) {
        skipAll = false;
        reasons.push(`${name}: remote has no parseable version:`);
        break;
      }

      if (localVer !== remoteVer) {
        skipAll = false;
        reasons.push(`${name}: OSS feed version ${remoteVer} ≠ ${localVer}`);
        break;
      }
    }

    if (skipAll) {
      echo(
        chalk.yellow`Skip upload: generic feed YAML(s) for channel "${channel}" already on OSS at same version as package.json (${appVersion}). Matches electron-updater GET + version compare (no newer feed).`,
      );
      echo(chalk.dim`  Checked: ${toCheck.join(', ')}`);
      echo(chalk.dim`  Override: --force or OSS_UPLOAD_FORCE=1`);
      process.exit(0);
    }

    echo(chalk.blue`Upload needed (${reasons.join('; ')}).`);
  }
} else if (!forceUpload && prefix !== channel) {
  echo(
    chalk.yellow`Skip check disabled: OSS prefix "${prefix}" ≠ package.json channel "${channel}" (version ${appVersion}). Uploading all files.`,
  );
}

let uploaded = 0;

for (const name of uploadCandidates) {
  const filePath = path.join(RELEASE_DIR, name);
  const key = `${prefix}/${name}`;
  const st = await fs.stat(filePath);
  const ct = contentTypeFor(name);

  // Aliyun OSS / network can drop long uploads; use multipart for large artifacts.
  if (st.size >= 64 * 1024 * 1024) {
    await uploadLargeObjectMultipart({
      bucket,
      key,
      filePath,
      contentType: ct,
      size: st.size,
    });
  } else {
    await uploadSmallObject({ bucket, key, filePath, contentType: ct });
  }
  echo(chalk.green`↑ ${key}`);
  uploaded++;
}

echo(chalk.cyan`\n✅ Uploaded ${uploaded} file(s) to s3://${bucket}/${prefix}/`);
