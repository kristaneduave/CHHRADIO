import React, { useEffect, useState } from 'react';
import { ToastMessage } from '../types';
import { subscribeToToasts } from '../utils/toast';

const TOAST_TTL_MS = 4200;

const styleByKind: Record<ToastMessage['kind'], string> = {
  success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  error: 'border-red-500/35 bg-red-500/10 text-red-100',
  info: 'border-blue-500/35 bg-blue-500/10 text-blue-100',
};

const iconByKind: Record<ToastMessage['kind'], string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToToasts((message) => {
      setToasts((prev) => [message, ...prev].slice(0, 4));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== message.id));
      }, TOAST_TTL_MS);
    });
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[1000] flex w-[min(90vw,380px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${styleByKind[toast.kind]}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="material-icons text-base">{iconByKind[toast.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-xs opacity-90">{toast.description}</p> : null}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
              aria-label="Dismiss notification"
            >
              <span className="material-icons text-sm">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
