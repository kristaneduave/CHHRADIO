import { useEffect, useState } from 'react';

export const NETWORK_RESTORED_EVENT = 'radcore-network-restored';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [hasReconnected, setHasReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const handleOffline = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      setHasReconnected(false);
      setIsOnline(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      setHasReconnected(true);
      window.dispatchEvent(new CustomEvent(NETWORK_RESTORED_EVENT));
      reconnectTimer = setTimeout(() => setHasReconnected(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, hasReconnected };
};
