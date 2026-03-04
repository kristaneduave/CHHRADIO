import React from 'react';
import { SubmissionType } from '../types';

interface UploadTypePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: SubmissionType) => void;
}

export const UploadTypePickerModal: React.FC<UploadTypePickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Choose upload type"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-app/90 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>
            {/* Modal Container */}
            <div
                className="w-full max-w-[320px] bg-[#0a0f18]/80 backdrop-blur-2xl border border-white/10 rounded-[1.75rem] shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 animate-in zoom-in-95 duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Content Area */}
                <div className="p-5 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 space-y-2.5">
                        <button
                            className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                            onClick={() => {
                                onClose();
                                onSelect('interesting_case');
                            }}
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-[0.85rem] bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all">
                                    <span className="material-icons text-[20px]">library_books</span>
                                </div>
                                <span className="block text-[13px] font-bold text-sky-400 group-hover:text-sky-300 transition-colors tracking-widest uppercase">INTERESTING CASE</span>
                            </div>
                            <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                <span className="material-icons text-white text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        <button
                            className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                            onClick={() => {
                                onClose();
                                onSelect('rare_pathology');
                            }}
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-[0.85rem] bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:shadow-[0_0_20px_rgba(244,63,94,0.25)] transition-all">
                                    <span className="material-icons text-[20px]">biotech</span>
                                </div>
                                <span className="block text-[13px] font-bold text-rose-400 group-hover:text-rose-300 transition-colors tracking-widest uppercase">RARE PATHOLOGY</span>
                            </div>
                            <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                <span className="material-icons text-white text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        <button
                            className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group"
                            onClick={() => {
                                onClose();
                                onSelect('aunt_minnie');
                            }}
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-[0.85rem] bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all">
                                    <span className="material-icons text-[20px]">psychology</span>
                                </div>
                                <span className="block text-[13px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors tracking-widest uppercase">AUNT MINNIE</span>
                            </div>
                            <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                <span className="material-icons text-white text-[20px]">chevron_right</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
