import { create } from 'zustand';

export interface ComposerInspiration {
  id: string;
  label: string;
  body: string;
}

interface ChatChromeState {
  agentPanelOpen: boolean;
  /**
   * Sidebar: last agent row/chevron interacted with. Cleared when `currentSessionKey` changes.
   * Lets the details sheet reflect the agent the user clicked even before switching sessions.
   */
  agentPanelSubjectAgentId: string | null;
  /** Composer @-target agent; mirrored from ChatInput for AgentDetailsSheet. */
  composerTargetAgentId: string | null;
  editAgentInfoOpen: boolean;
  addInspirationOpen: boolean;
  composerInspiration: ComposerInspiration | null;
  setAgentPanelOpen: (open: boolean) => void;
  toggleAgentPanel: () => void;
  setAgentPanelSubjectAgentId: (id: string | null) => void;
  setComposerTargetAgentId: (id: string | null) => void;
  setEditAgentInfoOpen: (open: boolean) => void;
  setAddInspirationOpen: (open: boolean) => void;
  setComposerInspiration: (inspiration: ComposerInspiration | null) => void;
  clearComposerInspiration: () => void;
}

export const useChatChromeStore = create<ChatChromeState>((set, get) => ({
  agentPanelOpen: false,
  agentPanelSubjectAgentId: null,
  composerTargetAgentId: null,
  editAgentInfoOpen: false,
  addInspirationOpen: false,
  composerInspiration: null,
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  toggleAgentPanel: () => set({ agentPanelOpen: !get().agentPanelOpen }),
  setAgentPanelSubjectAgentId: (id) => set({ agentPanelSubjectAgentId: id }),
  setComposerTargetAgentId: (id) => set({ composerTargetAgentId: id }),
  setEditAgentInfoOpen: (open) => set({ editAgentInfoOpen: open }),
  setAddInspirationOpen: (open) => set({ addInspirationOpen: open }),
  setComposerInspiration: (inspiration) => set({ composerInspiration: inspiration }),
  clearComposerInspiration: () => set({ composerInspiration: null }),
}));
