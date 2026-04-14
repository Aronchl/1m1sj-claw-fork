/**
 * Chat toolbars:
 * - ChatTitleBarToolbar: token + agent details (title bar row).
 * - ChatSubToolbar: current agent chip, refresh, thinking (second row above messages, right-aligned).
 */
import { useMemo } from 'react';
import { RefreshCw, Brain, Bot, Sparkles, User, AlarmClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useChatUsageSummary } from '@/hooks/use-chat-usage-summary';
import { isCronSessionKey } from '@/stores/chat/cron-session-utils';

/** Title bar: token usage + open agent details (user icon). */
export function ChatTitleBarToolbar() {
  const { t } = useTranslation('chat');
  const { usedLabel, loading: usageLoading } = useChatUsageSummary();
  const toggleAgentPanel = useChatChromeStore((s) => s.toggleAgentPanel);
  const agentPanelOpen = useChatChromeStore((s) => s.agentPanelOpen);

  return (
    <div
      data-testid="chat-toolbar"
      className="flex h-full max-h-10 min-h-0 shrink-0 items-center gap-0.5 sm:gap-1.5"
    >
      <div
        className="flex max-w-[min(52vw,220px)] items-center gap-1.5 rounded-full border border-black/8 bg-black/[0.03] px-2 py-1.5 text-[10px] text-muted-foreground dark:border-white/10 dark:bg-white/5 sm:max-w-none sm:px-2.5 sm:text-[11px]"
        title={t('toolbar.tokenHint')}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="max-w-[200px] truncate">
          {usageLoading ? '…' : t('toolbar.tokenUsed', { used: usedLabel })}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="chat-toolbar-agent-details"
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', agentPanelOpen && 'bg-primary/10 text-primary')}
            onClick={toggleAgentPanel}
            aria-pressed={agentPanelOpen}
          >
            <User className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('toolbar.agentDetails')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Second row above chat: current agent + refresh + thinking (right-aligned). */
export function ChatSubToolbar() {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const { t } = useTranslation('chat');
  const currentAgentName = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId)?.name ?? currentAgentId,
    [agents, currentAgentId],
  );

  const cronSessionToolbar = isCronSessionKey(currentSessionKey);

  return (
    <div
      data-testid="chat-sub-toolbar"
      className="flex shrink-0 items-center justify-end gap-1 border-b border-black/8 bg-background/80 px-4 py-2 dark:border-white/10"
    >
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {cronSessionToolbar ? (
          <div
            data-testid="chat-scheduled-task-badge"
            className="flex max-w-[min(100%,200px)] items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50"
            title={t('cronSession.avatarHint')}
          >
            <AlarmClock className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
            <span className="truncate">{t('toolbar.scheduledTask')}</span>
          </div>
        ) : null}
        <div className="flex max-w-[min(100%,320px)] items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground/80 dark:border-white/10 dark:bg-white/5">
          <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{t('toolbar.currentAgent', { agent: currentAgentName })}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.refresh')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0',
                showThinking && 'bg-primary/10 text-primary',
              )}
              onClick={toggleThinking}
            >
              <Brain className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
