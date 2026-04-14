/**
 * Right-side Agent 详情 panel (sheet).
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { getAgentUiExtras, setAgentUiExtras } from '@/lib/agent-ui-storage';
import { AGENT_AVATAR_GRADIENT_CLASSES } from '@/lib/agent-avatar-presets';
import logoSvg from '@/assets/logo.svg';
import { EditAgentInfoModal } from './EditAgentInfoModal';

const PERSONA_MAX = 1000;

function AgentPersonaSection({ agentId }: { agentId: string }) {
  const { t } = useTranslation('chat');
  const ex = getAgentUiExtras(agentId);
  const [personaDraft, setPersonaDraft] = useState(() => ex.persona);
  const [personaEditing, setPersonaEditing] = useState(false);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">{t('agentDetails.personaSection')}</span>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => {
            if (personaEditing) {
              setPersonaEditing(false);
            } else {
              setPersonaDraft(getAgentUiExtras(agentId).persona);
              setPersonaEditing(true);
            }
          }}
          aria-label={t('agentDetails.editPersona')}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {personaEditing ? (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              value={personaDraft}
              onChange={(e) => setPersonaDraft(e.target.value.slice(0, PERSONA_MAX))}
              className="min-h-[140px] resize-none rounded-xl border-black/10 text-[13px] dark:border-white/10"
              placeholder={t('agentDetails.personaPlaceholder')}
            />
            <span className="pointer-events-none absolute bottom-2 right-2 text-[11px] text-muted-foreground">
              {personaDraft.length}/{PERSONA_MAX}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setPersonaDraft(getAgentUiExtras(agentId).persona);
                setPersonaEditing(false);
              }}
            >
              {t('agentDetails.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setAgentUiExtras(agentId, { persona: personaDraft });
                setPersonaEditing(false);
                toast.success(t('agentDetails.personaSaved'));
              }}
            >
              {t('agentDetails.save')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="w-full rounded-xl border border-black/8 bg-black/[0.03] px-3 py-3 text-left text-[13px] leading-relaxed text-foreground/90 dark:border-white/10 dark:bg-white/5"
          onClick={() => {
            setPersonaDraft(getAgentUiExtras(agentId).persona);
            setPersonaEditing(true);
          }}
        >
          {getAgentUiExtras(agentId).persona.trim() ? getAgentUiExtras(agentId).persona : t('agentDetails.personaEmpty')}
        </button>
      )}
    </div>
  );
}

function normalizeAgentIdForMatch(id: string): string {
  return id.trim().toLowerCase() || 'main';
}

export function AgentDetailsSheet() {
  const { t } = useTranslation('chat');
  const open = useChatChromeStore((s) => s.agentPanelOpen);
  const setOpen = useChatChromeStore((s) => s.setAgentPanelOpen);
  const setEditOpen = useChatChromeStore((s) => s.setEditAgentInfoOpen);
  const setAddInspirationOpen = useChatChromeStore((s) => s.setAddInspirationOpen);
  const editInfoOpen = useChatChromeStore((s) => s.editAgentInfoOpen);
  const composerTargetAgentId = useChatChromeStore((s) => s.composerTargetAgentId);
  const agentPanelSubjectAgentId = useChatChromeStore((s) => s.agentPanelSubjectAgentId);

  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const defaultAgentId = useAgentsStore((s) => s.defaultAgentId);

  const displayAgentId =
    composerTargetAgentId ?? agentPanelSubjectAgentId ?? currentAgentId;

  const agent = useMemo(() => {
    const d = displayAgentId;
    return (
      agents.find((a) => a.id === d)
      ?? agents.find((a) => normalizeAgentIdForMatch(a.id) === normalizeAgentIdForMatch(d))
    );
  }, [agents, displayAgentId]);

  const extras = getAgentUiExtras(displayAgentId);

  const displayName = agent?.name ?? displayAgentId;
  const tagline = extras.tagline || agent?.modelDisplay || '';

  const showLogo =
    normalizeAgentIdForMatch(displayAgentId) === 'main'
    || normalizeAgentIdForMatch(displayAgentId) === normalizeAgentIdForMatch(defaultAgentId);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          data-testid="agent-details-sheet"
          className="flex w-full flex-col border-l border-black/10 p-0 dark:border-white/10 sm:max-w-[400px]"
        >
          <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-black/5 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <SheetTitle className="text-[15px] font-semibold">{t('agentDetails.sheetTitle')}</SheetTitle>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label={t('agentDetails.collapse')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex gap-3">
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-lg font-semibold text-white shadow-sm',
                  showLogo
                    ? 'from-red-500 to-red-600'
                    : AGENT_AVATAR_GRADIENT_CLASSES[extras.avatarIndex % AGENT_AVATAR_GRADIENT_CLASSES.length] ??
                      'from-slate-500 to-slate-700',
                )}
              >
                {showLogo ? (
                  <img src={logoSvg} alt="" className="h-9 w-9 object-contain brightness-0 invert" />
                ) : (
                  (displayName.charAt(0) || '?').toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-foreground">{displayName}</p>
                    {tagline ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{tagline}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                    onClick={() => setEditOpen(true)}
                    aria-label={t('agentDetails.editProfile')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <AgentPersonaSection key={displayAgentId} agentId={displayAgentId} />

            <div className="mt-8">
              <p className="mb-2 text-[14px] font-medium text-foreground">{t('agentDetails.inspirationSection')}</p>
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-2xl border border-dashed border-black/12 bg-black/[0.02] py-10 text-[14px] font-medium text-muted-foreground transition hover:bg-black/[0.04] dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                onClick={() => setAddInspirationOpen(true)}
              >
                {t('agentDetails.addInspiration')}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EditAgentInfoModal
        open={editInfoOpen}
        onOpenChange={setEditOpen}
        agentId={displayAgentId}
        initialName={displayName}
      />
    </>
  );
}
