/**
 * Chat composer — large model preset picker (UI aligned with product mock).
 * Custom API / Coding Plan embeds the same provider UI as Settings → Models.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { cn } from '@/lib/utils';
import type { ChatModelPreset } from './chat-composer-types';
import { useTranslation } from 'react-i18next';

interface ChatModelPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ChatModelPreset;
  onConfirm: (next: ChatModelPreset) => void;
}

export function ChatModelPresetDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: ChatModelPresetDialogProps) {
  const { t } = useTranslation('chat');
  const [draft, setDraft] = useState<ChatModelPreset>(value);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setDraft(value);
    });
  }, [open, value]);

  const showCustomConfig = draft === 'custom_api' || draft === 'coding_plan';

  const options: Array<{ id: ChatModelPreset; label: string }> = [
    { id: 'default', label: t('composer.chrome.modelOptionDefault') },
    { id: 'custom_api', label: t('composer.chrome.modelOptionCustomApi') },
    { id: 'coding_plan', label: t('composer.chrome.modelOptionCodingPlan') },
  ];

  const handleConfirm = () => {
    onConfirm(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="chat-model-preset-dialog"
        className={cn(
          'flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-2xl border border-black/10 p-0 shadow-xl dark:border-white/10',
          showCustomConfig
            ? 'w-[min(100vw-1.5rem,42rem)] max-w-2xl'
            : 'w-[min(100vw-2rem,36rem)] max-w-xl',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <DialogTitle className="text-base font-semibold text-foreground">
            {t('composer.chrome.modelDialogTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('composer.chrome.modelDisclaimer')}</DialogDescription>
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 space-y-1 px-5 py-4">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                draft === opt.id && 'bg-black/[0.04] dark:bg-white/[0.06]',
              )}
            >
              <input
                type="radio"
                name="chat-model-preset"
                className="mt-1 h-4 w-4 accent-foreground"
                checked={draft === opt.id}
                onChange={() => setDraft(opt.id)}
              />
              <span className="text-[14px] font-medium leading-snug text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>

        <p className="shrink-0 px-5 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          {t('composer.chrome.modelDisclaimer')}
        </p>

        {showCustomConfig && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-black/5 dark:border-white/10">
            <p className="shrink-0 px-5 py-2 text-[12px] leading-snug text-muted-foreground">
              {t('composer.chrome.modelCustomConfigHint')}
            </p>
            <div className="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
              <ProvidersSettings variant="embedded" />
            </div>
          </div>
        )}

        <div className="flex shrink-0 justify-center gap-3 border-t border-black/5 px-5 py-4 dark:border-white/10">
          <Button
            type="button"
            className="h-10 min-w-[100px] rounded-full bg-foreground text-background hover:bg-foreground/90"
            onClick={handleConfirm}
          >
            {t('composer.chrome.confirm')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[100px] rounded-full border-black/15 bg-background dark:border-white/15"
            onClick={() => onOpenChange(false)}
          >
            {t('composer.chrome.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
