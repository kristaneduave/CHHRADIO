
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface CreateAnnouncementModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('Research');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categories = ['Research', 'Announcement', 'Event', 'Clinical'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get profile for author name (optional, can be done server side or trigger)
            // For now just using the user id as author_id column reference

            const { error: insertError } = await supabase.from('announcements').insert({
                title,
                content,
                category,
                author_id: user.id
            });

            if (insertError) throw insertError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating announcement:', err);
            setError(err.message || 'Failed to create announcement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050B14]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#0A121A] border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">New Announcement</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <span className="material-icons">close</span>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-slate-500"
                            placeholder="Enter title"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${category === cat
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-slate-500 min-h-[120px]"
                            placeholder="Write your announcement..."
                            required
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors mr-3"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading && <span className="material-icons animate-spin text-sm mr-2">sync</span>}
                            Post Announcement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateAnnouncementModal;
