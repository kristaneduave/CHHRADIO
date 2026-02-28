import React, { useMemo, useState } from 'react';
import { CurrentWorkstationStatus } from '../types';

interface OccupantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  workstation: CurrentWorkstationStatus | null;
  onRelease: (workstationId: string) => Promise<void>;
}

const OccupantProfileModal: React.FC<OccupantProfileModalProps> = ({
  isOpen,
  onClose,
  workstation,
  onRelease,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const expiresText = useMemo(() => {
    if (!workstation?.expires_at) return null;
    const date = new Date(workstation.expires_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [workstation?.expires_at]);

  if (!isOpen || !workstation) return null;

  const handleRelease = async () => {
    if (!confirm('Release this workstation occupancy?')) return;
    setSubmitting(true);
    try {
      await onRelease(workstation.id);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to release workstation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0 bg-app/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#0f1621] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Occupant Details</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400">
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            {workstation.occupant_avatar_url ? (
              <img
                src={workstation.occupant_avatar_url}
                alt={workstation.occupant_name || 'Occupant'}
                className="h-12 w-12 rounded-full object-cover border border-white/20"
              />
            ) : (
              <span className="h-12 w-12 rounded-full bg-slate-700/80 border border-white/20 flex items-center justify-center text-sm font-bold text-slate-200">
                {(workstation.occupant_name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-100 truncate">{workstation.occupant_name || 'Unknown'}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wide">
                {workstation.occupant_role || 'Member'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs text-slate-400">Workstation</p>
            <p className="text-sm font-semibold text-white">{workstation.label}</p>
            {workstation.section && <p className="text-xs text-slate-400">{workstation.section}</p>}
            <p className="text-xs text-slate-400">
              Mode: <span className="text-slate-200">{workstation.occupancy_mode || 'self'}</span>
            </p>
            {workstation.status_message && (
              <p className="text-xs text-slate-400">
                Status: <span className="text-slate-200">{workstation.status_message}</span>
              </p>
            )}
            {expiresText && (
              <p className="text-xs text-amber-300">Auto-expires: {expiresText}</p>
            )}
          </div>

          <button
            onClick={handleRelease}
            disabled={submitting}
            className="w-full rounded-xl border border-rose-500/25 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {submitting ? 'Clearing...' : 'Clear Colleague from Workstation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OccupantProfileModal;
