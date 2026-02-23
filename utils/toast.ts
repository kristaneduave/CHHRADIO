import { ToastKind, ToastMessage } from '../types';

const TOAST_EVENT = 'chh-toast-event';

type ToastPayload = Omit<ToastMessage, 'id'> & { id?: string };

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const pushToast = (message: Omit<ToastMessage, 'id'>) => {
  if (typeof window === 'undefined') return;
  const payload: ToastMessage = { ...message, id: makeId() };
  window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, { detail: payload }));
};

export const toastSuccess = (title: string, description?: string) => {
  pushToast({ kind: 'success', title, description });
};

export const toastError = (title: string, description?: string) => {
  pushToast({ kind: 'error', title, description });
};

export const toastInfo = (title: string, description?: string) => {
  pushToast({ kind: 'info', title, description });
};

export const subscribeToToasts = (handler: (message: ToastMessage) => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => {
    const custom = event as CustomEvent<ToastPayload>;
    if (!custom.detail) return;
    const { id, kind, title, description } = custom.detail;
    if (!kind || !title) return;
    handler({ id: id || makeId(), kind: kind as ToastKind, title, description });
  };

  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
};
