/**
 * storage.ts
 *
 * Local storage persistence for user preferences:
 * - Player names
 * - Selected favorite color
 * - Sound effects preference
 * - Selected game mode
 * No secrets stored.
 */

import { PlayerColor, GameMode } from '@/engine';

export interface UserPreferences {
  playerName: string;
  playerColor: PlayerColor;
  mode: GameMode;
  soundEnabled: boolean;
  player2Name?: string;
  player3Name?: string;
  player4Name?: string;
}

const STORAGE_KEY = 'ludo_user_preferences_v1';

const DEFAULT_PREFERENCES: UserPreferences = {
  playerName: 'Player 1',
  playerColor: 'red',
  mode: '1v1',
  soundEnabled: false,
  player2Name: 'Player 2',
  player3Name: 'Player 3',
  player4Name: 'Player 4',
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save preferences to localStorage', e);
  }
}
