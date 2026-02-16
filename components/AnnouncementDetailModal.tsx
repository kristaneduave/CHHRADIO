import React from 'react';
import { Announcement } from '../types';

interface AnnouncementDetailModalProps {
    announcement: Announcement | null;
    onClose: () => void;
}

const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({ announcement, onClose }) => {
    if (!announcement) return null;

    const getCategoryBadgeStyle = (category: string) => {
        switch (category) {
            case 'Research': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            case 'Announcement': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'Event': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Clinical': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300 p-4 sm:p-6" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-[#0c1829] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header / Hero Image */}
                <div className="relative h-48 sm:h-64 shrink-0">
                    {announcement.imageUrl ? (
                        <img
                            src={announcement.imageUrl}
                            alt={announcement.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                            <span className="material-icons text-6xl text-white/10">article</span>
                        </div>
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all border border-white/10 z-10"
                    >
                        <span className="material-icons">close</span>
                    </button>

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c1829] to-transparent pointer-events-none" />

                    <div className="absolute bottom-6 left-6 right-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-3 backdrop-blur-md ${getCategoryBadgeStyle(announcement.category)}`}>
                            {announcement.category}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight shadow-black drop-shadow-lg">
                            {announcement.title}
                        </h2>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    {/* Author Meta */}
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border-2 border-[#0c1829] shadow-lg overflow-hidden">
                            {announcement.authorAvatar ? (
                                <img src={announcement.authorAvatar} alt={announcement.author} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-white">{announcement.author.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{announcement.author}</p>
                            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                {announcement.authorTitle || 'Hospital Staff'}
                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                {announcement.date}
                            </p>
                        </div>
                    </div>

                    {/* Body Text */}
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {announcement.content}
                    </div>
                </div>

                {/* Footer Actions (Optional) */}
                <div className="p-4 border-t border-white/5 bg-[#0a1424] flex justify-end shrink-0">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider">
                        <span className="material-icons text-sm">share</span>
                        Share Update
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementDetailModal;
