/**
 * About ClawNode — version, website, legal (used in Settings modal "About" section).
 */
import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '@/stores/update';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import logoSvg from '@/assets/logo.svg';
import { OFFICIAL_SITE_URL } from '@/lib/official-site';

export function AboutSettingsPanel() {
  const { t } = useTranslation('settings');
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateStatus = useUpdateStore((state) => state.status);
  const updateInit = useUpdateStore((state) => state.init);

  useEffect(() => {
    void updateInit();
  }, [updateInit]);

  const showUpdateAvailable = updateStatus === 'available' || updateStatus === 'downloaded';

  return (
    <div data-testid="about-settings-panel" className="px-6 py-6 pb-10 max-w-3xl">
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-muted/20 p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-card">
            <img src={logoSvg} alt="" className="h-10 w-auto" />
          </div>
          <p className="text-lg font-semibold text-foreground">{t('about.appName')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('about.tagline')}</p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-background p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-foreground">
                {t('aboutUi.currentVersionLabel', { version: currentVersion })}
              </span>
              {showUpdateAvailable && (
                <Badge className="rounded-full border-0 bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-400">
                  {t('aboutUi.updateAvailable')}
                </Badge>
              )}
            </div>
          </div>
          <Separator className="bg-black/5 dark:bg-white/10" />
          <div className="space-y-5 rounded-2xl border border-black/5 bg-background p-4 dark:border-white/10">
            <p className="text-[14px] font-medium text-foreground">{t('updates.title')}</p>
            <UpdateSettings />
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-background px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.04]"
            onClick={() => window.electron.openExternal(OFFICIAL_SITE_URL)}
          >
            <span>{t('aboutUi.enterWebsite')}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground hover:underline underline-offset-4"
            onClick={() => window.electron.openExternal(OFFICIAL_SITE_URL)}
          >
            {t('aboutUi.terms')}
          </button>
          <span aria-hidden className="text-muted-foreground/50">
            |
          </span>
          <button
            type="button"
            className="hover:text-foreground hover:underline underline-offset-4"
            onClick={() => window.electron.openExternal(OFFICIAL_SITE_URL)}
          >
            {t('aboutUi.privacy')}
          </button>
        </div>
        <p className="mt-4 text-center text-[12px] text-muted-foreground">{t('about.basedOn')}</p>
      </div>
    </div>
  );
}
