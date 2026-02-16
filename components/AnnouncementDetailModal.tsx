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
            case 'Announcement': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'Research': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            case 'Event': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Miscellaneous': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const handleDownloadImage = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!announcement.imageUrl) return;

        try {
            const response = await fetch(announcement.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `announcement-${announcement.id}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
            // Fallback for simple open in new tab if fetch fails (CORS etc)
            window.open(announcement.imageUrl, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300 sm:p-6" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-[#0c1829] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Compact */}
                <div className="flex justify-between items-start p-6 border-b border-white/5 shrink-0 bg-[#0c1829] relative z-20">
                    <div className="pr-8">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-3 ${getCategoryBadgeStyle(announcement.category)}`}>
                            {announcement.category}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                            {announcement.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all -mr-2 -mt-2"
                    >
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                    {/* Author Meta - Compact */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-white/10 shadow-lg overflow-hidden shrink-0">
                            {announcement.authorAvatar ? (
                                <img src={announcement.authorAvatar} alt={announcement.author} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs font-bold text-white">{announcement.author.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{announcement.author}</p>
                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-2">
                                {announcement.authorTitle || 'Hospital Staff'}
                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                {announcement.date}
                            </p>
                        </div>
                    </div>

                    {/* Image - Inline */}
                    {announcement.imageUrl && (
                        <div className="mb-6 relative group rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
                            <img
                                src={announcement.imageUrl}
                                alt={announcement.title}
                                className="w-full h-auto max-h-[50vh] object-contain sm:object-cover" // Ensure it doesn't take too much vertical space on mobile but fully visible
                            />
                            <button
                                onClick={handleDownloadImage}
                                className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-lg text-white text-xs font-bold flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 sm:opacity-100" // Always visible on mobile (no hover), hover on desktop
                            >
                                <span className="material-icons text-sm">download</span>
                                Save
                            </button>
                        </div>
                    )}

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
