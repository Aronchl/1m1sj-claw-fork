/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. Session selector, thinking toggle, and refresh
 * are in the toolbar; messages render with markdown + streaming.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSubToolbar } from './ChatToolbar';
import { AgentDetailsSheet } from '@/components/chat/AgentDetailsSheet';
import { AddInspirationModal } from '@/components/chat/AddInspirationModal';
import { extractImages, extractText, extractThinking, extractToolUse } from './message-utils';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { useMinLoading } from '@/hooks/use-min-loading';
import { isCronSessionKey } from '@/stores/chat/cron-session-utils';

function toContentBlocks(content: unknown): unknown[] {
  if (Array.isArray(content)) return content;
  if (content == null) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return [content];
}

function mergeAssistantLikeMessages(messages: RawMessage[]): RawMessage[] {
  const merged: RawMessage[] = [];
  const isAssistantLike = (m: RawMessage) => m.role !== 'user' && m.role !== 'toolresult';

  for (const msg of messages) {
    const prev = merged[merged.length - 1];
    if (!prev || !isAssistantLike(prev) || !isAssistantLike(msg)) {
      merged.push(msg);
      continue;
    }

    const prevBlocks = toContentBlocks(prev.content);
    const nextBlocks = toContentBlocks(msg.content);
    const mergedRole: RawMessage['role'] = prev.role === 'assistant' || msg.role === 'assistant'
      ? 'assistant'
      : prev.role;

    merged[merged.length - 1] = {
      ...prev,
      role: mergedRole,
      content: [...prevBlocks, ...nextBlocks],
      timestamp: Math.max(prev.timestamp ?? 0, msg.timestamp ?? 0) || (prev.timestamp ?? msg.timestamp),
      _attachedFiles: [...(prev._attachedFiles ?? []), ...(msg._attachedFiles ?? [])],
      isError: Boolean(prev.isError || msg.isError),
      _rowKey: prev._rowKey || msg._rowKey,
    };
  }

  return merged;
}

