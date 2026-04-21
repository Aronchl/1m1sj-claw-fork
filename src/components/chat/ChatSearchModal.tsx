import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, CircleX } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import type { AgentSummary } from '@/types/agent';
import { AgentAvatarBubble } from '@/components/agent/AgentAvatarBubble';

export type ChatSearchTab = 'all' | 'agent' | 'chat' | 'cron';

type SearchHit = {
  sessionKey: string;
  agentId: string;
  lineId: string;
  title: string;
  snippet: string;
  timestampMs?: number;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-primary/14 px-0.5 font-inherit text-foreground dark:bg-primary/22"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupLabelForTimestamp(ts: number, tGroup: (key: string) => string): string {
  const now = new Date();
  const day = startOfDay(now);
  const y = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const tDay = startOfDay(new Date(ts));
  if (tDay === day) return tGroup('groupToday');
  if (tDay === y) return tGroup('groupYesterday');
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Match Agent tab: name + model line + workspace path (acts as description context). */
function agentMatchesQuery(agent: AgentSummary, q: string): boolean {
  const qLower = q.trim().toLowerCase();
  if (!qLower) return false;
  const workspaceTail = agent.workspace
    ? (agent.workspace.split(/[/\\]/).filter(Boolean).pop() ?? '')
    : '';
  const haystack = [agent.name, agent.modelDisplay ?? '', agent.workspace ?? '', workspaceTail]
    .join(' ')
    .toLowerCase();
  return haystack.includes(qLower);
}

function agentToSearchHit(agent: AgentSummary): SearchHit {
  const subtitle =
    agent.modelDisplay?.trim() ||
    (agent.workspace ? agent.workspace.split(/[/\\]/).filter(Boolean).pop() ?? '' : '') ||
    '';
  return {
    sessionKey: agent.mainSessionKey,
    agentId: agent.id,
    lineId: '',
    title: agent.name,
    snippet: subtitle,
    timestampMs: undefined,
  };
}

export function ChatSearchModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('chat');
  const navigate = useNavigate();
  const switchSession = useChatStore((s) => s.switchSession);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const safeAgents = Array.isArray(agents) ? agents : [];

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState<ChatSearchTab>('all');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 320);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (open) {
      void fetchAgents();
    }
  }, [open, fetchAgents]);

  useEffect(() => {
    if (!open) return;
    if (!debounced) {
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (tab === 'agent') {
      setLoading(false);
      setError(null);
      const filtered = safeAgents.filter((a) => agentMatchesQuery(a, debounced));
      setHits(filtered.map(agentToSearchHit));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await hostApiFetch<{ success?: boolean; hits?: SearchHit[] }>(
          `/api/chat/search?q=${encodeURIComponent(debounced)}&tab=${encodeURIComponent(tab)}&limit=80`,
        );
        if (cancelled) return;
        setHits(Array.isArray(res.hits) ? res.hits : []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, tab, safeAgents]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      setHits([]);
      setError(null);
      setTab('all');
    }
  }, [open]);

  const agentNameById = useMemo(
    () => Object.fromEntries(safeAgents.map((a) => [a.id, a.name])),
    [safeAgents],
  );

  const grouped = useMemo(() => {
    if (tab === 'agent') {
      return hits.length ? ([['', hits]] as [string, SearchHit[]][]) : [];
    }
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      const ts = h.timestampMs ?? Date.now();
      const label = groupLabelForTimestamp(ts, (k) => t(`search.${k}`));
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(h);
    }
    return [...map.entries()];
  }, [hits, t, tab]);

  const onPick = useCallback(
    (hit: SearchHit) => {
      switchSession(hit.sessionKey, { scrollToMessageId: hit.lineId || null });
      navigate('/');
      onOpenChange(false);
    },
    [navigate, onOpenChange, switchSession],
  );

  const tabs: { id: ChatSearchTab; label: string }[] = [
    { id: 'all', label: t('search.tabAll') },
    { id: 'agent', label: t('search.tabAgent') },
    { id: 'chat', label: t('search.tabChat') },
    { id: 'cron', label: t('search.tabCron') },
  ];

  const showTabs = Boolean(debounced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="chat-search-modal"
        className={cn(
          'flex flex-col gap-0 overflow-hidden rounded-2xl border border-black/8 bg-[#f3f1e9] p-0 shadow-xl dark:border-white/10 dark:bg-card',
          'h-[min(460px,72vh)] max-h-[72vh] w-[min(100vw-2rem,40rem)] max-w-2xl sm:w-full',
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 flex flex-row items-center justify-between space-y-0 px-5 pb-2 pt-4 text-left">
          <DialogTitle className="text-[16px] font-semibold tracking-tight text-foreground/90">
            {t('search.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('search.hint')}</DialogDescription>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/10"
            aria-label={t('search.close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="shrink-0 px-5 pb-3">
          <label className="sr-only" htmlFor="chat-search-input">
            {t('search.placeholder')}
          </label>
          <div
            className={cn(
              'flex min-h-[52px] items-center gap-3 rounded-2xl border border-black/[0.09] bg-white pl-3 pr-2 shadow-sm',
              'transition-[box-shadow,border-color,ring] duration-200',
              'focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15',
              'dark:border-white/[0.12] dark:bg-card dark:shadow-none',
              'dark:focus-within:ring-primary/25',
            )}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-muted-foreground dark:bg-white/[0.08]"
              aria-hidden
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <Input
              id="chat-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-[15px] leading-snug shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            {query.trim() ? (
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/10"
                aria-label={t('search.clear')}
                onClick={() => setQuery('')}
              >
                <CircleX className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>
        </div>

        {showTabs ? (
          <div className="shrink-0 px-5 pb-2">
            <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-black/[0.04] p-1 dark:bg-white/[0.06]">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'min-w-0 truncate rounded-md px-1.5 py-2 text-center text-[12px] font-medium transition-all sm:px-2',
                    tab === item.id
                      ? 'bg-background text-foreground shadow-sm dark:bg-card'
                      : 'text-muted-foreground hover:text-foreground/90',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-0.5">
          {!debounced ? (
            <div className="flex min-h-[100px] flex-col items-center justify-center px-2 py-6">
              <p className="max-w-[22rem] text-center text-[13px] leading-relaxed text-muted-foreground">
                {t('search.hint')}
              </p>
            </div>
          ) : loading ? (
            <div className="flex min-h-[100px] items-center justify-center px-2">
              <p className="text-center text-[13px] text-muted-foreground">{t('search.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[100px] items-center justify-center px-2">
              <p className="text-center text-[13px] text-destructive">{error}</p>
            </div>
          ) : hits.length === 0 ? (
            <div className="flex min-h-[100px] items-center justify-center px-2">
              <p className="text-center text-[13px] text-muted-foreground">
                {tab === 'agent' ? t('search.emptyAgents') : t('search.empty')}
              </p>
            </div>
          ) : (
            grouped.map(([label, rows]) => (
              <div key={label || 'agent-list'} className="mb-2 last:mb-0">
                {label ? (
                  <div className="sticky top-0 z-[1] bg-[#f3f1e9]/95 px-1 pb-1.5 pt-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm dark:bg-card/95 dark:backdrop-blur-sm">
                    {label}
                  </div>
                ) : null}
                <ul className="space-y-1">
                  {rows.map((hit, idx) => {
                    const agentId = hit.agentId || 'main';
                    const name = agentNameById[agentId] || agentId;
                    const timeStr = hit.timestampMs
                      ? new Date(hit.timestampMs).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <li key={`${hit.sessionKey}-${hit.lineId}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => onPick(hit)}
                          className="flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-black/8 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/5"
                        >
                          <AgentAvatarBubble
                            agentId={agentId}
                            displayName={name}
                            className="mt-0.5 h-8 w-8 text-[11px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
                              <HighlightText text={hit.title} query={debounced} />
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                              <HighlightText text={hit.snippet} query={debounced} />
                            </div>
                          </div>
                          {timeStr ? (
                            <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground/90">
                              {timeStr}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
