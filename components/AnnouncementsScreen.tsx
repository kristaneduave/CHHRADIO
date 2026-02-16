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

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Research': return 'text-indigo-400';
            case 'Announcement': return 'text-amber-400';
            case 'Event': return 'text-emerald-400';
            case 'Clinical': return 'text-rose-400';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="px-6 pt-12 pb-12 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-8">
                <h1 className="text-xl font-medium text-white tracking-tight">Announcements</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Hospital Intelligence Feed</p>
            </header>

            {/* Minimalist Filter */}
            <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar border-b border-white/5 mb-8">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`relative whitespace-nowrap text-xs font-semibold transition-all pb-1 ${activeCategory === cat
                            ? 'text-primary'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        {cat}
                        {activeCategory === cat && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in slide-in-from-left-2"></span>
                        )}
                    </button>
                ))}
            </div>

            {/* List Feed */}
            <div className="flex-1 space-y-0">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    filteredAnnouncements.map((post, idx) => (
                        <div
                            key={post.id}
                            className={`py-6 flex gap-6 items-start group cursor-pointer transition-all border-b border-white/[0.03] last:border-0 ${idx === 0 ? 'pt-0' : ''
                                }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${getCategoryColor(post.category)}`}>
                                        {post.category}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                    <span className="text-[9px] text-slate-600 font-medium">{post.date}</span>
                                </div>

                                <h2 className="text-sm font-semibold text-slate-200 mb-2 leading-snug group-hover:text-white transition-colors">
                                    {post.title}
                                </h2>

                                <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                    {post.summary}
                                </p>

                                <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-icons text-[12px] text-slate-600">person</span>
                                        <span className="text-[10px] text-slate-500">{post.author}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-icons text-[12px] text-slate-600">visibility</span>
                                        <span className="text-[10px] text-slate-500">{post.views}</span>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-4 pt-4 border-t border-white/5">
                                    <button className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                                        <span className="material-icons text-sm">share</span>
                                        Share
                                    </button>
                                    <button className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                                        <span className="material-icons text-sm">bookmark_border</span>
                                        Save
                                    </button>
                                    {/* Delete button for Admin or Author (if privileged) */}
                                    {(userRole === 'admin' || (userRole !== 'resident' && userId && post.author_id === userId)) && (
                                        <button
                                            className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors ml-auto"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm('Are you sure you want to delete this announcement?')) {
                                                    const { error } = await supabase.from('announcements').delete().eq('id', post.id);
                                                    if (!error) fetchAnnouncements();
                                                }
                                            }}
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>

                            {post.imageUrl && (
                                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-white/5">
                                    <img
                                        src={post.imageUrl}
                                        alt={post.title}
                                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}

                {!loading && filteredAnnouncements.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <span className="material-icons text-2xl text-slate-800 mb-3">auto_awesome</span>
                        <p className="text-[11px] text-slate-600 uppercase tracking-widest">No announcements found</p>
                    </div>
                )}
            </div>

            {/* Create FAB - Only for Admin, Faculty, Consultant */}
            {['admin', 'faculty', 'consultant'].includes(userRole) && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-24 right-8 w-12 h-12 rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 flex items-center justify-center transition-all z-50 transform hover:scale-110 active:scale-95"
                >
                    <span className="material-icons text-xl">add</span>
                </button>
            )}


            {showCreateModal && (
                <CreateAnnouncementModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        fetchAnnouncements();
                        setShowCreateModal(false); // Close modal after successful creation
                        // Optional: show toast notification
                    }}
                />
            )}

            {/* Debug Indicator - Remove before production */}
            <div className="text-center mt-8 opacity-30 hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white font-mono">
                    Debug: Current Role = <span className="font-bold text-yellow-400">{userRole}</span>
                </p>
            </div>
        </div>
    );
};

export default AnnouncementsScreen;
