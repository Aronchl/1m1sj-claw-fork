import { useEffect, useState } from 'react';
import { invokeIpc } from '@/lib/api-client';

type UsageEntry = { totalTokens?: number };

function formatWan(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const w = n / 10_000;
  if (w >= 100) return `${Math.round(w)}万`;
  if (w >= 10) return `${w.toFixed(1)}万`;
  return `${w.toFixed(2)}万`;
}

/**
 * Sums recent transcript token usage (same source as Models dashboard).
 * No subscription “remaining %” API — second segment is omitted or shown as em dash.
 */
export function useChatUsageSummary() {
  const [usedTotal, setUsedTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await invokeIpc<UsageEntry[]>('usage:recentTokenHistory', 5000)) ?? [];
        const sum = rows.reduce((a, r) => a + (typeof r.totalTokens === 'number' ? r.totalTokens : 0), 0);
        if (!cancelled) setUsedTotal(sum);
      } catch {
        if (!cancelled) setUsedTotal(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usedLabel = usedTotal == null ? '—' : formatWan(usedTotal);

  return { usedLabel, loading, usedTotal };
}
