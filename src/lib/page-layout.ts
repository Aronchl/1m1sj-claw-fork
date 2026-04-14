import { cn } from '@/lib/utils';

export type PageLayout = 'page' | 'modal';

/** Root shell for full-page vs settings-modal embedding */
export function pageShellClass(layout: PageLayout): string {
  return layout === 'modal'
    ? 'flex flex-col min-h-0 h-full max-h-full overflow-hidden dark:bg-background'
    : 'flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden';
}

export function pageInnerClass(layout: PageLayout): string {
  return cn(
    'w-full max-w-5xl mx-auto flex flex-col h-full min-h-0',
    layout === 'modal' ? 'p-4 pt-2 pb-4' : 'p-10 pt-16',
  );
}

export function pageLoadingShellClass(layout: PageLayout): string {
  return layout === 'modal'
    ? 'flex flex-col min-h-0 h-full max-h-full items-center justify-center dark:bg-background'
    : 'flex flex-col -m-6 dark:bg-background min-h-[calc(100vh-2.5rem)] items-center justify-center';
}
