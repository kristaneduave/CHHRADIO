import React, { useMemo, useState } from 'react';
import { CurrentWorkstationStatus } from '../types';

import CharacterProfileCard from './CharacterProfileCard';

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
      <div className="relative z-10 w-full md:max-w-xl bg-transparent overflow-hidden">
        {/* We use a transparent background here because CharacterProfileCard handles its own frosted background */}

        <div className="flex justify-center pt-2.5 sm:hidden absolute top-0 left-0 w-full z-20">
          <span className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        <div className="p-4 sm:p-0 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-50 h-8 w-8 rounded-full bg-black/50 border border-white/10 hover:bg-white/10 text-slate-400 flex items-center justify-center backdrop-blur-md"
          >
            <span className="material-icons text-[20px]">close</span>
          </button>

          <CharacterProfileCard workstation={workstation} />

          <div className="mt-4 px-1">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-2">
              <span><span className="font-bold text-slate-300">Station:</span> {workstation.label} ({workstation.section})</span>
              {expiresText && <span className="text-amber-500/80">Expires: {expiresText}</span>}
            </div>

            <button
              onClick={handleRelease}
              disabled={submitting}
              className="w-full rounded-xl border border-rose-500/25 bg-rose-500/10 py-3 text-sm font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors uppercase tracking-widest flex justify-center items-center gap-2"
            >
              <span className="material-icons text-[18px]">eject</span>
              {submitting ? 'Clearing...' : 'Clear Colleague from Workstation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupantProfileModal;
