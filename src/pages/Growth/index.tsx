/**
 * Growth — academy topics powered by backend APIs.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ellipsis,
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Share2,
  Star,
  ThumbsUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type GrowthCategory = {
  category_id: number;
  name: string;
};

type GrowthArticle = {
  article_id: number;
  article_title?: string;
  dec?: string;
  create_time?: string;
  actual_views?: number;
  virtual_views?: number;
  view_time?: number;
  image?: { file_path?: string };
  category?: { name?: string };
};

type GrowthListPayload = {
  current_page?: number;
  last_page?: number;
  data?: GrowthArticle[];
};

type GrowthArticleDetail = {
  article_id: number;
  article_title?: string;
  article_content?: string;
  create_time?: string;
  view_time?: number;
  image?: { file_path?: string };
};

export function Growth() {
  const { t } = useTranslation('growth');
  const [categories, setCategories] = useState<GrowthCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number>(0);
  const [articles, setArticles] = useState<GrowthArticle[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<GrowthArticleDetail | null>(null);

  const canLoadMore = useMemo(() => page < lastPage, [page, lastPage]);
  const trendingArticles = useMemo(
    () =>
      [...articles]
        .sort(
          (a, b) =>
            ((b as { view_time?: number }).view_time || 0)
            - ((a as { view_time?: number }).view_time || 0),
        )
        .slice(0, 8),
    [articles],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void hostApiFetch<{ success?: boolean; categories?: GrowthCategory[]; error?: string }>('/api/growth/categories')
      .then((res) => {
        if (cancelled) return;
        if (!res.success) throw new Error(res.error || 'Failed to load categories');
        const remote = res.categories || [];
        setCategories(remote);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticles([]);
    setPage(1);
    setLastPage(1);
    void hostApiFetch<{ success?: boolean; list?: GrowthListPayload; error?: string }>(
      `/api/growth/articles?categoryId=${encodeURIComponent(String(activeCategoryId))}&page=1&listRows=20`,
    )
      .then((res) => {
        if (cancelled) return;
        if (!res.success) throw new Error(res.error || 'Failed to load articles');
        const list = res.list || {};
        setArticles(list.data || []);
        setPage(list.current_page || 1);
        setLastPage(list.last_page || 1);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategoryId, reloadKey]);

  const handleOpenArticle = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await hostApiFetch<{ success?: boolean; detail?: GrowthArticleDetail; error?: string }>(
        `/api/growth/article-detail?articleId=${encodeURIComponent(String(id))}`,
      );
      if (!res.success) throw new Error(res.error || 'Failed to load article detail');
      setDetail(res.detail || null);
    } catch (e) {
      setDetailError(String(e instanceof Error ? e.message : e));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!canLoadMore || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await hostApiFetch<{ success?: boolean; list?: GrowthListPayload; error?: string }>(
        `/api/growth/articles?categoryId=${encodeURIComponent(String(activeCategoryId))}&page=${next}&listRows=20`,
      );
      if (!res.success) throw new Error(res.error || 'Failed to load more articles');
      const list = res.list || {};
      setArticles((prev) => [...prev, ...(list.data || [])]);
      setPage(list.current_page || next);
      setLastPage(list.last_page || next);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoadingMore(false);
    }
  };

  const formatCount = (value?: number): string => {
    if (!Number.isFinite(value)) return '0';
    const safe = Number(value) || 0;
    if (safe >= 10000) return `${(safe / 10000).toFixed(1).replace(/\.0$/, '')}w`;
    return String(safe);
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (loading || loadingMore || !canLoadMore) return;
        void handleLoadMore();
      },
      { root: null, rootMargin: '200px 0px 200px 0px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [canLoadMore, loading, loadingMore, page, lastPage, activeCategoryId]);

  return (
    <div
      data-testid="growth-page"
      className="-m-6 flex min-h-0 flex-col overflow-auto bg-[#f6f7fb] px-6 pb-10 pt-6 dark:bg-background"
      style={{ height: 'calc(100vh - 2.5rem)' }}
    >
      <header className="mx-auto mb-4 w-full max-w-[1200px]">
        <h1 className="text-[24px] font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-black/5 bg-card px-3 py-2 dark:border-white/10">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t('sectionArticles')}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3"
              disabled={loading || loadingMore}
              onClick={() => {
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCw className={cn('mr-1 h-3.5 w-3.5', loading && 'animate-spin')} />
              {t('common:actions.refresh', { defaultValue: '刷新' })}
            </Button>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-card dark:border-white/10">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="h-[120px] animate-pulse border-b border-black/5 bg-muted/20 last:border-b-0 dark:border-white/10"
                  />
                ))
              : articles.map((a) => (
                  <button
                    key={a.article_id}
                    type="button"
                    className={cn(
                      'w-full border-b border-black/5 px-4 py-3 text-left last:border-b-0 dark:border-white/10',
                      'transition-colors hover:bg-muted/20',
                    )}
                    onClick={() => handleOpenArticle(a.article_id)}
                  >
                    <div className="rounded-lg border border-black/5 bg-[#f4f5f7] px-3 py-3 dark:border-white/10 dark:bg-muted/20">
                      <p className="line-clamp-2 text-[20px] font-semibold leading-[1.35] text-foreground">
                        {a.article_title || '-'}
                      </p>
                      <div className="mt-2 flex items-start gap-3">
                        <div className="h-[102px] w-[170px] shrink-0 overflow-hidden rounded-md bg-muted/20">
                          {a.image?.file_path ? (
                            <img
                              src={a.image.file_path}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-foreground/45">
                              <FileText className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-4 text-[18px] leading-[1.45] text-muted-foreground">
                            <span className="text-foreground/80">{a.category?.name || '成长日报'}：</span>
                            {a.dec || '暂无摘要'}
                            <span className="ml-1 text-[#1f5ea8]">阅读全文</span>
                          </p>
                          <div className="mt-2 text-[14px] text-muted-foreground">{a.create_time || ''}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-[14px] text-muted-foreground">
                        <span
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[6px] bg-[#e7eefb] px-3 text-[#2b62b2]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ThumbsUp className="h-4 w-4" />
                          <span>{formatCount(a.virtual_views)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {formatCount(a.actual_views)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-4 w-4" />
                          {formatCount(a.view_time)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {formatCount(a.actual_views)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Share2 className="h-4 w-4" />
                          分享
                        </span>
                        <span className="inline-flex items-center">
                          <Ellipsis className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
          </div>
          <div ref={sentinelRef} className="h-4 w-full" />
          {loadingMore ? (
            <div className="mt-3 flex justify-center text-[12px] text-muted-foreground">
              {t('loadingMore', { defaultValue: '加载中...' })}
            </div>
          ) : null}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-3 space-y-3">
            <div className="rounded-xl border border-black/5 bg-card p-3 dark:border-white/10">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('categories', { defaultValue: '分类' })}
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  className={cn(
                    'block w-full rounded-md px-2 py-1.5 text-left text-[13px] transition',
                    activeCategoryId === 0 ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() => setActiveCategoryId(0)}
                >
                  {t('allCategories', { defaultValue: '全部' })}
                </button>
                {categories.map((c) => (
                  <button
                    key={`aside-${c.category_id}`}
                    type="button"
                    className={cn(
                      'block w-full rounded-md px-2 py-1.5 text-left text-[13px] transition',
                      activeCategoryId === c.category_id
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                    onClick={() => setActiveCategoryId(c.category_id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-black/5 bg-card p-3 dark:border-white/10">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('trending', { defaultValue: '热门文章' })}
              </h3>
              <div className="space-y-1.5">
                {trendingArticles.map((a, idx) => (
                  <button
                    key={`trend-${a.article_id}`}
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                    onClick={() => handleOpenArticle(a.article_id)}
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="truncate text-[12.5px] leading-snug text-foreground/90">
                      {a.article_title || '-'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) {
            setDetailError(null);
            setDetailLoading(false);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="w-[min(100vw-2rem,44rem)] max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-background p-0 dark:border-white/10">
          <button
            type="button"
            className="absolute right-2.5 top-2.5 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={() => setDetailOpen(false)}
            aria-label={t('common:actions.close')}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="max-h-[80vh] overflow-auto">
            {detailLoading ? (
              <>
                <DialogTitle className="sr-only">
                  {t('detailModalA11yTitle', { defaultValue: 'Article detail' })}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('loadingMore', { defaultValue: '加载中...' })}
                </DialogDescription>
                <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('loadingMore', { defaultValue: '加载中...' })}
                </div>
              </>
            ) : detailError ? (
              <>
                <DialogTitle className="sr-only">
                  {t('detailModalA11yTitle', { defaultValue: 'Article detail' })}
                </DialogTitle>
                <DialogDescription className="sr-only">{detailError}</DialogDescription>
                <div className="p-6 text-sm text-destructive">{detailError}</div>
              </>
            ) : detail ? (
              <article className="px-6 pb-8 pt-5 sm:px-8">
                <DialogTitle className="text-balance pr-10 text-2xl font-semibold leading-tight text-foreground">
                  {detail.article_title || '-'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {[detail.create_time, detail.article_title].filter(Boolean).join(' · ') || '-'}
                </DialogDescription>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{detail.create_time || ''}</span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {String(detail.view_time ?? '')}
                  </span>
                </div>
                {detail.image?.file_path ? (
                  <div className="mt-5 overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
                    <img src={detail.image.file_path} alt="" className="h-auto w-full object-cover" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    'prose prose-neutral mt-6 max-w-none text-foreground dark:prose-invert',
                    '[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
                  )}
                  dangerouslySetInnerHTML={{ __html: detail.article_content || '' }}
                />
              </article>
            ) : (
              <>
                <DialogTitle className="sr-only">
                  {t('detailModalA11yTitle', { defaultValue: 'Article detail' })}
                </DialogTitle>
                <DialogDescription className="sr-only">{t('common:status.empty')}</DialogDescription>
                <div className="p-6 text-sm text-muted-foreground">{t('common:status.empty')}</div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
