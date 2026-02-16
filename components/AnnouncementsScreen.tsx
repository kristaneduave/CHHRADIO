import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, UserRole } from '../types';
import { MOCK_ANNOUNCEMENTS } from '../constants';
import CreateAnnouncementModal from './CreateAnnouncementModal';

const AnnouncementsScreen: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [userRole, setUserRole] = useState<UserRole>('resident'); // Default to resident
    const [userId, setUserId] = useState<string | null>(null);

    const categories = ['All', 'Research', 'Announcement', 'Event', 'Clinical'];

    useEffect(() => {
        const fetchUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data?.role) {
                    setUserRole(data.role as UserRole);
                }
            }
        };
        fetchUserRole();
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching announcements:', error);
                // Fallback to mock data on error (or if table is empty/not created yet)
                setAnnouncements(MOCK_ANNOUNCEMENTS);
            } else if (data && data.length > 0) {
                // Map Supabase data to Announcement type if needed
                // Assuming database columns match type definition for simplicity
                // We might need to map 'content' to 'summary' if we want to display a preview
                // For now, let's assume the shape is compatible or use provided data

                const mappedData: Announcement[] = data.map(item => ({
                    id: item.id,
                    title: item.title,
                    summary: item.content.substring(0, 150) + '...', // Create summary from content
                    content: item.content,
                    author: 'Hospital Staff', // Placeholder until we join with profiles
                    author_id: item.author_id,
                    authorTitle: 'Contributor',
                    date: new Date(item.created_at).toLocaleDateString(),
                    category: item.category,
                    imageUrl: item.image_url,
                    views: item.views || 0
                }));
                setAnnouncements(mappedData);
            } else {
                setAnnouncements(MOCK_ANNOUNCEMENTS); // Fallback to mock if empty
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            setAnnouncements(MOCK_ANNOUNCEMENTS);
        } finally {
            setLoading(false);
        }
    };

    const filteredAnnouncements = activeCategory === 'All'
        ? announcements
        : announcements.filter(b => b.category === activeCategory);

    const heroAnnouncement = filteredAnnouncements.length > 0 ? filteredAnnouncements[0] : null;
    const otherAnnouncements = filteredAnnouncements.length > 0 ? filteredAnnouncements.slice(1) : [];

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Research': return 'from-indigo-500/20 to-indigo-500/5 text-indigo-300 border-indigo-500/20';
            case 'Announcement': return 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/20';
            case 'Event': return 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/20';
            case 'Clinical': return 'from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-500/20';
            default: return 'from-slate-500/20 to-slate-500/5 text-slate-300 border-slate-500/20';
        }
    };

    const getCategoryBadgeStyle = (category: string) => {
        switch (category) {
            case 'Research': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            case 'Announcement': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'Event': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Clinical': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    const SkeletonCard = () => (
        <div className="w-full h-32 rounded-2xl bg-white/5 animate-pulse border border-white/5 p-4 flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-white/5 shrink-0" />
            <div className="flex-1 space-y-3 py-1">
                <div className="h-2 w-24 bg-white/10 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-full bg-white/5 rounded" />
            </div>
        </div>
    );

    return (
        <div className="px-6 pt-12 pb-24 flex flex-col min-h-full animate-in fade-in duration-700 bg-gradient-to-b from-[#050B14] to-[#0c1829]">

            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Announcements</h1>
                    <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-bold">Hospital Intelligence Feed</p>
                </div>
            </header>

            {/* Pill Filters */}
            <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-4">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${activeCategory === cat
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-105'
                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:border-white/10'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="space-y-6">
                {loading ? (
                    <div className="space-y-4">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                ) : (
                    <>
                        {/* Hero Section */}
                        {heroAnnouncement && (
                            <div
                                className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-3xl overflow-hidden group cursor-pointer shadow-2xl shadow-black/50 border border-white/10"
                                onClick={() => {/* Navigate to detail if needed */ }}
                            >
                                {/* Background Image or Gradient */}
                                {heroAnnouncement.imageUrl ? (
                                    <img
                                        src={heroAnnouncement.imageUrl}
                                        alt={heroAnnouncement.title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className={`absolute inset-0 bg-gradient-to-br ${getCategoryColor(heroAnnouncement.category)} opacity-50`} />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border mb-3 backdrop-blur-md ${getCategoryBadgeStyle(heroAnnouncement.category)}`}>
                                        {heroAnnouncement.category}
                                    </span>
                                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight group-hover:text-primary transition-colors">
                                        {heroAnnouncement.title}
                                    </h2>
                                    <p className="text-xs text-slate-300 line-clamp-2 max-w-xl mb-4 leading-relaxed">
                                        {heroAnnouncement.summary}
                                    </p>
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white">
                                                {heroAnnouncement.author.charAt(0)}
                                            </div>
                                            {heroAnnouncement.author}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                                        <span>{heroAnnouncement.date}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Remaining List */}
                        <div className="space-y-4">
                            {otherAnnouncements.map((post) => (
                                <div
                                    key={post.id}
                                    className="group relative bg-[#131c2e]/80 hover:bg-[#1a253a] backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    <div className="flex gap-5">
                                        {/* Image Thumbnail (if exists) */}
                                        {post.imageUrl && (
                                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
                                                <img
                                                    src={post.imageUrl}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                                />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${getCategoryBadgeStyle(post.category)}`}>
                                                    {post.category}
                                                </span>
                                                <span className="text-[9px] text-slate-600 font-bold">{post.date}</span>
                                            </div>

                                            <h3 className="text-sm font-bold text-slate-200 mb-1.5 leading-snug group-hover:text-primary transition-colors pr-8">
                                                {post.title}
                                            </h3>

                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                                {post.summary}
                                            </p>

                                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                                        <span className="material-icons text-[12px]">person</span>
                                                        {post.author}
                                                    </span>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                                    {(userRole === 'admin' || (userRole !== 'resident' && userId && post.author_id === userId)) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('Delete?')) {
                                                                    supabase.from('announcements').delete().eq('id', post.id).then(({ error }) => {
                                                                        if (!error) fetchAnnouncements();
                                                                    });
                                                                }
                                                            }}
                                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all"
                                                        >
                                                            <span className="material-icons text-[14px]">delete</span>
                                                        </button>
                                                    )}
                                                    <button className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                                                        <span className="material-icons text-[14px]">bookmark_border</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!loading && filteredAnnouncements.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
                                <span className="material-icons text-4xl text-slate-700 mb-4">newspaper</span>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No updates in this feed</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create FAB */}
            {['admin', 'faculty', 'consultant'].includes(userRole) && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-24 right-8 w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-blue-600 text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all z-50 hover:scale-105 active:scale-95 border border-white/20"
                >
                    <span className="material-icons text-2xl">add</span>
                </button>
            )}

            {showCreateModal && (
                <CreateAnnouncementModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        fetchAnnouncements();
                        setShowCreateModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default AnnouncementsScreen;
