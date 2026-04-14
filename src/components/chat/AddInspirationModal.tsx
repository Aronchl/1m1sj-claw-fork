/**
 * "添加灵感" — same grid/categories as Inspiration Square, in a dialog.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Newspaper, FileText, Calendar, FolderOpen, Plane, Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { toast } from 'sonner';

type CategoryId = 'all' | 'office' | 'study' | 'fun' | 'life' | 'media' | 'finance';

const CARDS = [
  { id: '1', category: 'office' as const, icon: 'newspaper' as const, titleKey: 'cards.hotNews.title', descKey: 'cards.hotNews.desc' },
  { id: '2', category: 'office' as const, icon: 'invoice' as const, titleKey: 'cards.invoice.title', descKey: 'cards.invoice.desc' },
  { id: '3', category: 'study' as const, icon: 'calendar' as const, titleKey: 'cards.studyPlan.title', descKey: 'cards.studyPlan.desc' },
  { id: '4', category: 'office' as const, icon: 'folder' as const, titleKey: 'cards.docs.title', descKey: 'cards.docs.desc' },
  { id: '5', category: 'life' as const, icon: 'bell' as const, titleKey: 'cards.routine.title', descKey: 'cards.routine.desc' },
  { id: '6', category: 'fun' as const, icon: 'plane' as const, titleKey: 'cards.travel.title', descKey: 'cards.travel.desc' },
] as const;

export function AddInspirationModal() {
  const { t } = useTranslation('inspiration');
  const { t: tChat } = useTranslation('chat');
  const open = useChatChromeStore((s) => s.addInspirationOpen);
  const setOpen = useChatChromeStore((s) => s.setAddInspirationOpen);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setActiveCategory('all');
  };

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

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return CARDS;
    return CARDS.filter((c) => c.category === activeCategory);
  }, [activeCategory]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="add-inspiration-modal"
        className="max-h-[90vh] w-[min(100vw-1.5rem,56rem)] max-w-4xl overflow-hidden rounded-2xl border-black/10 p-0 dark:border-white/10"
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <DialogTitle className="text-[17px] font-semibold">{tChat('addInspiration.title')}</DialogTitle>
          <DialogDescription className="sr-only">{tChat('addInspiration.title')}</DialogDescription>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
            aria-label={tChat('addInspiration.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-64px)] overflow-y-auto px-5 pb-5 pt-3">
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                  activeCategory === c.id
                    ? 'bg-foreground text-background'
                    : 'bg-black/[0.04] text-foreground/70 hover:bg-black/[0.07] dark:bg-white/10',
                )}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{t('emptyCategory')}</p>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((card) => (
              <div
                key={card.id}
                className="relative flex flex-col rounded-2xl border border-black/[0.06] bg-card p-3 shadow-sm dark:border-white/10"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/10">
                    {card.icon === 'newspaper' && <Newspaper className="h-4 w-4 text-foreground/80" />}
                    {card.icon === 'invoice' && <FileText className="h-4 w-4 text-foreground/80" />}
                    {card.icon === 'calendar' && <Calendar className="h-4 w-4 text-foreground/80" />}
                    {card.icon === 'folder' && <FolderOpen className="h-4 w-4 text-foreground/80" />}
                    {card.icon === 'bell' && <Bell className="h-4 w-4 text-foreground/80" />}
                    {card.icon === 'plane' && <Plane className="h-4 w-4 text-foreground/80" />}
                  </div>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow-sm hover:opacity-90"
                    onClick={() => {
                      toast.success(tChat('addInspiration.pinnedToast'));
                      setOpen(false);
                    }}
                    aria-label={tChat('addInspiration.add')}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <h3 className="mb-1 text-[14px] font-semibold leading-snug text-foreground">{t(card.titleKey)}</h3>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
              </div>
            ))}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
