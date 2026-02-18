import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

export type ReadStatus = 'none' | 'partial' | 'complete';

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
    const [newScope, setNewScope] = useState('All');

    useEffect(() => {
        if (isOpen) {
            setCovers(initialCovers);
            setNewDoctorName('');
            setNewScope('All');
        }
    }, [isOpen, initialCovers]);

    if (!isOpen) return null;

    const handleAddCover = () => {
        if (!newDoctorName.trim()) return;

        const newEntry: CoverEntry = {
            id: Date.now().toString(),
            doctorName: newDoctorName.trim(),
            scope: newScope.trim() || 'All',
            informed: false,
            readStatus: 'none'
        };

        setCovers([...covers, newEntry]);
        setNewDoctorName('');
        setNewScope('All');
    };

    const handleRemoveCover = (id: string) => {
        setCovers(covers.filter(c => c.id !== id));
    };

    const handleUpdateCover = (id: string, updates: Partial<CoverEntry>) => {
        setCovers(covers.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleSave = () => {
        onSave(covers);
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#0F1720] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-bold text-white">Manage Cover</h2>
                    <div className="text-xs text-slate-400 mt-1">
                        For: <span className="text-rose-400 font-medium">{originalDoctor}</span> • <span className="text-slate-500">{timeSlot}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* List of Covers */}
                    <div className="space-y-3">
                        {covers.map((cover) => (
                            <div key={cover.id} className="bg-black/40 rounded-lg p-3 border border-white/5 relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-sm font-bold text-emerald-400">{cover.doctorName}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                                            Scope: <span className="text-slate-300">{cover.scope}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCover(cover.id)}
                                        className="text-slate-600 hover:text-rose-500 transition-colors"
                                    >
                                        <span className="material-icons text-sm">delete</span>
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
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Add Covering Doctor</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1 ml-1">Doctor Name</label>
                                <input
                                    type="text"
                                    value={newDoctorName}
                                    onChange={(e) => setNewDoctorName(e.target.value)}
                                    placeholder="e.g. Dr. Smith"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1 ml-1">Scope / Remarks</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newScope}
                                        onChange={(e) => setNewScope(e.target.value)}
                                        placeholder="e.g. All, Cardiac, Neuro..."
                                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                                    />
                                    <button
                                        onClick={handleAddCover}
                                        disabled={!newDoctorName.trim()}
                                        className="px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-rose-500/20"
                                    >
                                        <span className="material-icons text-lg">add</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 flex gap-3">
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
                        className="flex-[2] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ManageCoversModal;
