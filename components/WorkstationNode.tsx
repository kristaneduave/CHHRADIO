import React from 'react';
import { CurrentWorkstationStatus } from '../types';

interface WorkstationNodeProps {
    workstation: CurrentWorkstationStatus;
    isSelected?: boolean;
    currentUserId: string;
    onClick: (ws: CurrentWorkstationStatus) => void;
}

const getInitial = (name?: string | null): string => {
    const trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
};

const WorkstationNode: React.FC<WorkstationNodeProps> = ({ workstation, isSelected, currentUserId, onClick }) => {
    const isAvailable = workstation.status === 'AVAILABLE';
    const isMine = workstation.status === 'IN_USE' && workstation.occupant_id === currentUserId;
    const isOthers = workstation.status === 'IN_USE' && workstation.occupant_id !== currentUserId;
    const isOffline = workstation.status === 'OFFLINE' || workstation.status === 'OUT_OF_SERVICE';

    // Determine styles based on state
    let borderClass = 'border-white/10';
    let bgClass = 'bg-white/[0.03] hover:bg-white/[0.06]';
    let glowClass = '';

    if (isAvailable) {
        borderClass = 'border-emerald-500/20';
        bgClass = 'bg-emerald-500/5 hover:bg-emerald-500/10';
    } else if (isMine) {
        borderClass = 'border-primary/30';
        bgClass = 'bg-primary/10 hover:bg-primary/20';
        glowClass = 'shadow-[0_0_15px_rgba(13,162,231,0.15)]';
    } else if (isOthers) {
        borderClass = 'border-rose-500/20';
        bgClass = 'bg-rose-500/5 hover:bg-rose-500/10';
    } else if (isOffline) {
        borderClass = 'border-slate-500/20';
        bgClass = 'bg-slate-500/5 opacity-60';
    }

    return (
        <button
            onClick={() => onClick(workstation)}
            className={`relative w-full text-left p-3 rounded-2xl border ${borderClass} ${bgClass} ${glowClass} transition-all duration-300 group flex items-center gap-3 ${isSelected ? 'ring-2 ring-white/20' : ''}`}
        >
            {/* Profile / Status Icon */}
            <div className={`relative shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-black/40 border overflow-hidden ${isOffline ? 'border-slate-700' : isMine ? 'border-primary' : isOthers ? 'border-rose-500/50' : 'border-emerald-500/30'}`}>
                {isAvailable && (
                    <>
                        <span className="w-2.5 h-2.5 rounded bg-emerald-400 absolute bottom-0.5 right-0.5 z-10 border border-black shadow-[2px_2px_0_rgba(0,0,0,0.5)]"></span>
                        <span className="material-icons text-emerald-300 text-[20px]">desktop_windows</span>
                    </>
                )}

                {workstation.status === 'IN_USE' ? (
                    <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${isMine ? 'text-primary' : 'text-rose-400'}`}>
                        {getInitial(workstation.occupant_name)}
                    </div>
                ) : null}

                {isOffline && (
                    <span className="material-icons text-slate-600 text-[20px]">wifi_off</span>
                )}
            </div>

            {/* Label and Details */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{workstation.label}</h4>
                {isAvailable && <p className="text-xs text-emerald-400">Available</p>}
                {workstation.status === 'IN_USE' && <p className="text-xs text-slate-400 truncate">{workstation.occupant_name}</p>}
                {isOffline && <p className="text-xs text-slate-500">Offline</p>}
            </div>

        </button>
    );
};

export default WorkstationNode;
