import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const ConnectivityStatus: React.FC = () => {
  const { isOnline, hasReconnected } = useOnlineStatus();
  if (isOnline && !hasReconnected) return null;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[120] flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold shadow-lg ${
        isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="material-icons text-[16px]" aria-hidden="true">
        {isOnline ? 'wifi' : 'wifi_off'}
      </span>
      {isOnline ? 'Back online. Refreshing available data.' : 'Offline. Your unfinished case will remain saved on this device.'}
    </div>
  );
};

export default ConnectivityStatus;
