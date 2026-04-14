/**
 * Single implementation for applying gateway/cron history into chat state.
 * Enrich/preview helpers are injected: production (`chat.ts`) uses implementations
 * bound to local image cache; tests use `./helpers`.
 */
import { useSidebarUnreadStore } from '../sidebar-unread';
import { isCronSessionKey } from './cron-session-utils';
import {
  clearHistoryPoll,
  dedupeConsecutiveDuplicateAssistants,
  getMessageText,
  hasNonToolAssistantContent,
  isInternalMessage,
  isToolResultRole,
  toMs,
} from './helpers';
import type { RawMessage } from './types';
import type { ChatGet, ChatSet } from './store-api';

export type ApplyLoadedHistoryEnrichers = {
  enrichWithToolResultFiles: (messages: RawMessage[]) => RawMessage[];
  enrichWithCachedImages: (messages: RawMessage[]) => RawMessage[];
  loadMissingPreviews: (messages: RawMessage[]) => Promise<boolean>;
};

export function applyLoadedMessages(
  set: ChatSet,
  get: ChatGet,
  currentSessionKey: string,
  rawMessages: RawMessage[],
  thinkingLevel: string | null,
  enrichers: ApplyLoadedHistoryEnrichers,
): void {
  const { enrichWithToolResultFiles, enrichWithCachedImages, loadMissingPreviews } = enrichers;
  if (get().currentSessionKey !== currentSessionKey) return;

  const messagesWithToolImages = enrichWithToolResultFiles(rawMessages);
  const cronSession = isCronSessionKey(currentSessionKey);
  const filteredMessages = messagesWithToolImages.filter((msg) => {
    if (isToolResultRole(msg.role)) return false;
    if (cronSession && msg.role === 'system') return true;
    return !isInternalMessage(msg);
  });
  const enrichedMessages = enrichWithCachedImages(filteredMessages);

  let finalMessages = enrichedMessages;
  const userMsgAt = get().lastUserMessageAt;
  if (get().sending && userMsgAt) {
    const userMsMs = toMs(userMsgAt);
    const hasRecentUser = enrichedMessages.some(
      (m) => m.role === 'user' && m.timestamp && Math.abs(toMs(m.timestamp) - userMsMs) < 5000,
    );
    if (!hasRecentUser) {
      const currentMsgs = get().messages;
      const optimistic = [...currentMsgs].reverse().find(
        (m) => m.role === 'user' && m.timestamp && Math.abs(toMs(m.timestamp) - userMsMs) < 5000,
      );
      if (optimistic) {
        finalMessages = [...enrichedMessages, optimistic];
      }
    }
  }

  finalMessages = dedupeConsecutiveDuplicateAssistants(finalMessages);

  const prevMsgs = get().messages;
  const prevLast = prevMsgs[prevMsgs.length - 1];
  if (
    prevLast?.role === 'assistant' &&
    typeof prevLast._rowKey === 'string' &&
    prevLast._rowKey.length > 0 &&
    finalMessages.length > 0
  ) {
    const newLast = finalMessages[finalMessages.length - 1];
    if (newLast?.role === 'assistant') {
      const a = getMessageText(prevLast.content).trim();
      const b = getMessageText(newLast.content).trim();
      if (
        a.length > 0 &&
        a === b &&
        String(newLast.id ?? '') !== String(prevLast.id ?? '')
      ) {
        finalMessages = [
          ...finalMessages.slice(0, -1),
          { ...newLast, _rowKey: prevLast._rowKey },
        ];
      }
    }
  }

  set({ messages: finalMessages, thinkingLevel, loading: false });

  const isMainSession = currentSessionKey.endsWith(':main');
  if (!isMainSession) {
    const firstUserMsg = finalMessages.find((m) => m.role === 'user');
    if (firstUserMsg) {
      const labelText = getMessageText(firstUserMsg.content).trim();
      if (labelText) {
        const truncated = labelText.length > 50 ? `${labelText.slice(0, 50)}…` : labelText;
        set((s) => ({
          sessionLabels: { ...s.sessionLabels, [currentSessionKey]: truncated },
        }));
      }
    } else if (cronSession) {
      const meta = finalMessages.find((m) => m.role === 'system');
      if (meta) {
        const raw = getMessageText(meta.content).trim();
        const firstLine = raw.split('\n')[0]?.trim() ?? '';
        const stripped = firstLine.replace(/^Scheduled task:\s*/i, '').trim() || firstLine;
        if (stripped) {
          const truncated = stripped.length > 50 ? `${stripped.slice(0, 50)}…` : stripped;
          set((s) => ({
            sessionLabels: { ...s.sessionLabels, [currentSessionKey]: truncated },
          }));
        }
      }
    }
  }

  const lastMsg = finalMessages[finalMessages.length - 1];
  if (lastMsg?.timestamp) {
    const lastAt = toMs(lastMsg.timestamp);
    set((s) => ({
      sessionLastActivity: { ...s.sessionLastActivity, [currentSessionKey]: lastAt },
      sessionReadAt: { ...s.sessionReadAt, [currentSessionKey]: lastAt },
    }));
    useSidebarUnreadStore.getState().bumpSessionReadAtLeast(currentSessionKey, lastAt);
  }

  loadMissingPreviews(finalMessages).then((updated) => {
    if (updated) {
      set({
        messages: finalMessages.map(msg =>
          msg._attachedFiles
            ? { ...msg, _attachedFiles: msg._attachedFiles.map(f => ({ ...f })) }
            : msg
        ),
      });
    }
  });

  const { pendingFinal, lastUserMessageAt, sending: isSendingNow } = get();
  const userMsTs = lastUserMessageAt ? toMs(lastUserMessageAt) : 0;
  const isAfterUserMsg = (msg: RawMessage): boolean => {
    if (!userMsTs || !msg.timestamp) return true;
    return toMs(msg.timestamp) >= userMsTs;
  };

  if (isSendingNow && !pendingFinal) {
    const hasRecentAssistantActivity = [...filteredMessages].reverse().some((msg) => {
      if (msg.role !== 'assistant') return false;
      return isAfterUserMsg(msg);
    });
    if (hasRecentAssistantActivity) {
      set({ pendingFinal: true });
    }
  }

  if (pendingFinal || get().pendingFinal) {
    const recentAssistant = [...filteredMessages].reverse().find((msg) => {
      if (msg.role !== 'assistant') return false;
      if (!hasNonToolAssistantContent(msg)) return false;
      return isAfterUserMsg(msg);
    });
    if (recentAssistant) {
      clearHistoryPoll();
      set({ sending: false, activeRunId: null, pendingFinal: false });
    }
  }
}
