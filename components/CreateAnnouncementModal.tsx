
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';

interface CreateAnnouncementModalProps {
    onClose: () => void;
    onSuccess: () => void;
    editingAnnouncement?: Announcement | null;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ onClose, onSuccess, editingAnnouncement }) => {
    const [title, setTitle] = useState(editingAnnouncement?.title || '');
    const [content, setContent] = useState(editingAnnouncement?.content || '');
    const [category, setCategory] = useState(editingAnnouncement?.category || 'Announcement');
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

            if (editingAnnouncement) {
                // Update
                const { error: updateError } = await supabase
                    .from('announcements')
                    .update({
                        title,
                        content,
                        category,
                        created_at: new Date().toISOString(), // Bump to top
                        // Only update image if a new one is provided.
                        // If imageFile is provided, we update.
                        ...(imageUrl ? { image_url: imageUrl } : {})
                    })
                    .eq('id', editingAnnouncement.id);

                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase.from('announcements').insert({
                    title,
                    content,
                    category,
                    author_id: user.id,
                    image_url: imageUrl
                });

                if (insertError) throw insertError;
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error saving announcement:', err);
            setError(err.message || 'Failed to save announcement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-lg bg-[#0c1829] border border-white/10 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative overflow-hidden h-auto max-h-[80vh] sm:max-h-[90vh] flex flex-col">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

                {/* Header - Fixed */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 relative z-10 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</h2>
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
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Content</label>

                                {/* Attachment Button */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        id="image-upload"
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="image-upload"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/5 hover:border-white/10"
                                    >
                                        <span className="material-icons text-sm">attach_file</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Attach Image</span>
                                    </label>
                                </div>
                            </div>

                            {/* Image Preview Pill */}
                            {imagePreview && (
                                <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10 w-fit animate-in fade-in slide-in-from-top-2 duration-200 mb-2">
                                    <div className="w-8 h-8 rounded-md overflow-hidden bg-black/20 shrink-0">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-medium text-white truncate max-w-[150px]">
                                            {imageFile?.name || 'Image attached'}
                                        </span>
                                        <span className="text-[9px] text-slate-500">
                                            {(imageFile?.size ? (imageFile.size / 1024 / 1024).toFixed(2) : '0')} MB
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImageFile(null);
                                            setImagePreview(null);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors ml-1"
                                    >
                                        <span className="material-icons text-sm">close</span>
                                    </button>
                                </div>
                            )}

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
                                <span>{editingAnnouncement ? 'UPDATE POST' : 'POST UPDATE'}</span>
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
