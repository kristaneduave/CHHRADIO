import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';

interface AnnouncementDetailModalProps {
    announcement: Announcement | null;
    onClose: () => void;
}

const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({ announcement, onClose }) => {
    if (!announcement) return null;

    const [viewers, setViewers] = useState<{ avatar_url: string | null; full_name: string | null }[]>([]);

    useEffect(() => {
        if (!announcement) return;

        const trackView = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check if already viewed
            const { data: existingView } = await supabase
                .from('announcement_views')
                .select('id')
                .eq('announcement_id', announcement.id)
                .eq('user_id', user.id)
                .single();

            if (!existingView) {
                // Insert view
                await supabase.from('announcement_views').insert({
                    announcement_id: announcement.id,
                    user_id: user.id
                });
            }
        };

        const fetchViewers = async () => {
            // We need to fetch from announcement_views and join with profiles
            // However, supabase-js loose typing might require us to be careful or use a view if strict
            // Let's try standard select with join
            const { data } = await supabase
                .from('announcement_views')
                .select(`
                    user_id,
                    profiles:user_id (
                        avatar_url,
                        full_name
                    )
                `)
                .eq('announcement_id', announcement.id)
                .limit(10);

            if (data) {
                const uniqueViewers = data.map((item: any) => ({
                    avatar_url: item.profiles?.avatar_url,
                    full_name: item.profiles?.full_name
                }));
                setViewers(uniqueViewers);
            }
        };

        trackView();
        fetchViewers();
    }, [announcement]);

    const getCategoryBadgeStyle = (category: string) => {
        switch (category) {
            case 'Announcement': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'Research': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            case 'Event': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Miscellaneous':
            case 'Misc': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-[#0A121A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-auto max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Compact */}
                <div className="flex justify-between items-start p-4 border-b border-white/5 shrink-0 bg-[#0F1720] relative z-20">
                    <div className="pr-8">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border mb-2 ${getCategoryBadgeStyle(announcement.category)}`}>
                            {announcement.category}
                        </span>
                        <h2 className="text-lg font-bold text-white leading-tight">
                            {announcement.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all -mr-2 -mt-2"
                    >
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                    {/* Author Meta - Compact */}
                    <div className="flex items-center gap-3 mb-4">
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
                        <div className="mb-4 relative group rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
                            <img
                                src={announcement.imageUrl}
                                alt={announcement.title}
                                className="w-full h-auto max-h-[40vh] object-contain sm:object-cover" // Ensure it doesn't take too much vertical space on mobile but fully visible
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
                <div className="p-3 border-t border-white/5 bg-[#0F1720]/50 flex justify-end shrink-0">
                    <div className="flex items-center gap-[-8px]">
                        {viewers.length > 0 && (
                            <div className="flex items-center mr-3">
                                <div className="flex -space-x-2 overflow-hidden">
                                    {viewers.slice(0, 5).map((viewer, i) => (
                                        <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0F1720] bg-slate-700 flex items-center justify-center overflow-hidden" title={viewer.full_name || 'User'}>
                                            {viewer.avatar_url ? (
                                                <img src={viewer.avatar_url} alt="Viewer" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[8px] text-white font-bold">{viewer.full_name?.charAt(0) || 'U'}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {viewers.length > 5 && (
                                    <span className="text-[10px] text-slate-500 font-medium ml-2">+{viewers.length - 5} others</span>
                                )}
                            </div>
                        )}
                    </div>

                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
                        <span className="material-icons text-sm">share</span>
                        Share Update
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AnnouncementDetailModal;
