/**
 * Inspiration Square — curated prompt / workflow ideas (static showcase UI).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Newspaper, FileText, Calendar, FolderOpen, Plane, Bell, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useChatChromeStore } from '@/stores/chat-chrome';

type CategoryId = 'all' | 'office' | 'study' | 'fun' | 'life' | 'media' | 'finance';

export function Inspiration() {
  const { t } = useTranslation('inspiration');
  const navigate = useNavigate();
  const setComposerInspiration = useChatChromeStore((s) => s.setComposerInspiration);

  const categories = useMemo(
    () =>
      [
        { id: 'all' as const, labelKey: 'categories.all' },
        { id: 'office' as const, labelKey: 'categories.office' },
        { id: 'study' as const, labelKey: 'categories.study' },
        { id: 'fun' as const, labelKey: 'categories.fun' },
        { id: 'life' as const, labelKey: 'categories.life' },
        { id: 'media' as const, labelKey: 'categories.media' },
        { id: 'finance' as const, labelKey: 'categories.finance' },
      ] as const,
    [],
  );

  const cards = useMemo(
    () =>
      [
        {
          id: '1',
          category: 'office' as CategoryId,
          icon: 'newspaper' as const,
          titleKey: 'cards.hotNews.title',
          descKey: 'cards.hotNews.desc',
        },
        {
          id: '2',
          category: 'office' as CategoryId,
          icon: 'invoice' as const,
          titleKey: 'cards.invoice.title',
          descKey: 'cards.invoice.desc',
        },
        {
          id: '3',
          category: 'study' as CategoryId,
          icon: 'calendar' as const,
          titleKey: 'cards.studyPlan.title',
          descKey: 'cards.studyPlan.desc',
        },
        {
          id: '4',
          category: 'office' as CategoryId,
          icon: 'folder' as const,
          titleKey: 'cards.docs.title',
          descKey: 'cards.docs.desc',
        },
        {
          id: '5',
          category: 'life' as CategoryId,
          icon: 'bell' as const,
          titleKey: 'cards.routine.title',
          descKey: 'cards.routine.desc',
        },
        {
          id: '6',
          category: 'fun' as CategoryId,
          icon: 'plane' as const,
          titleKey: 'cards.travel.title',
          descKey: 'cards.travel.desc',
        },
      ] as const,
    [],
  );

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return cards;
    return cards.filter((c) => c.category === activeCategory);
  }, [activeCategory, cards]);

  const selectedCard = useMemo(
    () => cards.find((item) => item.id === selectedCardId) || null,
    [cards, selectedCardId],
  );

  const selectedCardTitle = selectedCard ? t(selectedCard.titleKey) : '';
  const selectedCardDesc = selectedCard ? t(selectedCard.descKey) : '';
  const selectedPrompt = selectedCard
    ? t('modal.promptTemplate', { title: selectedCardTitle, desc: selectedCardDesc })
    : '';

  return (
    <div
      data-testid="inspiration-page"
      className="-m-6 flex min-h-0 flex-col overflow-auto bg-background px-8 pb-10 pt-8"
      style={{ height: 'calc(100vh - 2.5rem)' }}
    >
      <h1 className="mb-6 text-[22px] font-semibold tracking-tight text-foreground">{t('title')}</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedCardId('1')}
          className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-br from-emerald-500/90 to-emerald-700/95 p-6 text-left text-white shadow-sm transition hover:opacity-[0.98] dark:border-white/10"
        >
          <div className="relative z-10 max-w-[70%]">
            <p className="text-[15px] font-semibold leading-snug">{t('banners.cron.title')}</p>
          </div>
          <Bell className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-24 text-white/25" strokeWidth={1.25} />
        </button>
        <button
          type="button"
          onClick={() => setSelectedCardId('6')}
          className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-br from-sky-500/90 to-indigo-600/95 p-6 text-left text-white shadow-sm transition hover:opacity-[0.98] dark:border-white/10"
        >
          <div className="relative z-10 max-w-[70%]">
            <p className="text-[15px] font-semibold leading-snug">{t('banners.travel.title')}</p>
          </div>
          <Plane className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-24 text-white/25" strokeWidth={1.25} />
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
              activeCategory === c.id
                ? 'bg-foreground text-background'
                : 'bg-black/[0.04] text-foreground/70 hover:bg-black/[0.07] dark:bg-white/10 dark:hover:bg-white/15',
            )}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-[13px] text-muted-foreground">{t('emptyCategory')}</p>
        )}
        {filtered.map((card) => (
          <article
            key={card.id}
            onClick={() => setSelectedCardId(card.id)}
            className="flex flex-col rounded-2xl border border-black/[0.06] bg-card p-4 shadow-sm transition hover:border-black/10 dark:border-white/10"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/10">
              {card.icon === 'newspaper' && <Newspaper className="h-5 w-5 text-foreground/80" />}
              {card.icon === 'invoice' && <FileText className="h-5 w-5 text-foreground/80" />}
              {card.icon === 'calendar' && <Calendar className="h-5 w-5 text-foreground/80" />}
              {card.icon === 'folder' && <FolderOpen className="h-5 w-5 text-foreground/80" />}
              {card.icon === 'bell' && <Bell className="h-5 w-5 text-foreground/80" />}
              {card.icon === 'plane' && <Plane className="h-5 w-5 text-foreground/80" />}
            </div>
            <h2 className="mb-1.5 text-[15px] font-semibold text-foreground">{t(card.titleKey)}</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
          </article>
        ))}
      </div>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCardId(null)}>
        <DialogContent className="w-[min(100vw-2rem,36rem)] max-w-2xl rounded-3xl border-black/10 p-0 dark:border-white/10">
          <div className="p-6 md:p-8">
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedCardId(null)}
                aria-label={t('modal.close')}
                className="rounded-full p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
                <FileText className="h-5 w-5 text-foreground/80" />
              </div>
              <DialogTitle className="text-[24px] leading-tight font-semibold text-foreground">
                {selectedCardTitle}
              </DialogTitle>
              <DialogDescription className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {selectedCardDesc}
              </DialogDescription>
            </div>

            <section className="mb-6">
              <h3 className="mb-2 text-[18px] font-semibold text-foreground">{t('modal.sceneTitle')}</h3>
              <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-[14px] leading-7 text-foreground/85 dark:border-white/10 dark:bg-white/[0.03]">
                {t('modal.sceneTemplate', { title: selectedCardTitle, desc: selectedCardDesc })}
              </div>
            </section>

            <section className="mb-8 border-t border-black/[0.06] pt-5 dark:border-white/10">
              <h3 className="mb-2 text-[18px] font-semibold text-foreground">Prompt</h3>
              <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-[14px] leading-7 text-foreground/85 dark:border-white/10 dark:bg-white/[0.03]">
                {selectedPrompt}
              </div>
            </section>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!selectedCard) return;
                  setComposerInspiration({
                    id: `inspiration-${selectedCard.id}-${Date.now()}`,
                    label: selectedCardTitle,
                    body: selectedPrompt,
                  });
                  setSelectedCardId(null);
                  navigate('/');
                }}
                className="rounded-full bg-black px-8 py-3 text-[14px] font-semibold text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                {t('modal.useNow')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Inspiration;
