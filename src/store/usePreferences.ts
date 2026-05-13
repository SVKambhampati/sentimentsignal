import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '../api/preferences';
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences,
} from '../api/preferences';

interface PreferencesState extends UserPreferences {
  loaded: boolean;
  /** Load from API (for logged-in users) or fall back to localStorage defaults */
  load:   () => Promise<void>;
  /** Optimistically update locally AND persist to API */
  set:    (patch: Partial<UserPreferences>) => Promise<void>;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, _get) => ({
      ...DEFAULT_PREFERENCES,
      loaded: false,

      load: async () => {
        try {
          const remote = await getPreferences();
          set({ ...remote, loaded: true });
        } catch {
          set({ loaded: true });
        }
      },

      set: async (patch) => {
        // Optimistic local update
        set(patch as Partial<PreferencesState>);
        try {
          const updated = await updatePreferences(patch);
          set({ ...updated });
        } catch {
          // Keep local value on failure — still persisted to localStorage
        }
      },
    }),
    { name: 'sentiment-signal-prefs' }
  )
);

// ─── Apply CSS variables + density class whenever preferences change ─────────
export function applyPreferences(prefs: UserPreferences) {
  const root = document.documentElement;

  // Migrate: old green default → new cyan default
  const accentColor = prefs.accent_color === '#22c55e' ? '#22d3ee' : prefs.accent_color;

  // Accent color
  root.style.setProperty('--accent', accentColor);

  // Derive dim + subtle variants from accent hex
  const hex = accentColor.replace('#', '');
  const r   = parseInt(hex.slice(0, 2), 16);
  const g   = parseInt(hex.slice(2, 4), 16);
  const b   = parseInt(hex.slice(4, 6), 16);
  root.style.setProperty('--accent-dim',    `rgba(${r},${g},${b},0.08)`);
  root.style.setProperty('--accent-subtle', `rgba(${r},${g},${b},0.05)`);

  // Density class
  root.classList.toggle('density-compact',     prefs.density === 'compact');
  root.classList.toggle('density-comfortable', prefs.density === 'comfortable');
}