export function Chat() {
  const { t } = useTranslation('chat');
  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const messages = useChatStore((s) => s.messages);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const activeRunId = useChatStore((s) => s.activeRunId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);
  const pendingScrollToMessageId = useChatStore((s) => s.pendingScrollToMessageId);
  const setPendingScrollToMessageId = useChatStore((s) => s.setPendingScrollToMessageId);

  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0);
  const minLoading = useMinLoading(loading && messages.length > 0);
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);

  // Load data when gateway is running.
  // When the store already holds messages for this session (i.e. the user
  // is navigating *back* to Chat), use quiet mode so the existing messages
  // stay visible while fresh data loads in the background.  This avoids
  // an unnecessary messages → spinner → messages flicker.
  useEffect(() => {
    return () => {
      // If the user navigates away without sending any messages, remove the
      // empty session so it doesn't linger as a ghost entry in the sidebar.
      cleanupEmptySession();
    };
  }, [cleanupEmptySession]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    let prevKey = useChatStore.getState().currentSessionKey;
    const unsub = useChatStore.subscribe((state) => {
      const nextKey = state.currentSessionKey;
      if (nextKey !== prevKey) {
        prevKey = nextKey;
        useChatChromeStore.getState().setAgentPanelSubjectAgentId(null);
      }
    });
    return () => {
      unsub();
      useChatChromeStore.getState().setAgentPanelSubjectAgentId(null);
    };
  }, []);

  useEffect(() => {
    const id = pendingScrollToMessageId;
    if (!id || loading) return;
    const root = scrollRef.current;
    if (!root) return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id.replace(/"/g, '\\"');
    const tryScroll = (): boolean => {
      const el = root.querySelector(`[data-message-id="${escaped}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
        setPendingScrollToMessageId(null);
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    queueMicrotask(() => {
      if (!tryScroll()) {
        setPendingScrollToMessageId(null);
      }
    });
  }, [messages, pendingScrollToMessageId, loading, scrollRef, setPendingScrollToMessageId]);

  // Update timestamp when sending starts
  useEffect(() => {
    if (sending && streamingTimestamp === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamingTimestamp(Date.now() / 1000);
    } else if (!sending && streamingTimestamp !== 0) {
      setStreamingTimestamp(0);
    }
  }, [sending, streamingTimestamp]);

  // Gateway not running block has been completely removed so the UI always renders.

  const streamMsg = streamingMessage && typeof streamingMessage === 'object'
    ? streamingMessage as unknown as { role?: string; content?: unknown; timestamp?: number }
    : null;
  const streamText = streamMsg ? extractText(streamMsg) : (typeof streamingMessage === 'string' ? streamingMessage : '');
  const hasStreamText = streamText.trim().length > 0;
  const streamThinking = streamMsg ? extractThinking(streamMsg) : null;
  const hasStreamThinking = showThinking && !!streamThinking && streamThinking.trim().length > 0;
  const streamTools = streamMsg ? extractToolUse(streamMsg) : [];
  const hasStreamTools = streamTools.length > 0;
  const streamImages = streamMsg ? extractImages(streamMsg) : [];
  const hasStreamImages = streamImages.length > 0;
  const hasStreamToolStatus = streamingTools.length > 0;

  const streamId =
    streamMsg && typeof (streamMsg as { id?: unknown }).id === 'string'
      ? (streamMsg as { id: string }).id
      : '';
  const shouldRenderStreaming =
    sending &&
    (hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus);
  const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;
  const displayMessages = useMemo(() => mergeAssistantLikeMessages(messages), [messages]);
  const lastHistoryAssistantLike = [...displayMessages].reverse().find((m) => m.role !== 'toolresult' && m.role !== 'user');
  const hideAssistantAuxAvatar = Boolean(lastHistoryAssistantLike);

  const streamingRowKey = activeRunId ? `run-${activeRunId}` : (streamId || 'streaming-assistant');

  const isEmpty = messages.length === 0 && !sending;
  const cronSessionView = isCronSessionKey(currentSessionKey);

  return (
    <div className={cn("relative flex flex-col -m-6 transition-colors duration-500 dark:bg-background")} style={{ height: 'calc(100vh - 2.5rem)' }}>
      {/* Second row above messages: agent + refresh + thinking (right) */}
      <ChatSubToolbar />

      {/* Messages Area */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div ref={contentRef} className="max-w-4xl mx-auto space-y-4">
          {isEmpty ? (
            <WelcomeScreen />
          ) : (
            <>
              {displayMessages.map((msg, idx) => (
                (() => {
                  const prev = idx > 0 ? displayMessages[idx - 1] : null;
                  const prevIsAssistantLike = !!prev && prev.role !== 'user' && prev.role !== 'toolresult';
                  const currentIsAssistantLike = msg.role !== 'user' && msg.role !== 'toolresult';
                  const hideAvatar = prevIsAssistantLike && currentIsAssistantLike;
                  return (
                <ChatMessage
                  key={msg._rowKey || msg.id || `msg-${idx}`}
                  message={msg}
                  showThinking={showThinking}
                  cronSession={cronSessionView}
                  hideAvatar={hideAvatar}
                />
                  );
                })()
              ))}

              {/* Streaming message */}
              {shouldRenderStreaming && (
                <ChatMessage
                  key={streamingRowKey}
                  message={(streamMsg
                    ? {
                        ...(streamMsg as Record<string, unknown>),
                        role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                        content: streamMsg.content ?? streamText,
                        timestamp: streamMsg.timestamp ?? streamingTimestamp,
                      }
                    : {
                        role: 'assistant',
                        content: streamText,
                        timestamp: streamingTimestamp,
                      }) as RawMessage}
                  showThinking={showThinking}
                  cronSession={cronSessionView}
                  hideAvatar={hideAssistantAuxAvatar}
                  isStreaming
                  streamingTools={streamingTools}
                />
              )}

              {/* Activity indicator: waiting for next AI turn after tool execution */}
              {sending && pendingFinal && !shouldRenderStreaming && (
                <ActivityIndicator phase="tool_processing" hideAvatar={hideAssistantAuxAvatar} />
              )}

              {/* Typing indicator when sending but no stream content yet */}
              {sending && !pendingFinal && !hasAnyStreamContent && (
                <TypingIndicator hideAvatar={hideAssistantAuxAvatar} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            <button
              onClick={clearError}
              className="text-xs text-destructive/60 hover:text-destructive underline"
            >
              {t('common:actions.dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        onSend={sendMessage}
        onStop={abortRun}
        disabled={!isGatewayRunning}
        sending={sending}
        isEmpty={isEmpty}
      />

      {/* Transparent loading overlay */}
      {minLoading && !sending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl pointer-events-auto">
          <div className="bg-background shadow-lg rounded-full p-2.5 border border-border">
            <LoadingSpinner size="md" />
          </div>
        </div>
      )}

      <AgentDetailsSheet />
      <AddInspirationModal />
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────────

function WelcomeScreen() {
  const { t } = useTranslation('chat');
  const quickActions = [
    { key: 'askQuestions', label: t('welcome.askQuestions') },
    { key: 'creativeTasks', label: t('welcome.creativeTasks') },
    { key: 'brainstorming', label: t('welcome.brainstorming') },
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center h-[60vh]">
      <h1 className="text-4xl md:text-5xl font-serif text-foreground/80 mb-8 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
        {t('welcome.subtitle')}
      </h1>

      <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-lg w-full">
        {quickActions.map(({ key, label }) => (
          <button 
            key={key}
            className="px-4 py-1.5 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-medium text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors bg-black/[0.02]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────

function TypingIndicator({ hideAvatar = false }: { hideAvatar?: boolean }) {
  return (
    <div className="flex gap-3">
      {hideAvatar ? (
        <div className="h-8 w-8 shrink-0 mt-1" aria-hidden />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5 text-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className="bg-black/5 dark:bg-white/5 text-foreground rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Activity Indicator (shown between tool cycles) ─────────────

function ActivityIndicator({ phase, hideAvatar = false }: { phase: 'tool_processing'; hideAvatar?: boolean }) {
  void phase;
  return (
    <div className="flex gap-3">
      {hideAvatar ? (
        <div className="h-8 w-8 shrink-0 mt-1" aria-hidden />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5 text-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className="bg-black/5 dark:bg-white/5 text-foreground rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Processing tool results…</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
