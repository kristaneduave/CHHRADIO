import React from 'react';
import ReactDOM from 'react-dom';
import { CoverEntry, LogEntry } from './ManageCoversModal';
import { Profile } from '../types';
const SCOPE_ALL = 'All';
const SCOPE_REMAINING = 'Remaining studies';

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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-app/90 backdrop-blur-md animate-in fade-in duration-300 p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#0B101A] border border-white/5 rounded-[2rem] sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 bg-black/40 border-b border-white/5 relative overflow-hidden shrink-0 flex items-center justify-between">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10">
                        <h2 className="text-xl font-bold text-white tracking-wide">COVER DETAILS</h2>
                        <div className="text-[13px] text-slate-400 mt-1.5 flex items-center gap-2 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            {timeSlot}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors relative z-10"
                    >
                        <span className="material-icons text-[16px]">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">

                    {/* Covering Doctors List */}
                    <div className="space-y-3">
                        {covers.map((cover) => {
                            const isId = cover.informedBy && cover.informedBy.includes('-');
                            const profile = isId ? profiles[cover.informedBy!] : null;
                            const informedName = profile?.nickname || profile?.full_name || cover.informedBy;

                            return (
                                <div key={cover.id} className="bg-black/40 rounded-2xl p-4 border border-white/5 relative overflow-hidden group hover:bg-white/[0.03] transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner flex items-center justify-center shrink-0">
                                                <span className="material-icons text-[20px]">person</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Covering Doctor</span>
                                                <span className="text-[15px] font-bold text-white tracking-wide leading-tight">{cover.doctorName}</span>
                                                {cover.scope !== SCOPE_ALL && (
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mt-1 ${cover.scope === SCOPE_REMAINING
                                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                        : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                                                        }`}>
                                                        Scope: {cover.scope}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Informed By - Minimalist Pill */}
                                        {cover.informed && (
                                            <div className="flex items-center gap-1.5 bg-white/5 pl-1 pr-2.5 py-1 rounded-full border border-white/10 shadow-sm" title={`Informed by ${informedName}`}>
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={informedName || ''} className="w-5 h-5 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase shadow-sm">
                                                        {(profile?.nickname?.charAt(0) || profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || cover.informedBy?.charAt(0) || '?')}
                                                    </div>
                                                )}
                                                <span className="text-[11px] text-slate-300 font-bold max-w-[80px] truncate">
                                                    {profile?.nickname || profile?.full_name?.split(' ')[0] || profile?.username || cover.informedBy}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Controls - Minimalist Row */}
                                    <div className="flex items-center gap-2.5 border-t border-white/5 pt-3 mt-1">
                                        {/* Informed Toggle */}
                                        <button
                                            onClick={(e) => onToggleStatus(e, slotId, cover.id, 'informed')}
                                            className={`flex-[1.5] py-2 px-3 rounded-xl border transition-all duration-300 flex items-center justify-center gap-2 outline-none focus:ring-2 focus:ring-sky-500/40 ${cover.informed
                                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
                                                : 'bg-white/5 border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="material-icons text-[16px]">
                                                {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                                            </span>
                                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                                {cover.informed ? 'Informed' : 'Inform'}
                                            </span>
                                        </button>

                                        {/* Read Status Segmented Control */}
                                        <div className="flex-[2] flex bg-white/5 rounded-xl border border-white/5 p-1 h-[38px]">
                                            <button
                                                onClick={(e) => onToggleStatus(e, slotId, cover.id, 'read')}
                                                className={`w-full h-full rounded-lg flex items-center justify-center gap-1.5 transition-all outline-none focus:ring-2 focus:ring-sky-500/40 ${cover.readStatus === 'complete' ? 'bg-emerald-500/15 text-emerald-400 shadow-sm' :
                                                    cover.readStatus === 'partial' ? 'bg-amber-500/15 text-amber-400 shadow-sm' :
                                                        'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                    }`}
                                            >
                                                <span className="material-icons text-[16px]">
                                                    {cover.readStatus === 'complete' ? 'check_circle' : cover.readStatus === 'partial' ? 'hourglass_top' : 'radio_button_unchecked'}
                                                </span>
                                                <span className="text-[11px] font-bold uppercase tracking-wider">
                                                    {cover.readStatus === 'complete' ? 'Read' : cover.readStatus === 'partial' ? 'Partial' : 'Unread'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Improved Activity Log */}
                    <div className="pt-5 border-t border-white/5 mt-3 flex-1 flex flex-col min-h-0 relative">
                        <div className="flex items-center gap-2.5 mb-3 px-1 shrink-0">
                            <span className="material-icons text-sky-400 text-[18px]">forum</span>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Activity Log</span>
                        </div>

                        <div className="relative pl-1 pr-1 space-y-3 mb-4 flex-1 overflow-y-auto custom-scrollbar">
                            {allLogs.length === 0 ? (
                                <div className="text-[12px] text-slate-500 italic py-6 text-center border-2 border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                                    No activity recorded.
                                </div>
                            ) : (
                                allLogs.map((log, lIdx) => (
                                    <div key={`${log.timestamp}-${lIdx}`} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 shadow-sm">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-bold text-sky-400">{log.userName}</span>
                                            <span className="text-[10px] text-slate-500 font-medium">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-[13px] text-slate-300 leading-relaxed break-words">{log.message}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Chat Input */}
                        <div className="relative flex gap-2.5 pt-4 border-t border-white/5 shrink-0">
                            <input
                                type="text"
                                placeholder="Add a note..."
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const input = e.currentTarget as HTMLInputElement;
                                        if (input.value.trim() && covers.length > 0) {
                                            onAddLog(slotId, covers[0].id, input.value.trim());
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                            <button
                                className="bg-sky-500 hover:bg-sky-400 text-white rounded-xl px-4 py-2 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] disabled:opacity-50"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    if (input.value.trim() && covers.length > 0) {
                                        onAddLog(slotId, covers[0].id, input.value.trim());
                                        input.value = '';
                                    }
                                }}
                            >
                                <span className="material-icons text-[18px]">send</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-white/5 bg-black/40 flex gap-2 shrink-0 items-center">
                    <button
                        onClick={onEdit}
                        className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-[13px] tracking-wide shadow-[0_4px_20px_-4px_rgba(14,165,233,0.5)] transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-icons text-[18px]">edit_note</span>
                        Manage / Reset
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CoverDetailsModal;
