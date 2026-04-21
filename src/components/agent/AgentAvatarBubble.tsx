import { cn } from '@/lib/utils';
import { AGENT_AVATAR_GRADIENT_CLASSES, AGENT_AVATAR_PRESET_COUNT } from '@/lib/agent-avatar-presets';
import { useAgentUiExtras } from '@/hooks/use-agent-ui-extras';

type Props = {
  agentId: string;
  displayName: string;
  className?: string;
};

export function AgentAvatarBubble({ agentId, displayName, className }: Props) {
  const extras = useAgentUiExtras(agentId);
  const idx =
    extras.avatarIndex >= 0 && extras.avatarIndex < AGENT_AVATAR_PRESET_COUNT
      ? extras.avatarIndex
      : 0;
  const gradient =
    AGENT_AVATAR_GRADIENT_CLASSES[idx] ?? 'from-slate-500 to-slate-700';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white shadow-sm',
        'h-9 w-9 text-[13px]',
        gradient,
        className,
      )}
    >
      {initial}
    </div>
  );
}
