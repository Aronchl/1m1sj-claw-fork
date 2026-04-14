/**
 * Full chat session list for one agent (side panel): search, time filter, paginated list.
 */
import { useMemo, useState } from 'react';
import { AlarmClock, MessageSquare, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isCronSessionKey } from '@/stores/chat/cron-session-utils';
import type { ChatSession } from '@/stores/chat/types';

const SHEET_PAGE_SIZE = 20;
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

type TimeFilter = 'all' | 'day' | 'week';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  sessions: ChatSession[];
  currentSessionKey: string;
  isOnChat: boolean;
  getSessionLabel: (key: string, displayName?: string, label?: string) => string;
  sessionLastActivity: Record<string, number>;
  sessionReadWatermark: Record<string, number>;
  onSelectSession: (key: string) => void;
  onRequestDelete: (key: string, label: string) => void;
  bumpSessionReadAtLeast: (key: string, at: number) => void;
  isSessionUnread: (
    key: string,
    activity: Record<string, number>,
    watermark: Record<string, number>,
    current: string,
    onChat: boolean,
  ) => boolean;
};

function activityMs(s: ChatSession, sessionLastActivity: Record<string, number>): number {
  const fromMap = sessionLastActivity[s.key];
  const fromSession = s.updatedAt;
  const a = typeof fromMap === 'number' && Number.isFinite(fromMap) ? fromMap : 0;
  const b = typeof fromSession === 'number' && Number.isFinite(fromSession) ? fromSession : 0;
  return Math.max(a, b);
}

export function AgentSessionsHistorySheet({
  open,
  onOpenChange,
  agentName,
  sessions,
  currentSessionKey,
  isOnChat,
  getSessionLabel,
  sessionLastActivity,
  sessionReadWatermark,
  onSelectSession,
  onRequestDelete,
  bumpSessionReadAtLeast,
  isSessionUnread,
}: Props) {
  const { t } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(SHEET_PAGE_SIZE);
  /** Snapshot at mount (parent remounts via `key` when opening / switching agent). */
  const [filterTimeAnchor] = useState(() => Date.now());

  const filteredSorted = useMemo(() => {
    const t0 = filterTimeAnchor;
    const q = search.trim().toLowerCase();
    let list = sessions.map((s) => ({ s, act: activityMs(s, sessionLastActivity) }));

    if (timeFilter === 'day') {
      list = list.filter(({ act }) => act >= t0 - MS_DAY);
    } else if (timeFilter === 'week') {
      list = list.filter(({ act }) => act >= t0 - MS_WEEK);
    }

    if (q) {
      list = list.filter(({ s }) => {
        const label = getSessionLabel(s.key, s.displayName, s.label).toLowerCase();
        return label.includes(q);
      });
    }

    list.sort((a, b) => {
      const ua = isSessionUnread(
        a.s.key,
        sessionLastActivity,
        sessionReadWatermark,
        currentSessionKey,
        isOnChat,
      );
      const ub = isSessionUnread(
        b.s.key,
        sessionLastActivity,
        sessionReadWatermark,
        currentSessionKey,
        isOnChat,
      );
      if (ua !== ub) return ua ? -1 : 1;
      return b.act - a.act;
    });
    return list.map(({ s }) => s);
  }, [
    sessions,
    sessionLastActivity,
    sessionReadWatermark,
    currentSessionKey,
    isOnChat,
    search,
    timeFilter,
    getSessionLabel,
    filterTimeAnchor,
    isSessionUnread,
  ]);

  const visibleRows = filteredSorted.slice(0, visibleCount);
  const hasMore = filteredSorted.length > visibleCount;

  const filterBtn = (id: TimeFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setTimeFilter(id);
        setVisibleCount(SHEET_PAGE_SIZE);
      }}
      className={cn(
        'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
        timeFilter === id
          ? 'bg-foreground text-background'
          : 'bg-black/[0.05] text-muted-foreground hover:bg-black/[0.08] hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15',
      )}
    >
      {label}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="agent-sessions-history-sheet"
        className="flex w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
          <SheetTitle className="truncate pr-2 text-left text-base font-semibold">
            {t('sidebar.sessionHistoryTitle', { name: agentName })}
          </SheetTitle>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('actions.close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-border/60 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="agent-sessions-history-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(SHEET_PAGE_SIZE);
              }}
              placeholder={t('sidebar.sessionHistorySearchPlaceholder')}
              className="h-10 border-black/10 bg-black/[0.03] pl-9 dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterBtn('all', t('sidebar.sessionHistoryFilterAll'))}
            {filterBtn('day', t('sidebar.sessionHistoryFilterDay'))}
            {filterBtn('week', t('sidebar.sessionHistoryFilterWeek'))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filteredSorted.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {sessions.length === 0
                ? t('sidebar.noSessionsUnderAgent')
                : t('sidebar.sessionHistoryEmptyFiltered')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {visibleRows.map((s) => {
                const sessionRowUnread = isSessionUnread(
                  s.key,
                  sessionLastActivity,
                  sessionReadWatermark,
                  currentSessionKey,
                  isOnChat,
                );
                return (
                  <li key={s.key} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        bumpSessionReadAtLeast(s.key, sessionLastActivity[s.key] ?? 0);
                        onSelectSession(s.key);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] transition-colors pr-9',
                        isOnChat && currentSessionKey === s.key
                          ? 'bg-black/[0.06] font-medium text-foreground dark:bg-white/10'
                          : 'text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/5',
                      )}
                    >
                      {sessionRowUnread ? (
                        <span
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
                      <span className="min-w-0 flex-1 truncate">
                        {getSessionLabel(s.key, s.displayName, s.label)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete session"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestDelete(s.key, getSessionLabel(s.key, s.displayName, s.label));
                      }}
                      className={cn(
                        'absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 transition-opacity',
                        'opacity-0 group-hover:opacity-100',
                        'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasMore ? (
          <div className="shrink-0 border-t border-border/60 px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              data-testid="agent-sessions-history-load-more"
              className="w-full rounded-full"
              onClick={() => setVisibleCount((c) => c + SHEET_PAGE_SIZE)}
            >
              {t('sidebar.sessionHistoryLoadMore')}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
