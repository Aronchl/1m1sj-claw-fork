import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../route-utils';
import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { renderQrDataUrlFromText } from '../../utils/wechat-login';
import { getSetting, setSetting } from '../../utils/store';
import { resolveDesktopAuthAppId, resolveDesktopAuthBaseUrl } from '../../utils/desktop-auth-config';

type DesktopAuthApiResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
};

type CreateTicketData = {
  ticket?: string;
  expires_in?: number;
  qrcode_url?: string;
};

type PollData = {
  status?:
    | 'pending'
    | 'opened'
    | 'authorized'
    | 'cancelled'
    | 'confirmed'
    | 'expired'
    | 'consumed';
  token?: string;
  user_id?: number | string;
};

type VerifyTokenData = {
  user_id?: number | string;
  nickName?: string;
  avatarUrl?: string;
};

type DesktopAuthSession = {
  token: string;
  userId: string;
  nickName: string;
  avatarUrl: string;
};

async function callDesktopAuth<T>(
  endpoint: 'createTicket' | 'poll' | 'verifyToken' | 'logout' | 'cancel',
  payload: Record<string, string>,
): Promise<DesktopAuthApiResponse<T>> {
  const baseUrl = resolveDesktopAuthBaseUrl();
  const body = new URLSearchParams(payload);
  // Compatibility: some backend deployments only parse app_id from query string.
  // Keep existing form body behavior, but mirror app_id in URL to avoid false
  // "missing appid" errors on desktop-auth endpoints.
  const url = new URL(`/api/user.desktopauth/${endpoint}`, `${baseUrl}/`);
  const appId = payload.app_id?.trim();
  if (appId) {
    url.searchParams.set('app_id', appId);
  }
  const response = await proxyAwareFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await response.text();
  let parsed: DesktopAuthApiResponse<T>;
  try {
    parsed = JSON.parse(text) as DesktopAuthApiResponse<T>;
  } catch {
    throw new Error(`Desktop auth ${endpoint} returned non-JSON: ${text}`);
  }

  if (!response.ok) {
    throw new Error(parsed.msg || `Desktop auth ${endpoint} failed: HTTP ${response.status}`);
  }
  return parsed;
}

async function readDesktopAuthSession(): Promise<DesktopAuthSession> {
  const [token, userId, nickName, avatarUrl] = await Promise.all([
    getSetting('desktopAuthToken'),
    getSetting('desktopAuthUserId'),
    getSetting('desktopAuthNickName'),
    getSetting('desktopAuthAvatarUrl'),
  ]);
  return { token, userId, nickName, avatarUrl };
}

async function writeDesktopAuthSession(patch: Partial<DesktopAuthSession>): Promise<void> {
  const tasks: Array<Promise<void>> = [];
  if (Object.prototype.hasOwnProperty.call(patch, 'token')) {
    tasks.push(setSetting('desktopAuthToken', patch.token ?? ''));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'userId')) {
    tasks.push(setSetting('desktopAuthUserId', patch.userId ?? ''));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'nickName')) {
    tasks.push(setSetting('desktopAuthNickName', patch.nickName ?? ''));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'avatarUrl')) {
    tasks.push(setSetting('desktopAuthAvatarUrl', patch.avatarUrl ?? ''));
  }
  await Promise.all(tasks);
}

async function clearDesktopAuthSession(): Promise<void> {
  await Promise.all([
    setSetting('desktopAuthToken', ''),
    setSetting('desktopAuthUserId', ''),
    setSetting('desktopAuthNickName', ''),
    setSetting('desktopAuthAvatarUrl', ''),
  ]);
}

