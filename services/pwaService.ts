const getBuildVersion = () =>
  String(import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || import.meta.env.VITE_APP_BUILD_VERSION || 'local');

export const registerRadcoreServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (import.meta.env.DEV) return null;

  try {
    return await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(getBuildVersion())}`, {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.warn('PWA shell registration failed. The portal remains available online.', error);
    return null;
  }
};

export const APP_BUILD_VERSION = getBuildVersion();
