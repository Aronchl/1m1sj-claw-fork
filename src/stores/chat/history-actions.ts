import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { applyLoadedMessages } from './apply-loaded-history';
import {
  enrichWithCachedImages,
  enrichWithToolResultFiles,
  loadMissingPreviews,
} from './helpers';
import { buildCronSessionHistoryPath, isCronSessionKey } from './cron-session-utils';
import type { RawMessage } from './types';
import type { ChatGet, ChatSet, SessionHistoryActions } from './store-api';

async function loadCronFallbackMessages(sessionKey: string, limit = 200): Promise<RawMessage[]> {
  if (!isCronSessionKey(sessionKey)) return [];
  try {
    const response = await hostApiFetch<{ messages?: RawMessage[] }>(
      buildCronSessionHistoryPath(sessionKey, limit),
    );
    return Array.isArray(response.messages) ? response.messages : [];
  } catch (error) {
    console.warn('Failed to load cron fallback history:', error);
    return [];
  }
}

const enrichers = {
  enrichWithToolResultFiles,
  enrichWithCachedImages,
  loadMissingPreviews,
};

export function createHistoryActions(
  set: ChatSet,
  get: ChatGet,
): Pick<SessionHistoryActions, 'loadHistory'> {
  return {
    loadHistory: async (quiet = false) => {
      const { currentSessionKey } = get();
      if (!quiet) set({ loading: true, error: null });

      const applyHistory = (rawMessages: RawMessage[], thinkingLevel: string | null) => {
        applyLoadedMessages(set, get, currentSessionKey, rawMessages, thinkingLevel, enrichers);
      };

      try {
        const result = await invokeIpc(
          'gateway:rpc',
          'chat.history',
          { sessionKey: currentSessionKey, limit: 200 }
        ) as { success: boolean; result?: Record<string, unknown>; error?: string };

        if (result.success && result.result) {
          const data = result.result;
          let rawMessages = Array.isArray(data.messages) ? data.messages as RawMessage[] : [];
          const thinkingLevel = data.thinkingLevel ? String(data.thinkingLevel) : null;
          if (rawMessages.length === 0 && isCronSessionKey(currentSessionKey)) {
            rawMessages = await loadCronFallbackMessages(currentSessionKey, 200);
          }
          applyHistory(rawMessages, thinkingLevel);
        } else {
          const fallbackMessages = await loadCronFallbackMessages(currentSessionKey, 200);
          if (fallbackMessages.length > 0) {
            applyHistory(fallbackMessages, null);
          } else {
            set({ messages: [], loading: false });
          }
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
        const fallbackMessages = await loadCronFallbackMessages(currentSessionKey, 200);
        if (fallbackMessages.length > 0) {
          applyHistory(fallbackMessages, null);
        } else {
          set({ messages: [], loading: false });
        }
      }
    },
  };
}
