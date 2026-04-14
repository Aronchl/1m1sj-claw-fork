/** Official community / marketing site (replaces legacy claw-x.com). */
export const OFFICIAL_SITE_URL = 'https://claw.1m1sj.xin/';
export const LEGACY_CLAW_X_HOST = 'claw-x.com';

export function resolveOfficialSiteUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === LEGACY_CLAW_X_HOST || u.hostname.endsWith(`.${LEGACY_CLAW_X_HOST}`)) {
      u.hostname = new URL(OFFICIAL_SITE_URL).hostname;
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}
