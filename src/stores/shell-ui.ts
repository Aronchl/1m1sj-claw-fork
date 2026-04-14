/**
 * Shell UI: sidebar-triggered modals (feedback, WeChat connect).
 */
import { create } from 'zustand';

interface ShellUiState {
  feedbackModalOpen: boolean;
  wechatConnectModalOpen: boolean;
  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;
  openWechatConnectModal: () => void;
  closeWechatConnectModal: () => void;
}

export const useShellUiStore = create<ShellUiState>((set) => ({
  feedbackModalOpen: false,
  wechatConnectModalOpen: false,
  openFeedbackModal: () => set({ feedbackModalOpen: true }),
  closeFeedbackModal: () => set({ feedbackModalOpen: false }),
  openWechatConnectModal: () => set({ wechatConnectModalOpen: true }),
  closeWechatConnectModal: () => set({ wechatConnectModalOpen: false }),
}));
