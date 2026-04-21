/**
 * Right-side Agent 详情 panel (sheet).
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pencil, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useChatChromeStore } from '@/stores/chat-chrome';
import { AgentAvatarBubble } from '@/components/agent/AgentAvatarBubble';
import { hostApiFetch } from '@/lib/host-api';
import { EditAgentInfoModal } from './EditAgentInfoModal';

function AgentIdentitySection({ agentId }: { agentId: string }) {
  const { t } = useTranslation('chat');
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await hostApiFetch<{ success?: boolean; content?: string; missing?: boolean }>(
          `/api/agents/${encodeURIComponent(agentId)}/identity-md`,
        );
        if (cancelled) return;
        setText(typeof res?.content === 'string' ? res.content : '');
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <div className="mt-6" data-testid="agent-details-identity-section">
      <div className="mb-2">
        <span className="text-[14px] font-medium text-foreground">{t('agentDetails.personaSection')}</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t('agentDetails.identityFromFile')}</p>
      </div>
      {phase === 'loading' ? (
        <p className="text-[13px] text-muted-foreground">{t('agentDetails.identityLoading')}</p>
      ) : null}
      {phase === 'error' ? (
        <p className="text-[13px] text-destructive">{t('agentDetails.identityError')}</p>
      ) : null}
      {phase === 'ready' ? (
        <div className="max-h-[min(50vh,22rem)] overflow-y-auto rounded-xl border border-black/8 bg-black/[0.03] px-3 py-3 text-left dark:border-white/10 dark:bg-white/5">
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground/90">
            {text.trim() ? text : t('agentDetails.identityEmpty')}
          </pre>
        </div>
      ) : null}
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

  const displayAgentId =
    composerTargetAgentId ?? agentPanelSubjectAgentId ?? currentAgentId;

  const agent = useMemo(() => {
    const d = displayAgentId;
    return (
      agents.find((a) => a.id === d)
      ?? agents.find((a) => normalizeAgentIdForMatch(a.id) === normalizeAgentIdForMatch(d))
    );
  }, [agents, displayAgentId]);

  const displayName = agent?.name ?? displayAgentId;
  const subtitle = (agent?.modelDisplay || '').trim();

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
              <AgentAvatarBubble
                agentId={displayAgentId}
                displayName={displayName}
                className="h-14 w-14 text-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-foreground">{displayName}</p>
                    {subtitle ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{subtitle}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    data-testid="agent-details-edit-profile"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                    onClick={() => setEditOpen(true)}
                    aria-label={t('agentDetails.editProfile')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <AgentIdentitySection key={displayAgentId} agentId={displayAgentId} />

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
