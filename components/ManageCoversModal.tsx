import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

export type ReadStatus = 'none' | 'partial' | 'complete';
const SCOPE_ALL = 'All';
const SCOPE_REMAINING = 'Remaining studies';
const SCOPE_CUSTOM = '__custom__';

export type LogEntry = {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
    type: 'status' | 'note';
};

export type CoverEntry = {
    id: string;
    doctorName: string;
    scope: string; // e.g., "All", "Cardiac", "Remaining"
    informed: boolean;
    readStatus: ReadStatus;
    informedBy?: string;
    logs?: LogEntry[];
};

interface ManageCoversModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (covers: CoverEntry[]) => void;
    initialCovers: CoverEntry[];
    originalDoctor: string;
    timeSlot: string;
}

const ManageCoversModal: React.FC<ManageCoversModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialCovers,
    originalDoctor,
    timeSlot
}) => {
    const [covers, setCovers] = useState<CoverEntry[]>([]);
    const [newDoctorName, setNewDoctorName] = useState('');
    const [newScopePreset, setNewScopePreset] = useState<string>(SCOPE_ALL);
    const [newCustomScope, setNewCustomScope] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCovers(initialCovers);
            setNewDoctorName('');
            setNewScopePreset(SCOPE_ALL);
            setNewCustomScope('');
        }
    }, [isOpen, initialCovers]);

    if (!isOpen) return null;

    const handleAddCover = () => {
        if (!newDoctorName.trim()) return;
        const resolvedScope = newScopePreset === SCOPE_CUSTOM
            ? (newCustomScope.trim() || SCOPE_ALL)
            : newScopePreset;

        const newEntry: CoverEntry = {
            id: Date.now().toString(),
            doctorName: newDoctorName.trim(),
            scope: resolvedScope,
            informed: false,
            readStatus: 'none'
        };

        setCovers([...covers, newEntry]);
        setNewDoctorName('');
        setNewScopePreset(SCOPE_ALL);
        setNewCustomScope('');
    };

    const handleRemoveCover = (id: string) => {
        setCovers(covers.filter(c => c.id !== id));
    };

    const handleUpdateCover = (id: string, updates: Partial<CoverEntry>) => {
        setCovers(covers.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleSave = () => {
        const draftName = newDoctorName.trim();
        const draftScope = newScopePreset === SCOPE_CUSTOM
            ? (newCustomScope.trim() || SCOPE_ALL)
            : newScopePreset;
        const coversToSave = draftName
            ? [
                ...covers,
                {
                    id: Date.now().toString(),
                    doctorName: draftName,
                    scope: draftScope,
                    informed: false,
                    readStatus: 'none' as const
                }
            ]
            : covers;

        onSave(coversToSave);
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-app/90 backdrop-blur-md animate-in fade-in duration-300 p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#0B101A] border border-white/5 rounded-[2rem] sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] sm:max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 bg-black/40 border-b border-white/5 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-[60px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
                    <h2 className="text-xl font-bold text-white relative z-10">Manage Cover</h2>
                    <div className="text-[13px] text-slate-400 mt-1.5 relative z-10 font-medium">
                        For <span className="text-sky-400 font-bold">{originalDoctor}</span> <span className="mx-1.5 opacity-40">•</span> <span className="text-slate-500">{timeSlot}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-6 overflow-y-auto">
                    {/* List of Covers */}
                    <div className="space-y-3">
                        {covers.map((cover) => (
                            <div key={cover.id} className="bg-black/40 rounded-2xl p-4 border border-white/5 transition-all hover:bg-white/[0.03] relative group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner flex items-center justify-center">
                                            <span className="material-icons text-[20px]">person</span>
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-white tracking-wide">{cover.doctorName}</div>
                                            <div className="mt-1">
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cover.scope === SCOPE_REMAINING
                                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                    : cover.scope === SCOPE_ALL
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                        : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                                                    }`}>
                                                    {cover.scope}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCover(cover.id)}
                                        className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-icons text-[18px]">delete_outline</span>
                                    </button>
                                </div>

                                {/* Status Controls */}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                    {/* Informed Toggle */}
                                    <button
                                        onClick={() => handleUpdateCover(cover.id, { informed: !cover.informed })}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${cover.informed
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-white/5 text-slate-500 hover:bg-white/10 border border-transparent'
                                            }`}
                                    >
                                        <span className="material-icons text-[12px]">
                                            {cover.informed ? 'mark_chat_read' : 'chat_bubble_outline'}
                                        </span>
                                        Informed
                                    </button>

                                    {/* Read Status Dropdown/Toggle */}
                                    <div className="flex-1 flex bg-white/5 rounded border border-white/5 p-0.5">
                                        {(['none', 'partial', 'complete'] as const).map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => handleUpdateCover(cover.id, { readStatus: status })}
                                                className={`flex-1 py-1 rounded-[2px] text-[10px] font-bold uppercase transition-all ${cover.readStatus === status
                                                    ? status === 'complete' ? 'bg-emerald-500 text-black'
                                                        : status === 'partial' ? 'bg-amber-500 text-black'
                                                            : 'bg-slate-600 text-white'
                                                    : 'text-slate-500 hover:text-white'
                                                    }`}
                                                title={status}
                                            >
                                                {status === 'none' ? '0%' : status === 'partial' ? '50%' : '100%'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {covers.length === 0 && (
                            <div className="text-center py-6 text-slate-600 text-xs italic border-2 border-dashed border-white/5 rounded-lg">
                                No covering doctors assigned yet.
                            </div>
                        )}
                    </div>

                    {/* Add New Section */}
                    <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-4 h-[1px] bg-slate-700"></span> Add Covering Doctor <span className="flex-1 h-[1px] bg-slate-700/50"></span>
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Doctor Name</label>
                                <input
                                    type="text"
                                    value={newDoctorName}
                                    onChange={(e) => setNewDoctorName(e.target.value)}
                                    placeholder="e.g. Dr. Smith"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-400 font-medium block mb-1.5 ml-1">Scope / Remarks</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-2">
                                        <select
                                            value={newScopePreset}
                                            onChange={(e) => setNewScopePreset(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all shadow-inner"
                                        >
                                            <option value={SCOPE_ALL} className="bg-surface">{SCOPE_ALL}</option>
                                            <option value={SCOPE_REMAINING} className="bg-surface">{SCOPE_REMAINING}</option>
                                            <option value={SCOPE_CUSTOM} className="bg-surface">Custom...</option>
                                        </select>
                                        {newScopePreset === SCOPE_CUSTOM && (
                                            <input
                                                type="text"
                                                value={newCustomScope}
                                                onChange={(e) => setNewCustomScope(e.target.value)}
                                                placeholder="e.g. Cardiac only"
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 shadow-inner"
                                            />
                                        )}
                                    </div>
                                    <button
                                        onClick={handleAddCover}
                                        disabled={!newDoctorName.trim()}
                                        className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 disabled:bg-white/5 border border-sky-500/30 disabled:border-white/5 text-sky-400 disabled:text-slate-500 rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <span className="material-icons text-[20px]">add</span>
                                        <span className="text-[13px] font-bold tracking-wide">Add Covering Doctor</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 bg-black/40 border-t border-white/5 flex gap-3">
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to reset to default? This will remove all covers.')) {
                                onSave([]);
                                onClose();
                            }
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 font-medium text-sm transition-colors border border-transparent hover:border-rose-500/30 flex items-center justify-center gap-2"
                    >
                        <span className="material-icons text-base">restart_alt</span>
                        Reset
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-[13px] tracking-wide shadow-[0_4px_20px_-4px_rgba(14,165,233,0.5)] transition-all flex items-center justify-center gap-2"
                    >
                        Save Covers
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ManageCoversModal;

