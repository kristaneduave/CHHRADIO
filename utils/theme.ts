import { useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'chh_theme_preference';
const THEME_EVENT = 'chh-theme-changed';

const isThemePreference = (value: string | null): value is ThemePreference => {
  return value === 'system' || value === 'light' || value === 'dark';
};

export const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'dark';
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(raw) ? raw : 'dark';
};

export const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference === 'system') return getSystemTheme();
  return preference;
};

export const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
};

const writeThemePreference = (preference: ThemePreference) => {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: preference }));
};

export const useThemePreference = () => {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const resolvedTheme = useMemo(() => resolveTheme(preference), [preference]);

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      if (getStoredThemePreference() === 'system') {
        applyThemePreference('system');
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setPreference(getStoredThemePreference());
      }
    };

    const onThemeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ThemePreference>;
      if (customEvent.detail) {
        setPreference(customEvent.detail);
      }
    };

    media.addEventListener('change', onSystemThemeChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent);

    return () => {
      media.removeEventListener('change', onSystemThemeChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent);
    };
  }, []);

  const updatePreference = (nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    writeThemePreference(nextPreference);
  };

  return {
    preference,
    resolvedTheme,
    setPreference: updatePreference,
  };
};
