import React from 'react';

interface MyCaseLibraryProps {
    loadingCases: boolean;
    myCases: any[];
    onViewCase?: (caseItem: any) => void;
    onEditCase?: (caseItem: any) => void;
    confirmDelete: (id: string) => void;
}

export const getSubmissionTypeMeta = (submissionType?: string) => {
    switch (submissionType) {
        case 'rare_pathology':
            return {
                icon: 'biotech',
                tintClass: 'text-rose-400',
                boxClass: 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
                glowClass: 'bg-rose-500/20',
                unreadCardClass: 'bg-rose-500/[0.08] border border-rose-500/30 shadow-[0_4px_24px_-8px_rgba(225,29,72,0.25)] hover:bg-rose-500/[0.12]',
                unreadBadgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/35',
            };
        case 'aunt_minnie':
            return {
                icon: 'psychology',
                tintClass: 'text-amber-400',
                boxClass: 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
                glowClass: 'bg-amber-500/20',
                unreadCardClass: 'bg-amber-500/[0.08] border border-amber-500/30 shadow-[0_4px_24px_-8px_rgba(217,119,6,0.25)] hover:bg-amber-500/[0.12]',
                unreadBadgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/35',
            };
        default:
            return {
                icon: 'library_books',
                tintClass: 'text-sky-400',
                boxClass: 'bg-sky-500/20 border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.3)]',
                glowClass: 'bg-sky-500/20',
                unreadCardClass: 'bg-sky-500/[0.08] border border-sky-500/30 shadow-[0_4px_24px_-8px_rgba(14,165,233,0.25)] hover:bg-sky-500/[0.12]',
                unreadBadgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/35',
            };
    }
};

export const getPrimaryMeta = (item: any) => {
    const type = item?.submission_type || 'interesting_case';
    if (type === 'interesting_case') return 'Interesting Case';
    if (type === 'rare_pathology') return 'Rare Pathology';
    if (type === 'aunt_minnie') return 'Aunt Minnie';
    if (item?.organ_system) return item.organ_system;
    if (item?.modality) return item.modality;
    return 'Case';
};

export const getDisplayTitle = (item: any) => {
    const type = item?.submission_type || 'interesting_case';
    if (type === 'aunt_minnie') {
        return String(item?.title || item?.findings || item?.analysis_result?.impression || item?.diagnosis || 'Aunt Minnie').toUpperCase();
    }
    if (type === 'rare_pathology') {
        return String(item?.title || item?.analysis_result?.impression || item?.diagnosis || 'Rare Pathology').toUpperCase();
    }
    return String(item?.title || item?.analysis_result?.impression || item?.diagnosis || 'Interesting Case').toUpperCase();
};

export const MyCaseLibrary: React.FC<MyCaseLibraryProps> = ({
    loadingCases,
    myCases,
    onViewCase,
    onEditCase,
    confirmDelete
}) => {
    return (
        <div>
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">My Case Library</h2>

            {loadingCases ? (
                <div className="text-center py-8 text-slate-500 text-xs">Loading cases...</div>
            ) : myCases.length === 0 ? (
                <div className="bg-[#0a0f18]/80 backdrop-blur-2xl p-8 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-80 border-dashed border border-white/10">
                    <span className="material-icons text-4xl text-slate-600 mb-3">folder_open</span>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">No cases yet</p>
                    <p className="text-[10px] text-slate-500">Go to Upload tab to add new cases.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {myCases.map((c) => {
                        const typeMeta = getSubmissionTypeMeta(c.submission_type || 'interesting_case');
                        const displayTitle = getDisplayTitle(c);
                        const primaryMeta = getPrimaryMeta(c);

                        const isRarePathology = c.submission_type === 'rare_pathology';
                        const isAuntMinnie = c.submission_type === 'aunt_minnie';

                        const tintColorClass = isRarePathology ? 'text-rose-400' : isAuntMinnie ? 'text-amber-400' : 'text-sky-400';
                        const bgGlowClass = isRarePathology ? 'bg-rose-500/10' : isAuntMinnie ? 'bg-amber-500/10' : 'bg-sky-500/10';
                        const borderGlowClass = isRarePathology ? 'border-rose-500/20' : isAuntMinnie ? 'border-amber-500/20' : 'border-sky-500/20';
                        const shadowClass = isRarePathology ? 'shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                            : isAuntMinnie ? 'shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                                : 'shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]';

                        return (
                            <div
                                key={c.id}
                                onClick={() => onViewCase && onViewCase(c)}
                                className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-3.5 w-full z-10 relative">
                                    <div className={`w-[38px] h-[38px] rounded-[14px] ${bgGlowClass} ${tintColorClass} flex items-center justify-center border ${borderGlowClass} ${shadowClass} transition-all shrink-0`}>
                                        <span className="material-icons text-[18px]">{typeMeta.icon}</span>
                                    </div>

                                    <div className="flex-1 min-w-0 pr-1">
                                        <h4 className={`text-[12px] sm:text-[13px] truncate tracking-widest font-extrabold ${tintColorClass} group-hover:brightness-110 mb-0.5 uppercase`}>
                                            {displayTitle}
                                        </h4>
                                        <div className="flex items-center gap-1.5 text-[9px] truncate uppercase tracking-widest font-bold">
                                            <span className="text-white/70">{primaryMeta}</span>
                                            <span className="text-white/20">•</span>
                                            <span className="text-white/40">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditCase && onEditCase(c); }}
                                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                            title="Edit Case"
                                        >
                                            <span className="material-icons text-[15px]">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); confirmDelete(c.id); }}
                                            className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-500 hover:text-rose-400 transition-colors"
                                            title="Delete Case"
                                        >
                                            <span className="material-icons text-[15px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
