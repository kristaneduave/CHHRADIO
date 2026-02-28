import React, { useState } from 'react';
import { CurrentWorkstationStatus } from '../types';

interface WorkstationActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workstation: CurrentWorkstationStatus | null;
  currentUserId: string;
  onOpenAssign: () => void;
  onClaim: (workstationId: string) => Promise<void>;
  onUpdateStatus: (workstationId: string, message: string | null) => Promise<void>;
  onRelease: (workstationId: string) => Promise<void>;
}

const PRESET_MESSAGES = ['Deep Work 🎧', 'Coffee Break ☕', 'Lunch 🍱', 'Available 🟢', 'BRB 5 mins ⏳'];

const WorkstationActionModal: React.FC<WorkstationActionModalProps> = ({
  isOpen,
  onClose,
  workstation,
  currentUserId,
  onOpenAssign,
  onClaim,
  onUpdateStatus,
  onRelease,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  if (!isOpen || !workstation) return null;

  const isAvailable = workstation.status === 'AVAILABLE';
  const isMine = workstation.status === 'IN_USE' && workstation.occupant_id === currentUserId;
  const isOthers = workstation.status === 'IN_USE' && workstation.occupant_id !== currentUserId;
  const isOffline = workstation.status === 'OFFLINE' || workstation.status === 'OUT_OF_SERVICE';

  const handleClaim = async () => {
    setIsSubmitting(true);
    try {
      await onClaim(workstation.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ? `Failed to claim workstation: ${err.message}` : 'Failed to claim workstation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (message: string | null) => {
    setIsSubmitting(true);
    try {
      await onUpdateStatus(workstation.id, message);
      setCustomMessage('');
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ? `Failed to update status: ${err.message}` : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm('Are you sure you want to release this workstation?')) return;
    setIsSubmitting(true);
    try {
      await onRelease(workstation.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ? `Failed to release workstation: ${err.message}` : 'Failed to release workstation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0 bg-app/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-[#0f1621] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        <div className="p-5 border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex justify-between items-center relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-icons text-cyan-400">desktop_windows</span>
                {workstation.label}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{workstation.section || 'General Area'}</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            >
              <span className="material-icons text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {isAvailable && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2">
                <span className="material-icons text-3xl text-emerald-400">check_circle</span>
              </div>
              <p className="text-sm text-slate-300">This workstation is currently available and ready to claim.</p>

              <button
                onClick={handleClaim}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-[15px] transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Sit Here'}
              </button>
              <button
                onClick={onOpenAssign}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold transition-colors"
              >
                Assign Colleague
              </button>
            </div>
          )}

          {isMine && (
            <div className="space-y-5">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Set Status</h4>

                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_MESSAGES.map((message) => (
                    <button
                      key={message}
                      onClick={() => handleUpdateStatus(message)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[11px] font-semibold text-slate-200 transition-colors"
                    >
                      {message}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value.substring(0, 20))}
                    placeholder="Custom status (max 20 chars)"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customMessage.trim()) {
                        handleUpdateStatus(customMessage.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => handleUpdateStatus(customMessage.trim() || null)}
                    disabled={isSubmitting}
                    className="px-4 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-dark transition-colors"
                  >
                    Set
                  </button>
                </div>
              </div>

              <button
                onClick={handleRelease}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[14px] border border-rose-500/20 transition-colors"
              >
                Release Workstation
              </button>
              <button
                onClick={onOpenAssign}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold transition-colors"
              >
                Re-assign Occupancy
              </button>
            </div>
          )}

          {isOthers && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="material-icons text-3xl text-rose-400">lock</span>
              </div>
              <p className="text-sm text-slate-300">
                Currently occupied by <strong className="text-white">{workstation.occupant_name}</strong>
              </p>
              {workstation.status_message && (
                <div className="inline-block bg-slate-800 border border-white/10 px-4 py-2 rounded-2xl">
                  <span className="text-sm font-semibold text-white">{workstation.status_message}</span>
                </div>
              )}
            </div>
          )}

          {isOffline && (
            <div className="text-center py-4">
              <span className="material-icons text-4xl text-slate-600 mb-2">wifi_off</span>
              <p className="text-sm text-slate-400">This workstation is offline or out of service.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkstationActionModal;
