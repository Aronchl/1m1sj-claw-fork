import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatSession } from './chat/types';

export function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

/** True when this session has activity newer than the read watermark and is not the active chat view. */
export function isSessionUnread(
  sessionKey: string,
  sessionLastActivity: Record<string, number>,
  sessionReadWatermark: Record<string, number>,
  currentSessionKey: string,
  isOnChat: boolean,
): boolean {
  const act = sessionLastActivity[sessionKey] ?? 0;
  const wm = sessionReadWatermark[sessionKey] ?? 0;
  if (act <= wm) return false;
  if (isOnChat && sessionKey === currentSessionKey) return false;
  return true;
}

/** Sessions under this agent whose activity is above the per-session watermark and not the active chat view. */
export function countUnreadSessionsUnderAgent(
  agentId: string,
  sessions: Pick<ChatSession, 'key'>[],
  sessionLastActivity: Record<string, number>,
  sessionReadWatermark: Record<string, number>,
  currentSessionKey: string,
  isOnChat: boolean,
): number {
  return sessions.filter((s) => {
    if (getAgentIdFromSessionKey(s.key) !== agentId) return false;
    return isSessionUnread(s.key, sessionLastActivity, sessionReadWatermark, currentSessionKey, isOnChat);
  }).length;
}

interface SidebarUnreadState {
  /** Legacy: only used when seeding a new session key (migration from per-agent watermarks). */
  agentReadWatermark: Record<string, number>;
  sessionReadWatermark: Record<string, number>;
  seedSessionWatermarkIfMissing: (sessionKey: string, suggestedMax: number, agentId: string) => void;
  bumpSessionReadAtLeast: (sessionKey: string, atLeast: number) => void;
}

export const useSidebarUnreadStore = create<SidebarUnreadState>()(
  persist(
    (set) => ({
      agentReadWatermark: {},
      sessionReadWatermark: {},
      seedSessionWatermarkIfMissing: (sessionKey, suggestedMax, agentId) => {
        set((s) => {
          if (s.sessionReadWatermark[sessionKey] !== undefined) return s;
          const legacy = s.agentReadWatermark[agentId] ?? 0;
          const initial = Math.max(suggestedMax, legacy);
          return {
            sessionReadWatermark: {
              ...s.sessionReadWatermark,
              [sessionKey]: initial,
            },
          };
        });
      },
      bumpSessionReadAtLeast: (sessionKey, atLeast) => {
        set((s) => {
          const cur = s.sessionReadWatermark[sessionKey] ?? 0;
          if (atLeast <= cur) return s;
          return {
            sessionReadWatermark: {
              ...s.sessionReadWatermark,
              [sessionKey]: atLeast,
            },
          };
        });
      },
    }),
    {
      name: 'clawx-sidebar-unread',
      partialize: (state) => ({
        agentReadWatermark: state.agentReadWatermark,
        sessionReadWatermark: state.sessionReadWatermark,
      }),
    },
  ),
);
