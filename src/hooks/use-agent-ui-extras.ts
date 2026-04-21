import { useSyncExternalStore } from 'react';
import {
  getAgentUiExtras,
  getAgentUiStoreVersion,
  subscribeAgentUi,
  type AgentUiExtras,
} from '@/lib/agent-ui-storage';

/** Subscribes to local agent UI storage so avatar / tagline updates re-render. */
export function useAgentUiExtras(agentId: string): AgentUiExtras {
  useSyncExternalStore(
    subscribeAgentUi,
    () => getAgentUiStoreVersion(),
    () => 0,
  );
  return getAgentUiExtras(agentId);
}
