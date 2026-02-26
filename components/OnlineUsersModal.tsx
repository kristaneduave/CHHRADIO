import React from 'react';
import { NewsfeedOnlineUser } from '../types';

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: NewsfeedOnlineUser[];
  loading: boolean;
  error: string | null;
}

const OnlineUsersModal: React.FC<OnlineUsersModalProps> = ({ isOpen, onClose, users, loading, error }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0 bg-app/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#0f1621] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-12 rounded-full bg-white/20" />
        </div>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Who&apos;s Online</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400">
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>
        <div className="p-5 max-h-[62vh] overflow-y-auto space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Checking online users...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-400">No one is online right now.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="h-9 w-9 rounded-full object-cover border border-white/15" />
                ) : (
                  <span className="h-9 w-9 rounded-full bg-slate-700/80 border border-white/15 flex items-center justify-center text-xs font-bold text-slate-200">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{user.displayName}</p>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide">{user.role || 'Member'}</p>
                </div>
                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              </div>
            ))
          )}
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default OnlineUsersModal;
