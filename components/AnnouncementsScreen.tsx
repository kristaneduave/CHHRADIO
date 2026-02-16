import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, UserRole } from '../types';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementDetailModal from './AnnouncementDetailModal';

const AnnouncementsScreen: React.FC = () => {
    const [userRole, setUserRole] = useState<UserRole>('resident');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

    const categories = ['All', 'Announcement', 'Research', 'Event', 'Misc'];

    const fetchAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select(`
                    *,
                    profiles:author_id (
                        full_name,
                        avatar_url,
                        role
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData: Announcement[] = data.map(item => ({
                    id: item.id,
                    title: item.title,
                    summary: item.content.length > 200 ? item.content.substring(0, 200) + '...' : item.content,
                    content: item.content,
                    author: item.profiles?.full_name || 'Hospital Staff',
                    author_id: item.author_id,
                    authorAvatar: item.profiles?.avatar_url,
                    authorTitle: item.profiles?.role ? item.profiles.role.charAt(0).toUpperCase() + item.profiles.role.slice(1) : 'Staff',
                    date: new Date(item.created_at).toLocaleDateString(),
                    category: item.category,
                    imageUrl: item.image_url,
                    views: item.views || 0
                }));
                setAnnouncements(formattedData);
            }
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data?.role) {
                    setUserRole(data.role.toLowerCase() as UserRole);
                }
            }
        };
        fetchUserRole();
        fetchAnnouncements();
    }, []);

    const handleEdit = (announcement: Announcement, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAnnouncement(announcement);
        setShowCreateModal(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this announcement?')) {
            try {
                const { error } = await supabase.from('announcements').delete().eq('id', id);
                if (error) throw error;
                fetchAnnouncements();
            } catch (error) {
                console.error('Error deleting announcement:', error);
            }
        }
    };

    const getCategoryStyle = (category: string) => {
        switch (category) {
            case 'Announcement': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'Research': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            case 'Event': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Misc': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const filteredAnnouncements = activeCategory === 'All'
        ? announcements
        : announcements.filter(b => b.category === activeCategory);

    const heroAnnouncement = filteredAnnouncements.length > 0 ? filteredAnnouncements[0] : null;
    const otherAnnouncements = filteredAnnouncements.length > 0 ? filteredAnnouncements.slice(1) : [];

    return (
        <div className="min-h-full pb-20"> {/* Removed h-screen to allow proper scrolling in Layout */}
            <div className="px-6 pt-8 pb-4">
                <h1 className="text-2xl font-bold text-white mb-6">Announcements</h1>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2 -mx-6 px-6">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${activeCategory === cat
                                ? cat === 'Announcement' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/25'
                                    : cat === 'Research' ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/25'
                                        : cat === 'Event' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25'
                                            : cat === 'Misc' ? 'bg-slate-500 text-white border-slate-500 shadow-lg shadow-slate-500/25'
                                                : 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                                : 'glass-card text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-4 px-6">
                    <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />
                    <div className="h-32 rounded-3xl bg-white/5 animate-pulse" />
                    <div className="h-32 rounded-3xl bg-white/5 animate-pulse" />
                </div>
            ) : (
                <div className="px-6 space-y-6">
                    {/* Hero Section */}
                    {heroAnnouncement && (
                        <div
                            onClick={() => setSelectedAnnouncement(heroAnnouncement)}
                            className="group relative w-full aspect-video sm:aspect-[2/1] rounded-3xl overflow-hidden cursor-pointer border border-white/10 shadow-2xl"
                        >
                            {/* Background Image or Gradient */}
                            {heroAnnouncement.imageUrl ? (
                                <img src={heroAnnouncement.imageUrl} alt={heroAnnouncement.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-[#050B14] via-[#050B14]/60 to-transparent" />

                            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border mb-3 backdrop-blur-md ${getCategoryStyle(heroAnnouncement.category)}`}>
                                    {heroAnnouncement.category}
                                </span>
                                <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                                    {heroAnnouncement.title}
                                </h2>
                                <p className="text-sm text-slate-300 line-clamp-2 mb-4 opacity-90">
                                    {heroAnnouncement.summary}
                                </p>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-white/20">
                                        {heroAnnouncement.authorAvatar ? (
                                            <img src={heroAnnouncement.authorAvatar} alt="Author" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                                                {heroAnnouncement.author.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs">
                                        <p className="font-bold text-white max-w-[120px] truncate">{heroAnnouncement.author}</p>
                                        <p className="text-slate-500">{heroAnnouncement.date}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Standard List */}
                    <div className="space-y-4">
                        {otherAnnouncements.map((post) => (
                            <div
                                key={post.id}
                                onClick={() => setSelectedAnnouncement(post)}
                                className="group relative glass-card-enhanced rounded-2xl p-5 cursor-pointer hover:bg-white/[0.07] transition-all active:scale-[0.99]"
                            >
                                <div className="flex justify-between items-start gap-4 mb-3">
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${getCategoryStyle(post.category)}`}>
                                        {post.category}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-500">{post.date}</span>
                                </div>

                                <h3 className="text-base font-bold text-white mb-4 leading-snug group-hover:text-primary transition-colors pr-8">
                                    {post.title}
                                </h3>

                                <div className="flex items-center justify-between mt-auto">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-slate-700 overflow-hidden border border-white/10">
                                            {post.authorAvatar ? (
                                                <img src={post.authorAvatar} alt="Author" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white">
                                                    {post.author.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[100px]">{post.author}</span>
                                    </div>

                                    {(userRole === 'admin' || (currentUserId === post.author_id)) && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => handleEdit(post, e)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                                            >
                                                <span className="material-icons text-sm">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(post.id, e)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                            >
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {!loading && filteredAnnouncements.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
                            <span className="material-icons text-4xl text-slate-600 mb-4">inbox</span>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">No announcements found</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create FAB */}
            {['admin', 'faculty', 'consultant'].includes(userRole.toLowerCase()) && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-24 right-6 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-blue-600 text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all z-40 hover:scale-110 active:scale-95 group"
                >
                    <span className="material-icons text-xl group-hover:rotate-90 transition-transform duration-300">add</span>
                </button>
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateAnnouncementModal
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingAnnouncement(null);
                    }}
                    onSuccess={() => {
                        fetchAnnouncements();
                        setShowCreateModal(false);
                        setEditingAnnouncement(null);
                    }}
                    editingAnnouncement={editingAnnouncement}
                />
            )}

            {selectedAnnouncement && (
                <AnnouncementDetailModal
                    announcement={selectedAnnouncement}
                    onClose={() => setSelectedAnnouncement(null)}
                />
            )}
        </div>
    );
};

export default AnnouncementsScreen;
