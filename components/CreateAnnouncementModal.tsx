
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface CreateAnnouncementModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('Announcement');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categories = ['Announcement', 'Research', 'Event', 'Miscellaneous'];

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size must be less than 5MB');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get profile for author name (optional, can be done server side or trigger)
            // For now just using the user id as author_id column reference

            let imageUrl = null;

            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('announcements')
                    .upload(filePath, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('announcements')
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
            }

            const { error: insertError } = await supabase.from('announcements').insert({
                title,
                content,
                category,
                author_id: user.id,
                image_url: imageUrl
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 px-4">
            <div className="w-full max-w-lg bg-[#0c1829] border border-white/10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden max-h-[90vh] flex flex-col">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

                {/* Header - Fixed */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 relative z-10 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">New Announcement</h2>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Share updates</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                            <span className="material-icons text-lg">error_outline</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} id="create-announcement-form" className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white placeholder-slate-600 transition-all font-medium text-sm"
                                placeholder="e.g., Grand Rounds Schedule Change"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${category === cat
                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Cover Image (Optional)</label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className={`w-full h-32 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${imagePreview
                                    ? 'border-primary/50 bg-primary/5'
                                    : 'border-white/10 bg-white/5 group-hover:border-primary/30 group-hover:bg-primary/5'
                                    }`}>
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-xl opacity-60" />
                                    ) : (
                                        <>
                                            <span className="material-icons text-slate-400 group-hover:text-primary transition-colors">add_photo_alternate</span>
                                            <span className="text-[10px] text-slate-500 group-hover:text-primary/80 transition-colors">Click to upload image</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Content</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white placeholder-slate-600 min-h-[150px] transition-all font-medium leading-relaxed resize-none text-sm"
                                placeholder="Write the details of your announcement here..."
                                required
                            />
                        </div>
                    </form>
                </div>

                {/* Footer - Fixed */}
                <div className="flex justify-end gap-3 p-4 border-t border-white/5 bg-[#0c1829] relative z-20 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        form="create-announcement-form"
                        className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="material-icons animate-spin text-sm">sync</span>
                                Publishing...
                            </>
                        ) : (
                            <>
                                <span>POST UPDATE</span>
                                <span className="material-icons text-sm">send</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateAnnouncementModal;
