import { useEffect, useState } from 'react';

export type AppViewport = 'mobile' | 'tablet' | 'desktop';

const DESKTOP_MEDIA_QUERY = '(min-width: 1280px)';
const TABLET_MEDIA_QUERY = '(min-width: 768px)';

export const getAppViewport = (): AppViewport => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'mobile';
  }

  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
    return 'desktop';
  }

  if (window.matchMedia(TABLET_MEDIA_QUERY).matches) {
    return 'tablet';
  }

  return 'mobile';
};

export const useAppViewport = (): AppViewport => {
  const [viewport, setViewport] = useState<AppViewport>(getAppViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const tabletQuery = window.matchMedia(TABLET_MEDIA_QUERY);
    const syncViewport = () => setViewport(getAppViewport());

    syncViewport();
    desktopQuery.addEventListener('change', syncViewport);
    tabletQuery.addEventListener('change', syncViewport);

    return () => {
      desktopQuery.removeEventListener('change', syncViewport);
      tabletQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  return viewport;
};