export async function handleDesktopAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname === '/api/desktop-auth/create-ticket' && req.method === 'POST') {
    try {
      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<CreateTicketData>('createTicket', {
        app_id: appId,
      });
      if (result.code !== 1 || !result.data?.ticket || !result.data?.qrcode_url) {
        sendJson(res, 400, { success: false, error: result.msg || 'Failed to create login ticket' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        ticket: result.data.ticket,
        expiresIn: result.data.expires_in ?? 300,
        qrcodeUrl: await renderQrDataUrlFromText(result.data.qrcode_url, { scale: 6, marginModules: 4 }),
        qrcodeRawUrl: result.data.qrcode_url,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/poll' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ ticket?: string }>(req);
      const ticket = body.ticket?.trim() || '';
      if (!ticket) {
        sendJson(res, 400, { success: false, error: 'ticket is required' });
        return true;
      }

      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<PollData>('poll', {
        app_id: appId,
        ticket,
      });

      if (result.code !== 1) {
        sendJson(res, 200, {
          success: true,
          status: 'error',
          message: result.msg || 'Polling failed',
        });
        return true;
      }

      sendJson(res, 200, {
        success: true,
        status: result.data?.status || 'pending',
        token: result.data?.token,
        userId: result.data?.user_id,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session' && req.method === 'GET') {
    try {
      const session = await readDesktopAuthSession();
      sendJson(res, 200, {
        success: true,
        loggedIn: Boolean(session.token),
        tokenExists: Boolean(session.token),
        userId: session.userId || undefined,
        nickName: session.nickName || undefined,
        avatarUrl: session.avatarUrl || undefined,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session/save' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        token?: string;
        userId?: string | number;
        nickName?: string;
        avatarUrl?: string;
      }>(req);
      const token = body.token?.trim() || '';
      if (!token) {
        sendJson(res, 400, { success: false, error: 'token is required' });
        return true;
      }
      await writeDesktopAuthSession({
        token,
        userId: body.userId != null ? String(body.userId) : '',
        nickName: body.nickName?.trim() || '',
        avatarUrl: body.avatarUrl?.trim() || '',
      });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session/clear' && req.method === 'POST') {
    try {
      await clearDesktopAuthSession();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session/logout' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ token?: string }>(req);
      const current = await readDesktopAuthSession();
      const token = body.token?.trim() || current.token;
      if (!token) {
        await clearDesktopAuthSession();
        sendJson(res, 200, { success: true, loggedIn: false });
        return true;
      }
      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<Record<string, never>>('logout', {
        app_id: appId,
        token,
      });
      if (result.code !== 1) {
        sendJson(res, 502, { success: false, error: result.msg || 'Failed to revoke token' });
        return true;
      }
      await clearDesktopAuthSession();
      sendJson(res, 200, { success: true, loggedIn: false });
    } catch (error) {
      const message = String(error);
      // Backward compatibility: some backends do not implement user.desktopauth/logout yet.
      // In that case we still clear local session to complete sign-out on desktop.
      if (
        message.includes('Desktop auth logout returned non-JSON')
        || message.includes('method not exists')
        || message.includes('Desktopauth-&gt;logout')
      ) {
        await clearDesktopAuthSession();
        sendJson(res, 200, {
          success: true,
          loggedIn: false,
          remoteRevoked: false,
          warning: 'Remote logout endpoint is not available; local session cleared only',
        });
        return true;
      }
      sendJson(res, 500, { success: false, error: message });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session/cancel-ticket' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ ticket?: string }>(req);
      const ticket = body.ticket?.trim() || '';
      if (!ticket) {
        sendJson(res, 400, { success: false, error: 'ticket is required' });
        return true;
      }
      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<Record<string, never>>('cancel', {
        app_id: appId,
        ticket,
      });
      if (result.code !== 1) {
        sendJson(res, 502, { success: false, error: result.msg || 'Failed to cancel ticket' });
        return true;
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/session/verify' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ token?: string }>(req);
      const incomingToken = body.token?.trim() || '';
      const current = await readDesktopAuthSession();
      const token = incomingToken || current.token;
      if (!token) {
        await clearDesktopAuthSession();
        sendJson(res, 200, { success: true, loggedIn: false });
        return true;
      }
      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<VerifyTokenData>('verifyToken', {
        app_id: appId,
        token,
      });
      if (result.code !== 1) {
        await clearDesktopAuthSession();
        sendJson(res, 401, { success: false, loggedIn: false, error: result.msg || 'Token is invalid' });
        return true;
      }
      const nextUserId = result.data?.user_id != null ? String(result.data.user_id) : '';
      const nextNickName = result.data?.nickName?.trim() || '';
      const nextAvatarUrl = result.data?.avatarUrl?.trim() || '';
      await writeDesktopAuthSession({
        token,
        userId: nextUserId,
        nickName: nextNickName,
        avatarUrl: nextAvatarUrl,
      });
      sendJson(res, 200, {
        success: true,
        loggedIn: true,
        tokenExists: true,
        userId: nextUserId || undefined,
        nickName: nextNickName || undefined,
        avatarUrl: nextAvatarUrl || undefined,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/desktop-auth/verify-token' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ token?: string }>(req);
      const token = body.token?.trim() || '';
      if (!token) {
        sendJson(res, 400, { success: false, error: 'token is required' });
        return true;
      }

      const appId = resolveDesktopAuthAppId();
      const result = await callDesktopAuth<VerifyTokenData>('verifyToken', {
        app_id: appId,
        token,
      });
      if (result.code !== 1) {
        sendJson(res, 401, { success: false, error: result.msg || 'Token is invalid' });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        userId: result.data?.user_id,
        nickName: result.data?.nickName,
        avatarUrl: result.data?.avatarUrl,
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
