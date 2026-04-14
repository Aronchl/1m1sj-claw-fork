/**
 * Edit agent name / tagline / avatar (local UI + name via API).
 */
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { getAgentUiExtras, setAgentUiExtras } from '@/lib/agent-ui-storage';
import { AGENT_AVATAR_GRADIENT_CLASSES, AGENT_AVATAR_PRESET_COUNT } from '@/lib/agent-avatar-presets';

const NAME_MAX = 10;
const TAGLINE_MAX = 15;
const AVATAR_PRESETS = AGENT_AVATAR_PRESET_COUNT;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  initialName: string;
};

function EditAgentInfoModalBody({
  agentId,
  initialName,
  onClose,
}: {
  agentId: string;
  initialName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('chat');
  const { t: tSettings } = useTranslation('settings');
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const ex = getAgentUiExtras(agentId);
  const [name, setName] = useState(() => initialName.slice(0, NAME_MAX));
  const [tagline, setTagline] = useState(() => ex.tagline.slice(0, TAGLINE_MAX));
  const [avatarIndex, setAvatarIndex] = useState(() =>
    ex.avatarIndex >= 0 && ex.avatarIndex < AGENT_AVATAR_PRESET_COUNT ? ex.avatarIndex : 0,
  );

  const save = async () => {
    const n = name.trim();
    if (!n) {
      toast.error(t('agentEdit.nameRequired'));
      return;
    }
    try {
      await updateAgent(agentId, n);
      setAgentUiExtras(agentId, {
        tagline: tagline.trim().slice(0, TAGLINE_MAX),
        avatarIndex,
      });
      await fetchAgents();
      toast.success(t('agentEdit.saved'));
      onClose();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
        <DialogTitle className="text-[17px] font-semibold">{t('agentEdit.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('agentEdit.title')}</DialogDescription>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onClose}
          aria-label={tSettings('modal.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">
            {t('agentEdit.nameLabel')}
            <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              className="h-11 rounded-xl pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
              {name.length}/{NAME_MAX}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">
            {t('agentEdit.taglineLabel')}
            <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              value={tagline}
              maxLength={TAGLINE_MAX}
              onChange={(e) => setTagline(e.target.value.slice(0, TAGLINE_MAX))}
              className="h-11 rounded-xl pr-14"
              placeholder={t('agentEdit.taglinePlaceholder')}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
              {tagline.length}/{TAGLINE_MAX}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] text-foreground">
            {t('agentEdit.avatarLabel')}
            <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: AVATAR_PRESETS }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAvatarIndex(i)}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white shadow-sm ring-2 ring-offset-2 ring-offset-background transition',
                    AGENT_AVATAR_GRADIENT_CLASSES[i] ?? 'from-gray-400 to-gray-600',
                  avatarIndex === i ? 'ring-primary' : 'ring-transparent',
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-black/15 text-muted-foreground dark:border-white/20"
              onClick={() => toast.info(t('agentEdit.avatarUploadSoon'))}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t('agentEdit.cancel')}
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()}>
            {t('agentEdit.save')}
          </Button>
        </div>
      </div>
    </>
  );
}

export function EditAgentInfoModal({ open, onOpenChange, agentId, initialName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="edit-agent-info-modal"
        className="w-[min(100vw-2rem,36rem)] max-w-xl rounded-2xl border-black/10 p-0 dark:border-white/10"
      >
        <EditAgentInfoModalBody
          key={`${agentId}-${initialName}`}
          agentId={agentId}
          initialName={initialName}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
