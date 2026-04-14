/**
 * Secondary settings dialog: left nav + scrollable content (settings + feature pages).
 */
import { useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { X, SlidersHorizontal, Monitor, Cpu, Bot, Network, Puzzle, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsUiStore, type SettingsModalSection } from '@/stores/settings-ui';
import { SettingsContent } from '@/pages/Settings';
import { Models } from '@/pages/Models';
import { Agents } from '@/pages/Agents';
import { Channels } from '@/pages/Channels';
import { Skills } from '@/pages/Skills';
import { Cron } from '@/pages/Cron';
import { AboutSettingsPanel } from '@/components/settings/AboutSettingsPanel';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function sectionTitle(section: SettingsModalSection, tSettings: (k: string) => string, tCommon: (k: string) => string): string {
  switch (section) {
    case 'general':
      return tSettings('modal.navGeneral');
    case 'app':
      return tSettings('modal.navApp');
    case 'models':
      return tCommon('sidebar.models');
    case 'agents':
      return tCommon('sidebar.agents');
    case 'channels':
      return tCommon('sidebar.channels');
    case 'skills':
      return tCommon('sidebar.skills');
    case 'cron':
      return tCommon('sidebar.cronTasks');
    case 'about':
      return tSettings('modal.navAbout');
    default:
      return tSettings('modal.title');
  }
}

export function SettingsModal() {
  const { t: tSettings } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const open = useSettingsUiStore((s) => s.open);
  const section = useSettingsUiStore((s) => s.section);
  const closeModal = useSettingsUiStore((s) => s.closeModal);
  const setSection = useSettingsUiStore((s) => s.setSection);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    },
    [closeModal],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onKeyDown]);

  const primaryNav = useMemo(
    () =>
      [
        { id: 'general' as const, icon: <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />, label: tSettings('modal.navGeneral') },
        { id: 'app' as const, icon: <Monitor className="h-[18px] w-[18px]" strokeWidth={2} />, label: tSettings('modal.navApp') },
      ] satisfies Array<{ id: SettingsModalSection; icon: ReactNode; label: string }>,
    [tSettings],
  );

  const featureNav = useMemo(
    () =>
      [
        { id: 'models' as const, icon: <Cpu className="h-[18px] w-[18px]" strokeWidth={2} />, label: tCommon('sidebar.models') },
        { id: 'agents' as const, icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2} />, label: tCommon('sidebar.agents') },
        { id: 'channels' as const, icon: <Network className="h-[18px] w-[18px]" strokeWidth={2} />, label: tCommon('sidebar.channels') },
        { id: 'skills' as const, icon: <Puzzle className="h-[18px] w-[18px]" strokeWidth={2} />, label: tCommon('sidebar.skills') },
        { id: 'cron' as const, icon: <Clock className="h-[18px] w-[18px]" strokeWidth={2} />, label: tCommon('sidebar.cronTasks') },
      ] satisfies Array<{ id: SettingsModalSection; icon: ReactNode; label: string }>,
    [tCommon],
  );

  const aboutNav = useMemo(
    () =>
      [
        {
          id: 'about' as const,
          icon: <Info className="h-[18px] w-[18px]" strokeWidth={2} />,
          label: tSettings('modal.navAbout'),
        },
      ] satisfies Array<{ id: SettingsModalSection; icon: ReactNode; label: string }>,
    [tSettings],
  );

  if (!open) return null;

  const title = sectionTitle(section, tSettings, tCommon);

  const renderBody = () => {
    if (section === 'general' || section === 'app') {
      return <SettingsContent section={section} />;
    }
    switch (section) {
      case 'models':
        return <Models layout="modal" />;
      case 'agents':
        return <Agents layout="modal" />;
      case 'channels':
        return <Channels layout="modal" />;
      case 'skills':
        return <Skills layout="modal" />;
      case 'cron':
        return <Cron layout="modal" />;
      case 'about':
        return <AboutSettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label={tSettings('modal.close')}
        onClick={closeModal}
      />
      <div
        className={cn(
          'relative flex w-full max-w-[min(94vw,880px)] h-[min(82vh,600px)] overflow-hidden rounded-[20px] border border-black/[0.06] dark:border-white/10',
          'bg-background shadow-2xl',
        )}
      >
        {/* Left nav */}
        <aside className="flex h-full min-h-0 w-[176px] shrink-0 flex-col border-r border-black/[0.06] dark:border-white/10 bg-muted/40 dark:bg-muted/20">
          <div className="px-3 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{tSettings('modal.title')}</h2>
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-3">
            {primaryNav.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`settings-modal-nav-${item.id}`}
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                  'text-foreground/75 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                  section === item.id && 'bg-black/[0.07] dark:bg-white/10 text-foreground',
                )}
              >
                <span className={cn('shrink-0', section === item.id ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            <Separator className="my-2 bg-black/10 dark:bg-white/10" />

            {featureNav.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`settings-modal-nav-${item.id}`}
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                  'text-foreground/75 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                  section === item.id && 'bg-black/[0.07] dark:bg-white/10 text-foreground',
                )}
              >
                <span className={cn('shrink-0', section === item.id ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            <Separator className="my-2 bg-black/10 dark:bg-white/10" />

            {aboutNav.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`settings-modal-nav-${item.id}`}
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                  'text-foreground/75 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                  section === item.id && 'bg-black/[0.07] dark:bg-white/10 text-foreground',
                )}
              >
                <span className={cn('shrink-0', section === item.id ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="flex shrink-0 items-center justify-between border-b border-black/[0.06] dark:border-white/10 px-4 py-3">
            <h3 id="settings-modal-title" className="text-[15px] font-semibold text-foreground">
              {title}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0"
              data-testid="settings-modal-close"
              onClick={closeModal}
              aria-label={tSettings('modal.close')}
            >
              <X className="h-5 w-5" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{renderBody()}</div>
        </div>
      </div>
    </div>
  );
}
