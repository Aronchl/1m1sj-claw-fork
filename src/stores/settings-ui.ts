/**
 * Ephemeral UI state for the settings modal (not persisted).
 */
import { create } from 'zustand';

export type SettingsModalSection =
  | 'general'
  | 'app'
  | 'models'
  | 'agents'
  | 'channels'
  | 'skills'
  | 'cron'
  | 'about';

/** Hash-router paths that should open the settings modal (then redirect to `/`). */
export const LEGACY_PATH_TO_SETTINGS_MODAL: Record<string, SettingsModalSection> = {
  '/models': 'models',
  '/agents': 'agents',
  '/channels': 'channels',
  '/skills': 'skills',
  '/cron': 'cron',
};

interface SettingsUiState {
  open: boolean;
  section: SettingsModalSection;
  openModal: (section?: SettingsModalSection) => void;
  closeModal: () => void;
  setSection: (section: SettingsModalSection) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  open: false,
  section: 'general',
  openModal: (section = 'general') => set({ open: true, section }),
  closeModal: () => set({ open: false }),
  setSection: (section) => set({ section }),
}));
