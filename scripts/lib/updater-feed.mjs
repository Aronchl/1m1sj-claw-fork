/**
 * Shared with electron-updater generic provider naming (must stay in sync with electron/main/updater.ts).
 * @see node_modules/electron-updater/out/providers/Provider.js — getChannelFilePrefix + getChannelFilename → `${channel}.yml`
 */

/**
 * Same logic as AppUpdater: semver prerelease tag → feed channel directory & autoUpdater.channel.
 * e.g. "0.1.8-alpha.0" → "alpha", "1.0.0-beta.1" → "beta", "1.0.0" → "latest"
 */
export function detectUpdateChannel(version) {
  const match = String(version).match(/-([a-zA-Z]+)/);
  return match ? match[1] : 'latest';
}

/**
 * Filenames GenericProvider requests (one per OS/arch the app might run on).
 * Windows: {channel}.yml — no platform suffix (historical).
 * macOS: {channel}-mac.yml
 * Linux x64: {channel}-linux.yml — arch suffix only when not x64
 * Linux arm64: {channel}-linux-arm64.yml
 */
export function listGenericProviderUpdateYmlNames(channel) {
  const c = String(channel);
  return [`${c}.yml`, `${c}-mac.yml`, `${c}-linux.yml`, `${c}-linux-arm64.yml`];
}
