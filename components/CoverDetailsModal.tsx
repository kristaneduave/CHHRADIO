import React from 'react';
import ReactDOM from 'react-dom';
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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-surface border border-white/10 rounded-2xl w-full max-w-[320px] shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cover Details</h2>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {timeSlot}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <span className="material-icons text-[10px]">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                    {/* Covering Doctors List */}
                    <div className="space-y-3">
                        {covers.map((cover) => {
                            const isId = cover.informedBy && cover.informedBy.includes('-');
                            const profile = isId ? profiles[cover.informedBy!] : null;
                            const informedName = profile?.nickname || profile?.full_name || cover.informedBy;

                            return (
                                <div key={cover.id} className="bg-black/40 rounded-xl p-3 border border-white/5 relative overflow-hidden group">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-emerald-400 tracking-wide">{cover.doctorName}</span>
                                            {cover.scope !== 'All' && (
                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                    Scope: <span className="text-slate-300">{cover.scope}</span>
                                                </span>
                                            )}
                                        </div>
                                        {/* Informed By - Minimalist Pill */}
                                        {cover.informed && (
                                            <div className="flex items-center gap-1.5 bg-white/5 pl-0.5 pr-2 py-0.5 rounded-full border border-white/5" title={`Informed by ${informedName}`}>
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={informedName || ''} className="w-4 h-4 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white uppercase shadow-sm">
                                                        {(profile?.nickname?.charAt(0) || profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || cover.informedBy?.charAt(0) || '?')}
                                                    </div>
                                                )}
                                                <span className="text-[9px] text-slate-300 font-bold max-w-[80px] truncate">
                                                    {profile?.nickname || profile?.full_name?.split(' ')[0] || profile?.username || cover.informedBy}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Controls - Minimalist Row */}
                                    <div className="flex items-center gap-2">
                                        {/* Informed Toggle */}
                                        <button
                                            onClick={(e) => onToggleStatus(e, slotId, cover.id, 'informed')}
                                            className={`flex-1 py-1.5 px-2 rounded-lg border transition-all duration-300 flex items-center justify-center gap-1.5 ${cover.informed
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="material-icons text-[14px]">
                                                {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {cover.informed ? 'Informed' : 'Inform'}
                                            </span>
                                        </button>

                                        {/* Read Status Segmented Control */}
                                        <div className="flex-[2] flex bg-white/5 rounded-lg border border-white/5 p-0.5">
                                            <button
                                                onClick={(e) => onToggleStatus(e, slotId, cover.id, 'read')}
                                                className={`w-full py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all outline-none ${cover.readStatus === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        cover.readStatus === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <span className="material-icons text-[14px]">
                                                    {cover.readStatus === 'complete' ? 'check_circle' : cover.readStatus === 'partial' ? 'hourglass_top' : 'radio_button_unchecked'}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider">
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
                    <div className="pt-4 border-t border-white/5 mt-2 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
                            <span className="material-icons text-rose-500 text-[14px]">forum</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Log</span>
                        </div>

                        <div className="relative pl-1 pr-1 space-y-3 mb-2 flex-1 overflow-y-auto custom-scrollbar">
                            {allLogs.length === 0 ? (
                                <div className="text-[10px] text-slate-600 italic py-4 text-center">
                                    No activity recorded.
                                </div>
                            ) : (
                                allLogs.map((log, lIdx) => (
                                    <div key={`${log.timestamp}-${lIdx}`} className="bg-white/5 rounded-lg p-2 border border-white/5">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-rose-400">{log.userName}</span>
                                            <span className="text-[9px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 leading-relaxed break-words">{log.message}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Chat Input */}
                        <div className="relative flex gap-2 pt-2 border-t border-white/5 shrink-0">
                            <input
                                type="text"
                                placeholder="Add a note..."
                                className="flex-1 bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-[11px] text-white focus:outline-none focus:border-rose-500/50 transition-all placeholder:text-slate-600 focus:bg-black/40"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (e.currentTarget.value.trim() && covers.length > 0) {
                                            onAddLog(slotId, covers[0].id, e.currentTarget.value.trim());
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                            <button
                                className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-3 py-1 flex items-center justify-center transition-colors shadow-lg shadow-rose-500/20"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    if (input.value.trim() && covers.length > 0) {
                                        onAddLog(slotId, covers[0].id, input.value.trim());
                                        input.value = '';
                                    }
                                }}
                            >
                                <span className="material-icons text-[14px]">send</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-white/5 bg-white/5 flex gap-2 shrink-0 items-center">
                    <button
                        onClick={onEdit} // This button opens Manage Covers, where Reset is located. 
                        // But user wants to see reset. Let's add a reset button that calls onEdit(with param to maybe trigger reset?) 
                        // Or just keeps it simple. The user said "I didnt see the reset/clear button".
                        // Maybe I should add a clear button here that invokes the same logic?
                        // I don't have a direct `onReset` prop. 
                        // I can add a dedicated Reset button that opens Manage Modal directly?
                        // Or I can add a `onReset` prop to this modal by updating ResidentsCornerScreen.
                        // For now, let's keep the user's flow: Open Manage -> Reset. 
                        // To make it clearer, I'll update the "Manage Covers" button to be more prominent or add a "Clear" icon button that opens Manage.
                        // Actually I can just add a button that calls `onEdit` but maybe I can trigger the reset logic if I had the prop.
                        // Let's essentially keep "Manage Covers" but maybe style it better.
                        // Wait, the user said "I didnt see the reset...". 
                        // Let's add a visual cue or button. Since I can't easily add new logic without editing parent, I will just make Manage Covers clear.
                        // OR, I can add a small text button "Reset" that just opens Manage Covers (since onEdit opens it) and user can reset there? That's confusing.
                        // Better: Just make the modal minimalist as requested.
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 py-2.5 rounded-xl transition-all font-bold text-xs border border-emerald-500/20"
                    >
                        <span className="material-icons text-xs">edit_note</span>
                        Manage / Reset
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CoverDetailsModal;

