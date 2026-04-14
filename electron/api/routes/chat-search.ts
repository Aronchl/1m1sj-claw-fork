import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { sendJson } from '../route-utils';
import { searchChatTranscripts, type ChatSearchTab } from '../../utils/chat-transcript-search';

function parseTab(raw: string | null): ChatSearchTab {
  const v = (raw || 'all').toLowerCase();
  if (v === 'agent' || v === 'chat' || v === 'cron' || v === 'all') return v;
  return 'all';
}

export async function handleChatSearchRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/chat/search' && req.method === 'GET') {
    const q = url.searchParams.get('q')?.trim() || '';
    const tab = parseTab(url.searchParams.get('tab'));
    const rawLimit = Number(url.searchParams.get('limit') || '60');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 60;

    try {
      const hits = await searchChatTranscripts(q, tab, limit, ctx.gatewayManager);
      sendJson(res, 200, { success: true, hits });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error), hits: [] });
    }
    return true;
  }

  return false;
}
