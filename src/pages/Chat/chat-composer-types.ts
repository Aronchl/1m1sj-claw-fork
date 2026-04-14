import type { CronJob } from '@/types/cron';

export type ChatModelPreset = 'default' | 'custom_api' | 'coding_plan';

export type ComposerTaskSelection =
  | { kind: 'common'; id: string; label: string; body: string }
  | { kind: 'cron'; job: CronJob };
