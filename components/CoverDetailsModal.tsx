import React from 'react';
import { CoverEntry, LogEntry } from './ManageCoversModal';
import { Profile } from '../types';

interface CoverDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    slotId: string;
    covers: CoverEntry[];
    originalDoctor: string;
    timeSlot: string;
    profiles: Record<string, Profile>;
    currentUser: any;
    onToggleStatus: (e: React.MouseEvent, slotId: string, coverId: string, field: 'informed' | 'read') => void;
    onAddLog: (slotId: string, coverId: string, message: string) => void;
    onEdit: (e: React.MouseEvent) => void;
}

const CoverDetailsModal: React.FC<CoverDetailsModalProps> = ({
    isOpen,
    onClose,
    slotId,
    covers,
    originalDoctor,
    timeSlot,
    profiles,
    currentUser,
    onToggleStatus,
    onAddLog,
    onEdit
}) => {
    if (!isOpen) return null;

    // Aggregate all logs from active covers
    const allLogs = covers.flatMap(c => c.logs || [])
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-white">Cover Details</h2>
                        <p className="text-xs text-slate-400">{timeSlot} • {originalDoctor}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* Covering Doctors List */}
                    <div className="space-y-4">
                        {covers.map((cover) => {
                            const isId = cover.informedBy && cover.informedBy.includes('-');
                            const profile = isId ? profiles[cover.informedBy!] : null;
                            const informedName = profile?.nickname || profile?.full_name || cover.informedBy;

                            return (
                                <div key={cover.id} className="glass-card-enhanced rounded-xl p-4 border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Edit Individual Cover Button if needed later */}
                                    </div>

                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-base font-bold text-white tracking-wide">{cover.doctorName}</span>
                                            {cover.scope !== 'All' && (
                                                <span className="text-[10px] text-slate-400 font-medium bg-white/5 px-2 py-0.5 rounded-full border border-white/5 self-start mt-1">
                                                    {cover.scope}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <button
                                            onClick={(e) => onToggleStatus(e, slotId, cover.id, 'informed')}
                                            className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-lg border transition-all duration-300 ${cover.informed
                                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="material-icons text-xl">
                                                {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {cover.informed ? 'Informed' : 'Mark Informed'}
                                            </span>
                                        </button>

                                        <button
                                            onClick={(e) => onToggleStatus(e, slotId, cover.id, 'read')}
                                            className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-lg border transition-all duration-300 ${cover.readStatus === 'complete'
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                                                : cover.readStatus === 'partial'
                                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="material-icons text-xl">
                                                {cover.readStatus === 'complete' ? 'check_circle' : cover.readStatus === 'partial' ? 'hourglass_top' : 'radio_button_unchecked'}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {cover.readStatus === 'complete' ? 'Read' : cover.readStatus === 'partial' ? 'Partial' : 'Unread'}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Informed By User Display */}
                                    {cover.informed && (
                                        <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Informed by</span>
                                            <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={informedName || ''} className="w-4 h-4 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                                                        {(informedName?.charAt(0) || '?')}
                                                    </div>
                                                )}
                                                <span className="text-[10px] text-slate-300 font-bold">{informedName}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Consolidated Logbook */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-icons text-slate-500 text-sm">history</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Log</span>
                        </div>

                        <div className="space-y-3 mb-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {allLogs.length === 0 ? (
                                <div className="text-xs text-slate-600 italic text-center py-4 border border-dashed border-white/5 rounded-lg">
                                    No activity recorded yet.<br />Type below to add a note.
                                </div>
                            ) : (
                                allLogs.map((log, lIdx) => (
                                    <div key={`${log.timestamp}-${lIdx}`} className="flex gap-3 text-xs group">
                                        <div className="flex flex-col items-end min-w-[50px] pt-0.5">
                                            <span className="text-slate-500 text-[10px] whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="flex-1 bg-white/5 p-2 rounded-lg rounded-tl-none border border-white/5 group-hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-rose-400 font-bold text-[10px] uppercase tracking-wide">{log.userName}</span>
                                            </div>
                                            <p className="text-slate-300 leading-relaxed text-[11px]">{log.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Note Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Type a note and press Enter..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500/50 focus:bg-black/60 transition-all placeholder:text-slate-600"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (covers.length > 0) {
                                            onAddLog(slotId, covers[0].id, e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                            <span className="material-icons absolute right-3 top-2.5 text-slate-600 text-xs pointer-events-none">Subdirectory_arrow_left</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 bg-white/5 flex gap-3">
                    <button
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl transition-all font-medium text-sm"
                    >
                        <span className="material-icons text-sm">edit</span>
                        Manage Covers
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoverDetailsModal;
