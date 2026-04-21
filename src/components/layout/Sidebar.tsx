/**
 * Sidebar: narrow rail + optional chat expansion panel (matches product design).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingsUiStore } from '@/stores/settings-ui';
import {
  Settings as SettingsIcon,
  Trash2,
  MessageCircle,
  Sparkles,
  Sprout,
  AlarmClock,
  Smartphone,
  CircleHelp,
  Search,
  MessageSquare,
  ChevronDown,
  Bot,
  MessageSquarePlus,
  MoreHorizontal,
} from 'lucide-react';
import { isCronSessionKey, parseCronSessionKey } from '@/stores/chat/cron-session-utils';
import { useCronStore } from '@/stores/cron';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { AgentSummary } from '@/types/agent';
import { AgentAvatarBubble } from '@/components/agent/AgentAvatarBubble';
import logoSvg from '@/assets/logo.svg';
import { ChatSearchModal } from '@/components/chat/ChatSearchModal';
import { AgentSessionsHistorySheet } from '@/components/layout/AgentSessionsHistorySheet';
import { useShellUiStore } from '@/stores/shell-ui';
import {
  countUnreadSessionsUnderAgent,
  isSessionUnread,
  useSidebarUnreadStore,
} from '@/stores/sidebar-unread';

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

type RailItemId = 'chat' | 'inspiration' | 'growth' | 'tasks';

/** First paint: show this many sessions per agent; first footer click expands in-sidebar. */
const SIDEBAR_AGENT_SESSIONS_INITIAL = 3;

