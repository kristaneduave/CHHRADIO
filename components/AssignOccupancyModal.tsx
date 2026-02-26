import React, { useEffect, useState } from 'react';
import { AssignOccupancyPayload, AssignableOccupant } from '../types';

interface AssignOccupancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (payload: AssignOccupancyPayload) => Promise<void>;
  onSearchUsers: (query: string) => Promise<AssignableOccupant[]>;
}

const AssignOccupancyModal: React.FC<AssignOccupancyModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  onSearchUsers,
}) => {
  const [mode, setMode] = useState<'assigned_user' | 'assigned_external'>('assigned_user');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssignableOccupant[]>([]);
  const [selectedUser, setSelectedUser] = useState<AssignableOccupant | null>(null);
  const [externalName, setExternalName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || mode !== 'assigned_user') return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let active = true;
    setLoadingUsers(true);
    onSearchUsers(trimmed)
      .then((items) => {
        if (!active) return;
        setResults(items);
      })
      .catch((error) => {
        console.error(error);
        if (!active) return;
        setResults([]);
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, mode, onSearchUsers, query]);

  if (!isOpen) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'assigned_user') {
        if (!selectedUser) {
          alert('Please select a user.');
          setSubmitting(false);
          return;
        }
        await onAssign({
          mode,
          occupantUserId: selectedUser.id,
          statusMessage: statusMessage.trim() || null,
        });
      } else {
        if (!externalName.trim()) {
          alert('Please enter a name.');
          setSubmitting(false);
          return;
        }
        await onAssign({
          mode,
          occupantDisplayName: externalName.trim(),
          statusMessage: statusMessage.trim() || null,
        });
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Failed to assign workstation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0 bg-app/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#0f1621] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Assign Occupancy</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400">
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMode('assigned_user');
                setSelectedUser(null);
              }}
              className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                mode === 'assigned_user'
                  ? 'border-primary/45 bg-primary/15 text-primary-light'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              App User
            </button>
            <button
              onClick={() => setMode('assigned_external')}
              className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                mode === 'assigned_external'
                  ? 'border-primary/45 bg-primary/15 text-primary-light'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              External Name
            </button>
          </div>

          {mode === 'assigned_user' ? (
            <div className="space-y-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search user name..."
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary/60"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {loadingUsers ? (
                  <p className="text-xs text-slate-400">Searching users...</p>
                ) : results.length === 0 ? (
                  <p className="text-xs text-slate-500">No users found.</p>
                ) : (
                  results.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-primary/40 bg-primary/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-200">{user.displayName}</p>
                      <p className="text-[11px] text-slate-400 uppercase">{user.role || 'member'}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <input
              value={externalName}
              onChange={(event) => setExternalName(event.target.value)}
              placeholder="Consultant / external name"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary/60"
            />
          )}

          <input
            value={statusMessage}
            onChange={(event) => setStatusMessage(event.target.value.slice(0, 40))}
            placeholder="Optional status message"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-primary/60"
          />

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-xl border border-primary/40 bg-primary/20 py-2.5 text-sm font-semibold text-primary-light hover:bg-primary/30 disabled:opacity-50"
          >
            {submitting ? 'Assigning...' : 'Set as Occupied'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignOccupancyModal;
