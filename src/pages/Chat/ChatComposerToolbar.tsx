/**
 * Bottom toolbar for chat composer: model, skills, tasks/inspiration, common tools.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  ChevronDown,
  Link2,
  Puzzle,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGatewayStore } from '@/stores/gateway';
import { useSkillsStore } from '@/stores/skills';
import { useCronStore } from '@/stores/cron';
import { useProviderStore } from '@/stores/providers';
import { useSettingsUiStore } from '@/stores/settings-ui';
import type { Skill } from '@/types/skill';
import type { ChatModelPreset, ComposerTaskSelection } from './chat-composer-types';
import { ChatModelPresetDialog } from './ChatModelPresetDialog';
import { useTranslation } from 'react-i18next';

const pillClass =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-black/[0.06] px-3 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-black/[0.09] data-[state=open]:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] dark:data-[state=open]:bg-white/[0.12] disabled:opacity-50';

interface ChatComposerToolbarProps {
  disabled?: boolean;
  modelPreset: ChatModelPreset;
  onModelPresetChange: (p: ChatModelPreset) => void;
  selectedSkill: Skill | null;
  onSelectSkill: (skill: Skill | null) => void;
  selectedTask: ComposerTaskSelection | null;
  onSelectTask: (task: ComposerTaskSelection | null) => void;
  onApplyTaskBody: (body: string) => void;
  onInsertToolLine: (line: string) => void;
}

export function ChatComposerToolbar({
  disabled,
  modelPreset,
  onModelPresetChange,
  selectedSkill,
  onSelectSkill,
  selectedTask,
  onSelectTask,
  onApplyTaskBody,
  onInsertToolLine,
}: ChatComposerToolbarProps) {
  const { t } = useTranslation('chat');
  const gatewayRunning = useGatewayStore((s) => s.status.state === 'running');
  const skills = useSkillsStore((s) => s.skills);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const jobs = useCronStore((s) => s.jobs);
  const fetchJobs = useCronStore((s) => s.fetchJobs);
  const accounts = useProviderStore((s) => s.accounts);
  const defaultAccountId = useProviderStore((s) => s.defaultAccountId);
  const refreshProviders = useProviderStore((s) => s.refreshProviderSnapshot);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogKey, setModelDialogKey] = useState(0);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsListLoading, setSkillsListLoading] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');

  const commonTasks = useMemo(
    () => [
      {
        id: 'charity',
        label: t('composer.chrome.inspirationCharity'),
        body: t('composer.chrome.inspirationCharityBody'),
      },
      {
        id: 'startup',
        label: t('composer.chrome.inspirationStartup'),
        body: t('composer.chrome.inspirationStartupBody'),
      },
      {
        id: 'product',
        label: t('composer.chrome.inspirationProduct'),
        body: t('composer.chrome.inspirationProductBody'),
      },
    ],
    [t],
  );

  const toolItems = useMemo(
    () => [
      { id: 'portal', label: t('composer.chrome.toolPortal'), line: t('composer.chrome.toolPortalLine') },
      { id: 'community', label: t('composer.chrome.toolCommunity'), line: t('composer.chrome.toolCommunityLine') },
      { id: 'green_product', label: t('composer.chrome.toolGreenProduct'), line: t('composer.chrome.toolGreenProductLine') },
    ],
    [t],
  );

  useEffect(() => {
    if (modelDialogOpen) void refreshProviders();
  }, [modelDialogOpen, refreshProviders]);

  useEffect(() => {
    if (!skillsOpen || !gatewayRunning) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSkillsListLoading(true);
    });
    void fetchSkills().finally(() => {
      if (!cancelled) setSkillsListLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [skillsOpen, gatewayRunning, fetchSkills]);

  useEffect(() => {
    if (!tasksOpen || !gatewayRunning) return;
    void fetchJobs();
  }, [tasksOpen, gatewayRunning, fetchJobs]);

  const defaultAccount = accounts.find((a) => a.id === defaultAccountId);
  let modelLabel = t('composer.chrome.defaultModel');
  if (modelPreset === 'custom_api') modelLabel = t('composer.chrome.modelPillCustomApi');
  else if (modelPreset === 'coding_plan') modelLabel = t('composer.chrome.modelPillCodingPlan');
  else if (defaultAccount?.label) modelLabel = defaultAccount.label;

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const list = Array.isArray(skills) ? skills : [];
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q)
        || s.id.toLowerCase().includes(q)
        || (s.slug && s.slug.toLowerCase().includes(q)),
    );
  }, [skills, skillQuery]);

  const openSkillsManagement = useCallback(() => {
    setSkillsOpen(false);
    useSettingsUiStore.getState().openModal('skills');
  }, []);

  const selectCommonTask = useCallback(
    (id: string, label: string, body: string) => {
      onSelectTask({ kind: 'common', id, label, body });
      onApplyTaskBody(body);
    },
    [onApplyTaskBody, onSelectTask],
  );

  const selectCronTask = useCallback(
    (job: (typeof jobs)[number]) => {
      onSelectTask({ kind: 'cron', job });
      onApplyTaskBody(job.message || '');
    },
    [onApplyTaskBody, onSelectTask],
  );

  const openModelDialog = useCallback(() => {
    setSkillsOpen(false);
    setTasksOpen(false);
    setToolsOpen(false);
    void refreshProviders();
    setModelDialogKey((k) => k + 1);
    setModelDialogOpen(true);
  }, [refreshProviders]);

  const closeOtherMenus = useCallback((which: 'skills' | 'tasks' | 'tools') => {
    if (which !== 'skills') setSkillsOpen(false);
    if (which !== 'tasks') setTasksOpen(false);
    if (which !== 'tools') setToolsOpen(false);
  }, []);

  return (
    <>
      <div className="flex w-max min-w-0 flex-nowrap items-center gap-1.5">
        <div className="relative shrink-0">
          <button
            type="button"
            data-testid="chat-composer-model-pill"
            disabled={disabled}
            className={pillClass}
            onClick={openModelDialog}
          >
            <Box className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
            <span className="max-w-[88px] sm:max-w-[120px] truncate">{modelLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </div>

        <DropdownMenu
          modal={false}
          open={skillsOpen}
          onOpenChange={(open) => {
            setSkillsOpen(open);
            if (open) closeOtherMenus('skills');
            if (!open) setSkillQuery('');
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="chat-composer-skills-pill"
              disabled={disabled}
              className={cn(pillClass, selectedSkill && 'ring-1 ring-primary/25 bg-primary/5')}
            >
              <Puzzle className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
              <span className="max-w-[72px] sm:max-w-[100px] truncate">
                {selectedSkill ? selectedSkill.name : t('composer.chrome.skills')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="flex max-h-[min(20rem,50vh)] w-[min(100vw-2rem,280px)] flex-col overflow-hidden p-0"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div
              className="shrink-0 border-b border-black/5 p-2 dark:border-white/10"
              onPointerDown={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-2 rounded-full bg-black/[0.05] px-3 py-2 dark:bg-white/[0.06]">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
                  placeholder={t('composer.chrome.search')}
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {!gatewayRunning && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                  {t('composer.chrome.skillsNeedGateway')}
                </p>
              )}
              {gatewayRunning && skillsListLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  <span className="text-[12px]">{t('composer.chrome.skillsLoading')}</span>
                </div>
              )}
              {gatewayRunning && !skillsListLoading && filteredSkills.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                  {t('composer.chrome.noSkills')}
                </p>
              )}
              {gatewayRunning
                && !skillsListLoading
                && filteredSkills.map((skill) => (
                  <DropdownMenuItem
                    key={skill.id}
                    className="cursor-pointer gap-2 px-3 py-2 text-[13px]"
                    onSelect={() => {
                      onSelectSkill(skill);
                      setSkillQuery('');
                    }}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      {(skill.name || skill.id).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">{skill.slug || skill.name || skill.id}</span>
                  </DropdownMenuItem>
                ))}
            </div>
            <DropdownMenuSeparator className="shrink-0 bg-black/5 dark:bg-white/10" />
            <DropdownMenuItem
              className="shrink-0 cursor-pointer gap-2 py-2.5 text-[13px] font-medium"
              onSelect={() => {
                openSkillsManagement();
              }}
            >
              <Wrench className="h-4 w-4 text-muted-foreground" />
              {t('composer.chrome.skillManagement')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={tasksOpen}
          onOpenChange={(open) => {
            setTasksOpen(open);
            if (open) closeOtherMenus('tasks');
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="chat-composer-tasks-pill"
              disabled={disabled}
              className={cn(pillClass, selectedTask && 'ring-1 ring-primary/25 bg-primary/5')}
            >
              <Sparkles className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
              <span className="max-w-[72px] sm:max-w-[100px] truncate">
                {selectedTask
                  ? selectedTask.kind === 'cron'
                    ? selectedTask.job.name
                    : selectedTask.label
                  : t('composer.chrome.findInspiration')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[min(100vw-2rem,300px)] p-0 py-2">
            {selectedTask && (
              <>
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('composer.chrome.currentInspiration')}
                </p>
                <div className="mx-2 mb-2 rounded-xl border border-rose-400/25 bg-rose-500/5 px-3 py-2 dark:bg-rose-500/10">
                  <span className="text-[13px] font-medium text-foreground">
                    {selectedTask.kind === 'cron' ? selectedTask.job.name : selectedTask.label}
                  </span>
                </div>
              </>
            )}
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('composer.chrome.cronSection')}
            </p>
            {!gatewayRunning && (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">{t('composer.chrome.cronNeedGateway')}</p>
            )}
            {gatewayRunning && jobs.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">{t('composer.chrome.noCronJobs')}</p>
            )}
            {gatewayRunning
              && jobs.map((job) => (
                <DropdownMenuItem
                  key={job.id}
                  className="cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left"
                  onSelect={() => selectCronTask(job)}
                >
                  <span className="text-[13px] font-medium text-foreground">{job.name}</span>
                  {job.message ? (
                    <span className="line-clamp-2 text-[11px] text-muted-foreground">{job.message}</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator className="my-2 bg-black/5 dark:bg-white/10" />
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('composer.chrome.commonTasksSection')}
            </p>
            {commonTasks.map((task) => (
              <DropdownMenuItem
                key={task.id}
                className="cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left"
                onSelect={() => selectCommonTask(task.id, task.label, task.body)}
              >
                <span className="text-[13px] font-medium text-foreground">{task.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={toolsOpen}
          onOpenChange={(open) => {
            setToolsOpen(open);
            if (open) closeOtherMenus('tools');
          }}
        >
          <DropdownMenuTrigger asChild>
            <button type="button" data-testid="chat-composer-tools-pill" disabled={disabled} className={pillClass}>
              <Link2 className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
              <span className="max-w-[80px] sm:max-w-[120px] truncate">{t('composer.chrome.commonTools')}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 p-1">
            {toolItems.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                className="cursor-pointer px-3 py-2.5 text-[13px]"
                onSelect={() => onInsertToolLine(tool.line)}
              >
                {tool.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChatModelPresetDialog
        key={modelDialogKey}
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        value={modelPreset}
        onConfirm={onModelPresetChange}
      />
    </>
  );
}