function RailNavButton({
  id,
  active,
  icon,
  label,
  onClick,
}: {
  id: RailItemId;
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`sidebar-rail-${id}`}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-black/[0.08] text-foreground dark:bg-white/10'
          : 'text-foreground/55 hover:bg-black/[0.05] hover:text-foreground/80 dark:hover:bg-white/5',
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center [&_svg]:h-[22px] [&_svg]:w-[22px]">{icon}</span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

export function Sidebar() {
  const openSettingsModal = useSettingsUiStore((s) => s.openModal);
  const settingsModalOpen = useSettingsUiStore((s) => s.open);
  const openFeedbackModal = useShellUiStore((s) => s.openFeedbackModal);
  const openWechatConnectModal = useShellUiStore((s) => s.openWechatConnectModal);

  const sessions = useChatStore((s) => s.sessions);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadHistory = useChatStore((s) => s.loadHistory);

  const sessionReadWatermark = useSidebarUnreadStore((s) => s.sessionReadWatermark);
  const seedSessionWatermarkIfMissing = useSidebarUnreadStore((s) => s.seedSessionWatermarkIfMissing);
  const bumpSessionReadAtLeast = useSidebarUnreadStore((s) => s.bumpSessionReadAtLeast);

  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    const hasExistingMessages = useChatStore.getState().messages.length > 0;
    (async () => {
      await loadSessions();
      if (cancelled) return;
      await loadHistory(hasExistingMessages);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGatewayRunning, loadHistory, loadSessions]);

  const agents = useAgentsStore((s) => s.agents);
  const defaultAgentId = useAgentsStore((s) => s.defaultAgentId);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);

  const cronJobs = useCronStore((s) => s.jobs);
  const fetchCronJobs = useCronStore((s) => s.fetchJobs);
  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeCronJobs = Array.isArray(cronJobs) ? cronJobs : [];

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOnChat = pathname === '/';

  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ key: string; label: string } | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentSummary | null>(null);
  /**
   * Accordion: only one agent's session list open.
   * - `default`: follow current agent (see resolvedExpandedAgentId)
   * - `string`: that agent expanded
   * - `null`: user collapsed all
   */
  const [expandMode, setExpandMode] = useState<'default' | string | null>('default');
  /** After first "load more", sidebar lists all sessions for that agent; next action opens sheet. */
  const [agentSessionListExpanded, setAgentSessionListExpanded] = useState<Record<string, boolean>>({});
  const [sessionHistorySheetAgentId, setSessionHistorySheetAgentId] = useState<string | null>(null);

  /** Collapse per-agent session list + close history sheet when active agent changes. */
  useEffect(() => {
    let prevAgentId = useChatStore.getState().currentAgentId;
    const unsub = useChatStore.subscribe((state) => {
      const next = state.currentAgentId;
      if (next !== prevAgentId) {
        prevAgentId = next;
        setExpandMode('default');
        setAgentSessionListExpanded({});
        setSessionHistorySheetAgentId(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!isOnChat || !isGatewayRunning) return;
    void fetchCronJobs();
  }, [isOnChat, isGatewayRunning, fetchCronJobs]);

  const { t } = useTranslation('common');
  const { t: tAgents } = useTranslation('agents');

  const cronTitleByJobId = useMemo(
    () => Object.fromEntries(safeCronJobs.map((j) => [j.id, j.name?.trim() || ''])),
    [safeCronJobs],
  );

  const getSessionLabel = (key: string, displayName?: string, label?: string) => {
    const parsed = parseCronSessionKey(key);
    if (parsed) {
      const taskTitle = cronTitleByJobId[parsed.jobId];
      if (taskTitle) return taskTitle;
    }
    return sessionLabels[key] ?? label ?? displayName ?? key;
  };

  const agentNameById = useMemo(
    () => Object.fromEntries(safeAgents.map((agent) => [agent.id, agent.name])),
    [safeAgents],
  );

  const getAgentDisplay = useMemo(() => {
    return (agentId: string) => {
      const a = safeAgents.find((x) => x.id === agentId);
      if (a) {
        const subtitle = a.modelDisplay || a.workspace.split(/[/\\]/).filter(Boolean).pop() || '';
        return { name: a.name, subtitle };
      }
      return { name: agentNameById[agentId] || agentId, subtitle: '' };
    };
  }, [safeAgents, agentNameById]);

  const orderedAgentIds = useMemo(() => {
    const fromStore = [...safeAgents]
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((a) => a.id);
    const seen = new Set(fromStore);
    const fromSessions = [...new Set(sessions.map((s) => getAgentIdFromSessionKey(s.key)))].filter(
      (id) => !seen.has(id),
    );
    fromSessions.sort();
    const merged = [...fromStore, ...fromSessions];
    const fallback = defaultAgentId || 'main';
    if (!merged.includes(fallback)) {
      merged.unshift(fallback);
    }
    return merged;
  }, [safeAgents, sessions, defaultAgentId]);

  const sessionsForAgent = (agentId: string) => {
    const filtered = sessions.filter((s) => getAgentIdFromSessionKey(s.key) === agentId);
    return filtered.sort((a, b) => {
      const unreadA = isSessionUnread(
        a.key,
        sessionLastActivity,
        sessionReadWatermark,
        currentSessionKey,
        isOnChat,
      );
      const unreadB = isSessionUnread(
        b.key,
        sessionLastActivity,
        sessionReadWatermark,
        currentSessionKey,
        isOnChat,
      );
      if (unreadA !== unreadB) return unreadA ? -1 : 1;
      return (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0);
    });
  };

  const visibleAgentIds = orderedAgentIds;

  useEffect(() => {
    for (const agentId of visibleAgentIds) {
      const { sessions: sess, sessionLastActivity: activity } = useChatStore.getState();
      for (const s of sess) {
        if (getAgentIdFromSessionKey(s.key) !== agentId) continue;
        seedSessionWatermarkIfMissing(s.key, activity[s.key] ?? 0, agentId);
      }
    }
  }, [visibleAgentIds, sessions, sessionLastActivity, seedSessionWatermarkIfMissing]);

  const resolvedExpandedAgentId = useMemo(() => {
    if (expandMode === 'default') {
      if (visibleAgentIds.length === 0) return null;
      return visibleAgentIds.includes(currentAgentId) ? currentAgentId : visibleAgentIds[0];
    }
    return expandMode;
  }, [expandMode, visibleAgentIds, currentAgentId]);

  const toggleAgentCollapsed = (agentId: string) => {
    useChatChromeStore.getState().setAgentPanelSubjectAgentId(agentId);
    if (resolvedExpandedAgentId === agentId) {
      setExpandMode(null);
      return;
    }
    setExpandMode(agentId);
    setAgentSessionListExpanded((exp) => {
      const v = exp[agentId];
      return v === undefined ? {} : { [agentId]: v };
    });
  };

  return (
    <aside
      data-testid="sidebar"
      className="flex h-full min-h-0 shrink-0 border-r border-black/[0.06] bg-[#f7f7f7] dark:border-border dark:bg-background"
    >
      {/* Left rail */}
      <div className="flex w-[72px] shrink-0 flex-col items-center border-r border-black/[0.06] bg-[#f7f7f7] py-3 dark:border-border dark:bg-background">
        <button
          type="button"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg transition-opacity hover:opacity-90"
          onClick={() => {
            navigate('/');
          }}
          aria-label={t('common:sidebar.brand')}
        >
          <img src={logoSvg} alt="" className="h-7 w-7 object-contain" />
        </button>

        <nav className="flex w-full flex-1 flex-col gap-1 px-1.5">
          <RailNavButton
            id="chat"
            active={isOnChat}
            label={t('common:sidebar.railChat')}
            icon={<MessageCircle className="text-foreground" strokeWidth={1.75} />}
            onClick={() => navigate('/')}
          />
          <RailNavButton
            id="inspiration"
            active={pathname === '/inspiration'}
            label={t('common:sidebar.railInspiration')}
            icon={<Sparkles className="text-foreground" strokeWidth={1.75} />}
            onClick={() => navigate('/inspiration')}
          />
          <RailNavButton
            id="growth"
            active={pathname === '/growth'}
            label={t('common:sidebar.railGrowth')}
            icon={<Sprout className="text-foreground" strokeWidth={1.75} />}
            onClick={() => navigate('/growth')}
          />
          <RailNavButton
            id="tasks"
            active={pathname === '/tasks'}
            label={t('common:sidebar.railTasks')}
            icon={<AlarmClock className="text-foreground" strokeWidth={1.75} />}
            onClick={() => navigate('/tasks')}
          />
        </nav>

        <div className="mt-auto flex flex-col gap-1 px-1.5 pb-1">
          <button
            type="button"
            data-testid="sidebar-rail-help"
            onClick={() => openFeedbackModal()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/45 transition-colors hover:bg-black/[0.06] hover:text-foreground/70 dark:hover:bg-white/10"
            title={t('common:sidebar.railHelp')}
          >
            <CircleHelp className="h-[20px] w-[20px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="sidebar-rail-mobile"
            onClick={() => openWechatConnectModal()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/45 transition-colors hover:bg-black/[0.06] hover:text-foreground/70 dark:hover:bg-white/10"
            title={t('common:sidebar.railMobile')}
          >
            <Smartphone className="h-[20px] w-[20px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            data-testid="sidebar-nav-settings"
            onClick={() => openSettingsModal('general')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              settingsModalOpen
                ? 'bg-black/[0.08] text-foreground dark:bg-white/10'
                : 'text-foreground/45 hover:bg-black/[0.06] hover:text-foreground/70 dark:hover:bg-white/10',
            )}
            title={t('common:sidebar.settings')}
          >
            <SettingsIcon className="h-[20px] w-[20px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Chat expansion panel */}
      {isOnChat && (
        <div
          data-testid="sidebar-chat-panel"
          className="flex w-[272px] shrink-0 flex-col overflow-hidden border-r border-black/[0.06] bg-white dark:border-border dark:bg-card"
        >
          <div className="flex items-center gap-2 p-3 pb-2">
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                data-testid="sidebar-chat-search-open"
                onClick={() => setChatSearchOpen(true)}
                className="flex h-10 w-full items-center gap-2 rounded-full border border-transparent bg-black/[0.03] pl-9 pr-3 text-left text-[13px] text-muted-foreground transition-colors hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <span className="truncate">{t('common:sidebar.chatSearchPlaceholder')}</span>
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              data-testid="sidebar-new-agent"
              title={t('common:sidebar.newAgent')}
              aria-label={t('common:sidebar.newAgent')}
              className="h-10 w-10 shrink-0 rounded-full border-black/12 bg-transparent shadow-none hover:bg-black/[0.04] dark:border-white/10"
              onClick={() => openSettingsModal('agents')}
            >
              <Bot className="h-[18px] w-[18px]" strokeWidth={2} />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-2 pb-3">
            {visibleAgentIds.map((agentId) => {
              const { name, subtitle } = getAgentDisplay(agentId);
              const expanded = resolvedExpandedAgentId === agentId;
              const rows = sessionsForAgent(agentId);
              const listExpandedInSidebar = agentSessionListExpanded[agentId] === true;
              const rowsVisible =
                rows.length <= SIDEBAR_AGENT_SESSIONS_INITIAL || listExpandedInSidebar
                  ? rows
                  : rows.slice(0, SIDEBAR_AGENT_SESSIONS_INITIAL);
              const showLoadMoreFooter =
                rows.length > 0 &&
                rows.length > SIDEBAR_AGENT_SESSIONS_INITIAL &&
                !listExpandedInSidebar;
              const showViewMoreFooter = rows.length > 0 && !showLoadMoreFooter;
              const unread = countUnreadSessionsUnderAgent(
                agentId,
                sessions,
                sessionLastActivity,
                sessionReadWatermark,
                currentSessionKey,
                isOnChat,
              );

              const agentSummary = safeAgents.find((a) => a.id === agentId);

              return (
                <div
                  key={agentId}
                  className="group mb-1"
                  data-testid="sidebar-agent-group"
                  data-agent-id={agentId}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      className="mt-2 flex h-6 w-5 shrink-0 items-center justify-center text-muted-foreground"
                      aria-expanded={expanded}
                      onClick={() => {
                        toggleAgentCollapsed(agentId);
                      }}
                    >
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')}
                      />
                    </button>
                    <button
                      type="button"
                      data-testid="sidebar-agent-row"
                      className="flex min-w-0 flex-1 items-start gap-2 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/5"
                      onClick={() => {
                        toggleAgentCollapsed(agentId);
                      }}
                    >
                      <AgentAvatarBubble agentId={agentId} displayName={name} />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-tight text-foreground">
                            {name}
                          </div>
                          {unread > 0 ? (
                            <span
                              data-testid="sidebar-agent-unread-badge"
                              data-agent-id={agentId}
                              className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm tabular-nums dark:bg-red-600"
                              aria-label={String(unread)}
                            >
                              {unread > 99 ? '99+' : unread}
                            </span>
                          ) : null}
                        </div>
                        {subtitle ? (
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 pt-1">
                      {agentSummary && !agentSummary.isDefault && !agentSummary.isPreinstalled ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              data-testid={`sidebar-agent-more-menu-${agentId}`}
                              className="h-7 w-7 text-muted-foreground opacity-0 transition-all hover:bg-black/[0.08] hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100 dark:hover:bg-white/10"
                              title={tAgents('moreMenu')}
                              aria-label={tAgents('moreMenu')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={6}
                            className="min-w-[9.5rem] rounded-xl border border-black/10 bg-popover p-1.5 shadow-xl dark:border-white/10 dark:bg-card"
                          >
                            <DropdownMenuItem
                              data-testid={`sidebar-agent-delete-menu-item-${agentId}`}
                              className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                              onSelect={() => {
                                setAgentToDelete(agentSummary);
                              }}
                            >
                              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                              <span>{t('common:actions.delete')}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                      <button
                        type="button"
                        data-testid={`sidebar-new-chat-${agentId}`}
                        title={t('common:sidebar.newChatForAgent')}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-foreground transition-colors hover:bg-black/[0.1] dark:bg-white/10 dark:hover:bg-white/15"
                        onClick={(e) => {
                          e.stopPropagation();
                          newSession(agentId);
                          navigate('/');
                        }}
                      >
                        <MessageSquarePlus className="h-[15px] w-[15px]" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l border-black/[0.06] pl-2 dark:border-white/10">
                      {rows.length === 0 ? (
                        <p className="py-1.5 pl-1 text-[11px] text-muted-foreground">
                          {t('common:sidebar.noSessionsUnderAgent')}
                        </p>
                      ) : null}
                      {rowsVisible.map((s) => {
                        const sessionRowUnread = isSessionUnread(
                          s.key,
                          sessionLastActivity,
                          sessionReadWatermark,
                          currentSessionKey,
                          isOnChat,
                        );
                        return (
                        <div key={s.key} className="group relative">
                          <button
                            type="button"
                            data-testid={isCronSessionKey(s.key) ? 'sidebar-session-cron' : undefined}
                            onClick={() => {
                              bumpSessionReadAtLeast(s.key, sessionLastActivity[s.key] ?? 0);
                              switchSession(s.key);
                              navigate('/');
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors pr-7',
                              isOnChat && currentSessionKey === s.key
                                ? 'bg-black/[0.06] font-medium text-foreground dark:bg-white/10'
                                : 'text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/5',
                            )}
                          >
                            {sessionRowUnread ? (
                              <span
                                data-testid="sidebar-session-unread-dot"
                                className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm tabular-nums dark:bg-red-600"
                                aria-label="1"
                              >
                                1
                              </span>
                            ) : (
                              <span className="h-[18px] w-[18px] shrink-0" aria-hidden />
                            )}
                            {isCronSessionKey(s.key) ? (
                              <AlarmClock
                                className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-hidden
                              />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{getSessionLabel(s.key, s.displayName, s.label)}</span>
                          </button>
                          <button
                            type="button"
                            aria-label="Delete session"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete({
                                key: s.key,
                                label: getSessionLabel(s.key, s.displayName, s.label),
                              });
                            }}
                            className={cn(
                              'absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 transition-opacity',
                              'opacity-0 group-hover:opacity-100',
                              'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        );
                      })}
                      {showLoadMoreFooter ? (
                        <div className="flex w-full justify-end">
                          <button
                            type="button"
                            data-testid="sidebar-agent-load-more"
                            data-agent-id={agentId}
                            onClick={() => {
                              setAgentSessionListExpanded((prev) => ({ ...prev, [agentId]: true }));
                            }}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-right text-[12px] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/5"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{t('common:sidebar.loadMoreSessions')}</span>
                          </button>
                        </div>
                      ) : null}
                      {showViewMoreFooter ? (
                        <div className="flex w-full justify-end">
                          <button
                            type="button"
                            data-testid="sidebar-agent-view-more"
                            data-agent-id={agentId}
                            onClick={() => setSessionHistorySheetAgentId(agentId)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-right text-[12px] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/5"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{t('common:sidebar.viewMoreSessions')}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AgentSessionsHistorySheet
        key={sessionHistorySheetAgentId ?? 'agent-sessions-sheet-closed'}
        open={sessionHistorySheetAgentId !== null}
        onOpenChange={(open) => {
          if (!open) setSessionHistorySheetAgentId(null);
        }}
        agentName={
          sessionHistorySheetAgentId
            ? getAgentDisplay(sessionHistorySheetAgentId).name
            : ''
        }
        sessions={sessionHistorySheetAgentId ? sessionsForAgent(sessionHistorySheetAgentId) : []}
        currentSessionKey={currentSessionKey}
        isOnChat={isOnChat}
        getSessionLabel={getSessionLabel}
        sessionLastActivity={sessionLastActivity}
        sessionReadWatermark={sessionReadWatermark}
        onSelectSession={(key) => {
          bumpSessionReadAtLeast(key, sessionLastActivity[key] ?? 0);
          switchSession(key);
          navigate('/');
        }}
        onRequestDelete={(key, label) => setSessionToDelete({ key, label })}
        bumpSessionReadAtLeast={bumpSessionReadAtLeast}
        isSessionUnread={isSessionUnread}
      />

      <ChatSearchModal open={chatSearchOpen} onOpenChange={setChatSearchOpen} />

      <ConfirmDialog
        open={!!sessionToDelete}
        title={t('common:actions.confirm')}
        message={t('common:sidebar.deleteSessionConfirm', { label: sessionToDelete?.label })}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToDelete) return;
          await deleteSession(sessionToDelete.key);
          if (currentSessionKey === sessionToDelete.key) navigate('/');
          setSessionToDelete(null);
        }}
        onCancel={() => setSessionToDelete(null)}
      />

      <ConfirmDialog
        open={!!agentToDelete}
        title={tAgents('deleteDialog.title')}
        message={agentToDelete ? tAgents('deleteDialog.message', { name: agentToDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        pendingConfirmLabel={tAgents('deleteDialog.deleting')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        testId="sidebar-agent-delete-confirm-dialog"
        onConfirm={async () => {
          if (!agentToDelete) return;
          const deletedId = agentToDelete.id;
          try {
            await deleteAgent(deletedId);
            setAgentToDelete(null);
            if (sessionHistorySheetAgentId === deletedId) {
              setSessionHistorySheetAgentId(null);
            }
            const chat = useChatStore.getState();
            if (getAgentIdFromSessionKey(chat.currentSessionKey) === deletedId) {
              const snap = useAgentsStore.getState();
              const fallback = snap.agents.find((a) => a.isDefault) ?? snap.agents[0];
              const targetKey = fallback?.mainSessionKey ?? `agent:${snap.defaultAgentId}:main`;
              chat.switchSession(targetKey);
              navigate('/');
            }
            toast.success(tAgents('toast.agentDeleted'));
          } catch (error) {
            toast.error(tAgents('toast.agentDeleteFailed', { error: String(error) }));
          }
        }}
        onCancel={() => setAgentToDelete(null)}
      />
    </aside>
  );
}
