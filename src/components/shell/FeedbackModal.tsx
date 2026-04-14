/**
 * Static feedback form (UI showcase; submit shows toast only).
 */
import { useState } from 'react';
import { X, Upload, Crop } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useShellUiStore } from '@/stores/shell-ui';

const MAX_LEN = 1000;

export function FeedbackModal() {
  const { t } = useTranslation('settings');
  const open = useShellUiStore((s) => s.feedbackModalOpen);
  const closeFeedbackModal = useShellUiStore((s) => s.closeFeedbackModal);
  const [text, setText] = useState('');
  const [allowLogs, setAllowLogs] = useState(true);

  const len = text.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeFeedbackModal(); }}>
      <DialogContent
        data-testid="feedback-modal"
        className="max-h-[90vh] w-[min(100vw-2rem,36rem)] max-w-xl overflow-y-auto rounded-2xl border-black/10 p-0 dark:border-white/10"
      >
        <div className="relative border-b border-black/5 px-5 pb-4 pt-4 dark:border-white/10">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            onClick={() => closeFeedbackModal()}
            aria-label={t('modal.close')}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mb-2 text-[15px] font-medium text-foreground">{t('feedback.title')}</p>
          <DialogTitle className="pr-10 text-left text-xl font-semibold leading-snug tracking-tight text-foreground">
            {t('feedback.headline')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('feedback.placeholder')}</DialogDescription>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder={t('feedback.placeholder')}
              className="min-h-[180px] resize-none rounded-xl border-0 bg-[#f5f5f5] dark:bg-white/5 text-[14px] leading-relaxed placeholder:text-muted-foreground/70"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] text-muted-foreground">
              {len}/{MAX_LEN}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl border-black/10 bg-white text-[13px] dark:border-white/10"
              onClick={() => toast.info(t('feedback.toastUploadNotImplemented'))}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {t('feedback.uploadMedia')}
            </Button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-medium text-primary hover:underline"
              onClick={() => toast.info(t('feedback.toastScreenshotNotImplemented'))}
            >
              <Crop className="h-4 w-4" />
              {t('feedback.quickScreenshot')}
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-snug text-foreground/90">
            <input
              type="checkbox"
              checked={allowLogs}
              onChange={(e) => setAllowLogs(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 accent-primary"
            />
            <span>{t('feedback.allowLogs')}</span>
          </label>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              className="h-10 min-w-[120px] rounded-full bg-foreground/80 px-6 text-background hover:bg-foreground/90"
              onClick={() => {
                toast.success(t('feedback.toastSubmitted'));
                closeFeedbackModal();
                setText('');
              }}
            >
              {t('feedback.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
