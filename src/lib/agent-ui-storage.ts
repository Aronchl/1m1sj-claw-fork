/**
 * Local UI-only agent metadata (tagline, persona draft, avatar pick).
 * Not synced to OpenClaw agent config until backend supports it.
 */
export type AgentUiExtras = {
  tagline: string;
  persona: string;
  /** 0–8 = preset ring; -1 = none */
  avatarIndex: number;
};

const KEY = 'clawx.agentUi.v1';

function readAll(): Record<string, AgentUiExtras> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AgentUiExtras>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getAgentUiExtras(agentId: string): AgentUiExtras {
  const all = readAll();
  return (
    all[agentId] ?? {
      tagline: '',
      persona: '',
      avatarIndex: 0,
    }
  );
}

export function setAgentUiExtras(agentId: string, patch: Partial<AgentUiExtras>): AgentUiExtras {
  const all = readAll();
  const next = { ...getAgentUiExtras(agentId), ...patch };
  all[agentId] = next;
  localStorage.setItem(KEY, JSON.stringify(all));
  return next;
}
